import os
import unittest
from unittest.mock import patch

import httpx

import plan_app
from plan_app import app
from plan_models import GeneratedPlan, PlaceResource, ResourceNeed
from plan_service import _complete_steps
from resource_providers import ProviderChain


def offline_plan() -> dict:
    return {
        "title": "Temporary housing",
        "steps": [
            {
                "id": "s1",
                "title": "Find a place to stay tonight",
                "summary": "Start with somewhere safe for tonight.",
                "priority": "now",
                "dependsOn": [],
                "actions": ["Ask the shelter desk about space", "Call 211 to find another option"],
                "ideas": [],
                "resourceNeeds": [{"category": "shelter", "query": "family shelter", "why": "Find a nearby place"}],
                "resources": [],
                "category": "shelter",
                "pattern": "Needs temporary housing",
            },
            {
                "id": "s2",
                "title": "Keep a record of the damage",
                "summary": "A record helps with later aid applications.",
                "priority": "soon",
                "dependsOn": ["s1"],
                "actions": ["Write down what was damaged", "Save copies of any photos"],
                "ideas": [],
                "resourceNeeds": [{"category": "community", "query": "disaster aid", "why": "Get help planning applications"}],
                "resources": [],
                "category": "community",
                "pattern": "Needs temporary housing",
            },
        ],
    }


class PlanApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_reports_no_key_fallback(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "", "GOOGLE_MAPS_API_KEY": ""}):
            response = await self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["aiConfigured"])
        self.assertFalse(response.json()["googlePlacesConfigured"])
        self.assertTrue(response.json()["offlineFallback"])

    async def test_stream_returns_offline_plan_when_ai_is_not_configured(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            response = await self.client.post(
                "/api/plan/stream",
                json={"situation": "home damaged", "fallbackPlan": offline_plan(), "allowExternalAI": True},
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("event: fallback", response.text)
        self.assertIn('"title":"Find a place to stay tonight"', response.text)
        self.assertIn("event: complete", response.text)

    async def test_crisis_flag_blocks_plan_before_streaming(self):
        response = await self.client.post(
            "/api/plan/stream",
            json={"situation": "I am in danger", "crisisDetected": True, "fallbackPlan": offline_plan()},
        )
        self.assertEqual(response.status_code, 409)

    def test_generated_contacts_and_crisis_are_rejected(self):
        plan = {
            "title": "A next step plan",
            "assumptions": [],
            "crisis": {"detected": False, "type": None},
            "steps": [
                {
                    "id": f"s{index}",
                    "title": "Find community help",
                    "summary": "Start with a local organization.",
                    "priority": "soon",
                    "dependsOn": [f"s{index - 1}"] if index > 1 else [],
                    "actions": ["Ask a staff member where to start", "Write down the response"],
                    "ideas": [],
                    "resourceNeeds": [{"category": "community", "query": "community services", "why": "Find a nearby place"}],
                }
                for index in range(1, 5)
            ],
        }
        plan["steps"][0]["actions"][0] = "Call 555-555-0100"
        with self.assertRaises(ValueError):
            GeneratedPlan.model_validate(plan)

        plan["steps"][0]["actions"][0] = "Ask a staff member where to start"
        plan["crisis"] = {"detected": True, "type": "danger"}
        with self.assertRaises(ValueError):
            GeneratedPlan.model_validate(plan)

    def test_resource_provenance_cannot_be_llm(self):
        with self.assertRaises(ValueError):
            PlaceResource(name="Unverified place", category="food", source="llm")

    def test_model_cannot_return_email_addresses_as_resource_needs(self):
        with self.assertRaises(ValueError):
            ResourceNeed(category="food", query="food pantry", why="Email help@example.org for an appointment")

    def test_stream_parser_yields_only_complete_step_objects(self):
        buffer = '{"steps":[{"id":"s1","title":"One"},{"id":"s2","title":"Two"'
        self.assertEqual(_complete_steps(buffer), [{"id": "s1", "title": "One"}])

    async def test_provider_failure_returns_a_real_211_fallback_with_attribution(self):
        original = plan_app.resource_providers
        chain = ProviderChain()

        class FailingProvider:
            name = "test outage"

            async def find(self, request):
                raise RuntimeError("test outage")

        chain.providers = [FailingProvider()]
        plan_app.resource_providers = chain
        try:
            response = await self.client.post(
                "/api/resources/nearby",
                json={"category": "food", "query": "food pantry", "lat": 37.33, "lng": -121.89},
            )
        finally:
            plan_app.resource_providers = original
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["resources"][0]["source"], "211")
        self.assertEqual(response.json()["resources"][0]["phone"], "211")
        self.assertEqual(response.json()["attribution"], "211.org")


if __name__ == "__main__":
    unittest.main()
