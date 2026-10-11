from __future__ import annotations

import json
import os
import re
from collections.abc import AsyncIterator
from typing import Any

from plan_models import GeneratedPlan, GeneratedStep, PlanRequest, PlanResponse, PlanStep, ResourceNeed


SYSTEM_PROMPT = """You make calm, practical post-disaster logistics plans for people who are already safe.
The user's situation has already passed an immediate-danger safety check. If crisisDetected is true,
do not plan; the caller must show its safety response instead.

Return 4 to 7 ordered steps. Put the most time-sensitive step first. Each step must have 2 to 4
concrete, verb-first actions and at least one resourceNeed. Add 0 to 4 short ideas that make a step
easier. Tailor wording to the facts and the known situation hints. Keep actions feasible and
non-judgmental. Avoid legal, medical, or eligibility certainty; state uncertainty as an assumption.
Use only the allowed resource categories in the schema. Resource needs describe the kind of place
to search for; they are not contact details.

Never invent or output phone numbers, email addresses, URLs, street addresses, organization names,
or named local services. Those are supplied separately by trusted resource providers. Never include
medical advice. Do not repeat sensitive details unnecessarily. The output must match the supplied
structured schema exactly."""


def fallback_response(request: PlanRequest) -> PlanResponse | None:
    raw = request.fallbackPlan
    if not raw:
        return None

    steps: list[PlanStep] = []
    for index, item in enumerate(raw.get("steps", [])):
        category = item.get("category", "community")
        title = str(item.get("title", "Next step"))
        needs = item.get("resourceNeeds") or [
            {"category": category, "query": title, "why": str(item.get("summary", title))[:240]}
        ]
        steps.append(
            PlanStep(
                id=str(item.get("id", f"s{index + 1}")),
                title=title,
                summary=str(item.get("summary", title)),
                priority=item.get("priority", "later"),
                dependsOn=item.get("dependsOn", [f"s{index}"] if index else []),
                actions=item.get("actions", []),
                ideas=item.get("ideas", [item["tip"]] if item.get("tip") else []),
                resourceNeeds=needs,
                resources=[],  # Contact details are always provider-sourced.
                category=category,
                pattern=item.get("pattern"),
            )
        )
    if not steps:
        return None

    return PlanResponse(
        title=str(raw.get("title", "Your next steps")),
        assumptions=raw.get("assumptions", []),
        crisis={"detected": False, "type": None},
        steps=steps,
        source="offline-fallback",
    )


def _complete_steps(buffer: str) -> list[dict[str, Any]]:
    match = re.search(r'"steps"\s*:\s*\[', buffer)
    if not match:
        return []
    decoder = json.JSONDecoder()
    position = match.end()
    found: list[dict[str, Any]] = []
    while position < len(buffer):
        while position < len(buffer) and (buffer[position].isspace() or buffer[position] == ","):
            position += 1
        if position >= len(buffer) or buffer[position] == "]":
            break
        try:
            value, end = decoder.raw_decode(buffer, position)
        except json.JSONDecodeError:
            break
        if not isinstance(value, dict):
            break
        found.append(value)
        position = end
    return found


async def stream_generated_plan(request: PlanRequest) -> AsyncIterator[tuple[str, Any]]:
    """Yield complete, schema-checked steps while retaining a final full-plan validation."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or not request.allowExternalAI:
        return

    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        return

    user_message = json.dumps(
        {
            "situation": request.situation,
            "situationHints": request.situationHints,
            "crisisDetected": request.crisisDetected,
        },
        ensure_ascii=False,
    )
    retry_note = ""
    async with AsyncAnthropic(api_key=api_key) as client:
        for attempt in range(2):
            if attempt:
                yield "reset", {"message": "Rechecking the plan format…"}
                retry_note = "The previous output did not validate. Follow the schema exactly."
            partial = ""
            emitted = 0
            seen_ids: set[str] = set()
            try:
                async with client.messages.stream(
                    model=os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5"),
                    max_tokens=6000,
                    system=f"{SYSTEM_PROMPT}\n{retry_note}",
                    messages=[{"role": "user", "content": user_message}],
                    output_format=GeneratedPlan,
                ) as stream:
                    async for text_delta in stream.text_stream:
                        partial += text_delta
                        complete_steps = _complete_steps(partial)
                        for step in complete_steps[emitted:]:
                            parsed = GeneratedStep.model_validate(step)
                            if parsed.id != f"s{emitted + 1}" or any(dependency not in seen_ids for dependency in parsed.dependsOn):
                                raise ValueError("Steps must arrive in order and depend only on prior steps")
                            seen_ids.add(parsed.id)
                            yield "step", parsed.model_dump(by_alias=True)
                            emitted += 1
                    message = await stream.get_final_message()
                parsed_plan = getattr(message, "parsed_output", None)
                if not isinstance(parsed_plan, GeneratedPlan):
                    parsed_plan = GeneratedPlan.model_validate(parsed_plan)
                yield "complete", generated_response(parsed_plan).model_dump(by_alias=True)
                return
            except Exception:
                # Do not log prompts or model output: both contain sensitive situation details.
                if attempt == 1:
                    return


def generated_response(plan: GeneratedPlan) -> PlanResponse:
    steps = [
        PlanStep(
            **step.model_dump(by_alias=True),
            resources=[],
            category=step.resourceNeeds[0].category,
        )
        for step in plan.steps
    ]
    return PlanResponse(
        title=plan.title,
        assumptions=plan.assumptions,
        crisis={"detected": False, "type": None},
        steps=steps,
        source="ai",
    )
