from __future__ import annotations

import asyncio
import math
import os
import time
from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import quote_plus

import httpx

from plan_models import NearbyRequest, PlaceResource, ResourceCategory


TTL_SECONDS = 24 * 60 * 60
RADIUS_METERS = 16_000
OSM_USER_AGENT = os.getenv("OSM_USER_AGENT", "SignalDisasterPlanning/1.0")
OVERPASS_ENDPOINTS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search"
GOOGLE_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"

TAGS: dict[ResourceCategory, list[tuple[str, str]]] = {
    "shelter": [("social_facility", "shelter"), ("amenity", "shelter"), ("emergency", "shelter")],
    "food": [("amenity", "food_bank"), ("social_facility", "food_bank"), ("social_facility", "soup_kitchen")],
    "childcare": [("amenity", "childcare"), ("amenity", "kindergarten")],
    "pets": [("amenity", "animal_shelter"), ("amenity", "veterinary")],
    "government": [("office", "government"), ("amenity", "townhall")],
    "bank": [("amenity", "bank")],
    "lodging": [("tourism", "hotel"), ("tourism", "motel")],
    "fuel": [("amenity", "fuel")],
    "transit": [("amenity", "bus_station"), ("public_transport", "station")],
    "seniors": [("social_facility:for", "senior"), ("amenity", "social_centre")],
    "equipment": [("shop", "medical_supply")],
    "post": [("amenity", "post_office")],
    "community": [("amenity", "social_facility"), ("amenity", "community_centre")],
}

SEARCH_LABELS = {
    "shelter": "emergency shelter",
    "food": "food bank",
    "childcare": "childcare",
    "pets": "animal shelter",
    "government": "government services office",
    "bank": "bank",
    "lodging": "hotel",
    "fuel": "fuel station",
    "transit": "bus station",
    "seniors": "senior center",
    "equipment": "mobility equipment loan service",
    "post": "post office",
    "community": "community services",
}


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    to_rad = math.radians
    dlat = to_rad(lat2 - lat1)
    dlng = to_rad(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(dlng / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _coarse(lat: float, lng: float) -> tuple[float, float]:
    return round(lat, 2), round(lng, 2)


class ResourceProvider(Protocol):
    name: str

    async def find(self, request: NearbyRequest) -> list[PlaceResource]: ...


class TTLCache:
    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, list[PlaceResource]]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> list[PlaceResource] | None:
        async with self._lock:
            entry = self._entries.get(key)
            if not entry:
                return None
            expires, value = entry
            if expires <= time.monotonic():
                self._entries.pop(key, None)
                return None
            return value

    async def put(self, key: str, value: list[PlaceResource]) -> None:
        async with self._lock:
            self._entries[key] = (time.monotonic() + TTL_SECONDS, value)


_cache = TTLCache()


class GooglePlacesProvider:
    name = "Google Places"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def find(self, request: NearbyRequest) -> list[PlaceResource]:
        lat, lng = _coarse(request.lat, request.lng)
        key = f"google:{request.category}:{request.query.casefold()}:{lat:.2f}:{lng:.2f}"
        cached = await _cache.get(key)
        if cached is not None:
            return cached

        body = {
            "textQuery": f"{request.query} near {lat:.2f},{lng:.2f}",
            "locationBias": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": RADIUS_METERS,
                }
            },
            "maxResultCount": 10,
        }
        field_mask = ",".join(
            [
                "places.displayName",
                "places.formattedAddress",
                "places.location",
                "places.nationalPhoneNumber",
                "places.websiteUri",
                "places.regularOpeningHours",
                "places.currentOpeningHours.openNow",
                "places.googleMapsUri",
            ]
        )
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                GOOGLE_TEXT_SEARCH,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": self.api_key,
                    "X-Goog-FieldMask": field_mask,
                },
            )
            response.raise_for_status()
            payload = response.json()

        fetched_at = datetime.now(timezone.utc).isoformat()
        resources: list[PlaceResource] = []
        for item in payload.get("places", []):
            location = item.get("location") or {}
            place_lat = location.get("latitude")
            place_lng = location.get("longitude")
            name = (item.get("displayName") or {}).get("text")
            if not name or place_lat is None or place_lng is None:
                continue
            opening = item.get("regularOpeningHours") or {}
            current = item.get("currentOpeningHours") or {}
            resources.append(
                PlaceResource(
                    name=name,
                    category=request.category,
                    phone=item.get("nationalPhoneNumber"),
                    website=item.get("websiteUri"),
                    address=item.get("formattedAddress"),
                    lat=place_lat,
                    lng=place_lng,
                    distanceKm=_distance_km(lat, lng, place_lat, place_lng),
                    hours="; ".join(opening.get("weekdayDescriptions", [])) or None,
                    openNow=current.get("openNow"),
                    source="google",
                    sourceUrl=item.get("googleMapsUri"),
                    mapsUri=item.get("googleMapsUri"),
                    fetchedAt=fetched_at,
                )
            )
        resources = _rank(resources)
        await _cache.put(key, resources)
        return resources[:3]


class OpenStreetMapProvider:
    name = "OpenStreetMap"

    async def find(self, request: NearbyRequest) -> list[PlaceResource]:
        lat, lng = _coarse(request.lat, request.lng)
        key = f"osm:{request.category}:{request.query.casefold()}:{lat:.2f}:{lng:.2f}"
        cached = await _cache.get(key)
        if cached is not None:
            return cached

        around = f"(around:{RADIUS_METERS},{lat},{lng})"
        filters = "".join(f'nwr["{key}"="{value}"]{around};' for key, value in TAGS[request.category])
        query = f"[out:json][timeout:20];({filters});out center tags 300;"
        elements = None
        async with httpx.AsyncClient(timeout=22, headers={"User-Agent": OSM_USER_AGENT}) as client:
            for endpoint in OVERPASS_ENDPOINTS:
                try:
                    response = await client.post(endpoint, data={"data": query})
                    response.raise_for_status()
                    elements = response.json().get("elements", [])
                    break
                except (httpx.HTTPError, ValueError):
                    continue

        if elements is None:
            raise RuntimeError("OpenStreetMap search is unavailable")
        fetched_at = datetime.now(timezone.utc).isoformat()
        resources: list[PlaceResource] = []
        for element in elements:
            tags = element.get("tags") or {}
            place_lat = element.get("lat") or (element.get("center") or {}).get("lat")
            place_lng = element.get("lon") or (element.get("center") or {}).get("lon")
            name = tags.get("name")
            if not name or place_lat is None or place_lng is None:
                continue
            addr = " ".join(part for part in [tags.get("addr:housenumber"), tags.get("addr:street")] if part)
            address = ", ".join(part for part in [addr, tags.get("addr:city")] if part) or None
            website = tags.get("website") or tags.get("contact:website")
            if website and not website.startswith(("http://", "https://")):
                website = f"https://{website}"
            resources.append(
                PlaceResource(
                    name=name,
                    category=request.category,
                    phone=tags.get("phone") or tags.get("contact:phone"),
                    website=website,
                    address=address,
                    lat=place_lat,
                    lng=place_lng,
                    distanceKm=_distance_km(lat, lng, place_lat, place_lng),
                    hours=tags.get("opening_hours"),
                    source="osm",
                    sourceUrl=f"https://www.openstreetmap.org/?mlat={place_lat}&mlon={place_lng}#map=18/{place_lat}/{place_lng}",
                    mapsUri=f"https://www.google.com/maps/dir/?api=1&destination={place_lat},{place_lng}",
                    fetchedAt=fetched_at,
                )
            )
        resources = _rank(resources)
        await _cache.put(key, resources)
        return resources[:3]


def _rank(resources: list[PlaceResource]) -> list[PlaceResource]:
    # Google results arrive relevance-ranked; OSM results are ranked by distance.
    # Within either source, open listings come first where the provider supplied status.
    return sorted(resources, key=lambda item: (item.openNow is False, item.distanceKm or float("inf")))


class ProviderChain:
    def __init__(self) -> None:
        self.providers: list[ResourceProvider] = []
        google_key = os.getenv("GOOGLE_MAPS_API_KEY")
        if google_key:
            self.providers.append(GooglePlacesProvider(google_key))
        self.providers.append(OpenStreetMapProvider())

    async def find(self, request: NearbyRequest) -> list[PlaceResource]:
        for provider in self.providers:
            try:
                results = await provider.find(request)
            except Exception:
                # A provider outage is not a user-facing error; try the next source.
                continue
            if results:
                return results[:3]
        return [
            PlaceResource(
                name="211 local community resource directory",
                category=request.category,
                phone="211",
                website="https://www.211.org/",
                source="211",
                sourceUrl="https://www.211.org/",
                fetchedAt=datetime.now(timezone.utc).isoformat(),
            )
        ]


_nominatim_lock = asyncio.Lock()
_nominatim_last_request = 0.0


async def geocode_user_query(query: str) -> dict[str, str | float] | None:
    """One end-user initiated, coarse geocode; no query or coordinates are persisted."""
    global _nominatim_last_request
    async with _nominatim_lock:
        delay = 1.0 - (time.monotonic() - _nominatim_last_request)
        if delay > 0:
            await asyncio.sleep(delay)
        _nominatim_last_request = time.monotonic()
        async with httpx.AsyncClient(timeout=12, headers={"User-Agent": OSM_USER_AGENT}) as client:
            response = await client.get(
                NOMINATIM_ENDPOINT,
                params={"format": "jsonv2", "limit": "1", "countrycodes": "us", "q": query},
            )
            response.raise_for_status()
            hits = response.json()

    if not hits:
        return None
    hit = hits[0]
    lat, lng = _coarse(float(hit["lat"]), float(hit["lon"]))
    # Return only city/ZIP-level label and rounded coordinates; never retain precise input.
    label = str(hit.get("name") or query)[:100]
    return {"label": label, "lat": lat, "lng": lng}


def google_maps_search_url(category: str, lat: float, lng: float) -> str:
    query = SEARCH_LABELS.get(category, "community services")
    return f"https://www.google.com/maps/search/{quote_plus(query)}/@{lat:.2f},{lng:.2f},12z"
