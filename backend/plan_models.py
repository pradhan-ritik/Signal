from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ResourceCategory = Literal[
    "shelter", "food", "childcare", "pets", "government", "bank", "lodging",
    "fuel", "transit", "seniors", "equipment", "post", "community",
]
Priority = Literal["now", "soon", "later"]
ResourceSource = Literal["google", "osm", "211", "curated"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ResourceNeed(StrictModel):
    category: ResourceCategory
    query: str = Field(min_length=2, max_length=120)
    why: str = Field(min_length=2, max_length=240)

    @model_validator(mode="after")
    def reject_contact_details(self) -> "ResourceNeed":
        if _contains_contact_details(f"{self.query} {self.why}"):
            raise ValueError("Resource needs must not contain provider contact details")
        return self


class CrisisStatus(StrictModel):
    detected: bool
    type: str | None


class GeneratedStep(StrictModel):
    id: str = Field(pattern=r"^s[1-7]$")
    title: str = Field(min_length=3, max_length=100)
    summary: str = Field(min_length=5, max_length=360)
    priority: Priority
    dependsOn: list[str] = Field(max_length=6)
    actions: list[str] = Field(min_length=2, max_length=4)
    ideas: list[str] = Field(max_length=4)
    resourceNeeds: list[ResourceNeed] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def reject_contacts_and_bad_dependencies(self) -> "GeneratedStep":
        text = " ".join([self.title, self.summary, *self.actions, *self.ideas])
        if _contains_contact_details(text):
            raise ValueError("Generated plan text must not contain contact details")
        if self.id in self.dependsOn:
            raise ValueError("A step cannot depend on itself")
        return self


class GeneratedPlan(StrictModel):
    title: str = Field(min_length=3, max_length=90)
    assumptions: list[str] = Field(max_length=5)
    crisis: CrisisStatus
    steps: list[GeneratedStep] = Field(min_length=4, max_length=7)

    @model_validator(mode="after")
    def validate_steps_and_safety(self) -> "GeneratedPlan":
        if self.crisis.detected or self.crisis.type is not None:
            raise ValueError("A generated plan cannot replace the safety response")
        seen: set[str] = set()
        for index, step in enumerate(self.steps, start=1):
            expected_id = f"s{index}"
            if step.id != expected_id:
                raise ValueError("Steps must have sequential ids")
            if any(dependency not in seen for dependency in step.dependsOn):
                raise ValueError("Steps may depend only on earlier steps")
            seen.add(step.id)
        if _contains_contact_details(self.title) or any(_contains_contact_details(item) for item in self.assumptions):
            raise ValueError("Generated plan text must not contain contact details")
        return self


_CONTACT_PATTERN = re.compile(
    r"(?:https?://|www\.|\b[a-z0-9-]+\.(?:com|org|net|gov)\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?\d[\d().\-\s]{5,}\d))",
    re.IGNORECASE,
)


def _contains_contact_details(value: str) -> bool:
    return bool(_CONTACT_PATTERN.search(value))


class PlaceResource(StrictModel):
    name: str = Field(min_length=1, max_length=180)
    category: str = Field(min_length=1, max_length=60)
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    distanceKm: float | None = None
    hours: str | None = None
    openNow: bool | None = None
    source: ResourceSource
    sourceUrl: str | None = None
    mapsUri: str | None = None
    fetchedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PlanStep(StrictModel):
    id: str
    title: str
    summary: str
    priority: Priority
    dependsOn: list[str]
    actions: list[str]
    ideas: list[str]
    resourceNeeds: list[ResourceNeed]
    resources: list[PlaceResource] = Field(default_factory=list)
    category: ResourceCategory = "community"
    pattern: str | None = None


class PlanResponse(StrictModel):
    title: str
    assumptions: list[str] = Field(default_factory=list)
    crisis: CrisisStatus = Field(
        default_factory=lambda: CrisisStatus(detected=False, type=None)
    )
    steps: list[PlanStep]
    source: Literal["ai", "offline-fallback"]


class PlanRequest(StrictModel):
    situation: str = Field(min_length=1, max_length=8000)
    allowExternalAI: bool = False
    crisisDetected: bool = False
    situationHints: list[str] = Field(default_factory=list, max_length=10)
    # Created by the existing client-side matcher from situationPatterns.ts.
    # The offline matcher remains the source of truth when AI is declined or unavailable.
    fallbackPlan: dict | None = None


class NearbyRequest(StrictModel):
    category: ResourceCategory
    query: str = Field(min_length=2, max_length=120)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class LocationSearchRequest(StrictModel):
    query: str = Field(min_length=2, max_length=100)


class CoarseLocation(StrictModel):
    label: str
    lat: float
    lng: float
