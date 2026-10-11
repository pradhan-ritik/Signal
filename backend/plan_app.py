from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Load server-only settings before constructing providers or reading the model name.
load_dotenv(Path(__file__).with_name(".env"))

from plan_models import LocationSearchRequest, NearbyRequest, PlanRequest
from plan_service import fallback_response, stream_generated_plan
from resource_providers import ProviderChain, geocode_user_query, google_maps_search_url

app = FastAPI(title="Signal Plan API", version="0.1.0")
origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

resource_providers = ProviderChain()


def _sse(event: str, payload: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}\n\n"


@app.get("/api/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "aiConfigured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "googlePlacesConfigured": bool(os.getenv("GOOGLE_MAPS_API_KEY")),
        "offlineFallback": True,
    }


@app.post("/api/plan/stream")
async def plan_stream(request: PlanRequest) -> StreamingResponse:
    # The browser runs safetyChecks.ts before making this request. Keep a second
    # guard here so a client can never accidentally ask the model to plan a crisis.
    if request.crisisDetected:
        raise HTTPException(status_code=409, detail="Safety check stopped plan generation.")
    fallback = fallback_response(request)
    if fallback is None:
        raise HTTPException(status_code=422, detail="The offline matcher did not provide a usable fallback plan.")

    async def events():
        completed = False
        emitted_steps = False
        try:
            async for event, payload in stream_generated_plan(request):
                if event == "step":
                    emitted_steps = True
                if event == "complete":
                    completed = True
                yield _sse(event, payload)
        except Exception:
            # Do not return exception text: SDK errors can contain request details.
            pass

        if not completed:
            if emitted_steps:
                yield _sse("reset", {"message": "Using the offline plan instead."})
            yield _sse("fallback", {"message": "Showing the offline plan from Signal's known patterns."})
            for step in fallback.steps:
                yield _sse("step", step.model_dump(by_alias=True))
            yield _sse("complete", fallback.model_dump(by_alias=True))

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@app.post("/api/resources/nearby")
async def nearby_resources(request: NearbyRequest) -> dict[str, Any]:
    # Coarsen again on the server even if the browser already rounded its location.
    lat, lng = round(request.lat, 2), round(request.lng, 2)
    coarse_request = request.model_copy(update={"lat": lat, "lng": lng})
    resources = await resource_providers.find(coarse_request)
    source = resources[0].source if resources else None
    attribution = {
        "google": "Google",
        "osm": "© OpenStreetMap contributors",
        "211": "211.org",
        "curated": "Signal verified directory",
    }.get(source, "Resource provider")
    return {
        "resources": [resource.model_dump(by_alias=True) for resource in resources[:3]],
        "moreNearbyUrl": google_maps_search_url(request.category, lat, lng),
        "attribution": attribution,
    }


@app.post("/api/location/search")
async def location_search(query: LocationSearchRequest) -> dict[str, Any]:
    # City or ZIP only; reject freeform situation text before it reaches Nominatim.
    value = query.query.strip()
    if not 2 <= len(value) <= 100 or len(value.split()) > 6:
        raise HTTPException(status_code=422, detail="Enter a city or ZIP code only.")
    if not all(character.isalnum() or character in " -,'." for character in value):
        raise HTTPException(status_code=422, detail="Enter a city or ZIP code only.")
    place = await geocode_user_query(value)
    if place is None:
        raise HTTPException(status_code=404, detail="That city or ZIP code could not be found.")
    return place
