# Signal

Built for Hyphen Hacks 2026. Theme: Crafting Constellations.

## What it does

After a disaster, someone who is already safe describes their situation in plain words ("I evacuated with my two kids. Their school is closed and we ran out of diapers."). Signal turns that into a plan: ordered steps, each with concrete ways to get it done and where to go. The plan is drawn as a constellation. Each step is a star, and the stars are joined in order.

Signal is not for active emergencies. If you are in immediate danger, call 911.

## How it works

1. `frontend/src/safetyChecks.ts` checks for immediate danger first. A match blocks planning and shows urgent help options before any server request.
2. `frontend/src/matcher.ts` and `frontend/src/situationPatterns.ts` explainably match facts to known situations. `frontend/src/plan.ts` turns confirmed matches and `resourceContent.ts` into an ordered offline plan.
3. The **Action list** shows the complete order, why each step matters, concrete actions and practical ideas. The constellation is another way to explore the same plan; selecting a star opens its checklist.
4. **Tailor steps with AI** is optional. Only after someone selects it does the browser send their situation to the backend. The server uses Anthropic structured output and rejects generated contact details. The pattern-based plan stays available if AI is unavailable.
5. Optional location lookup and nearby resources go through the backend. Google Places is used when configured, OpenStreetMap is the no-key provider fallback, and a 211 referral is used if both fail. Contacts come from providers or the checked `frontend/src/nationalResources.ts` file, never from the model.

Styles and design tokens are all in `frontend/src/index.css`.

## How to run

Start the API from one terminal:

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn plan_app:app --reload --port 8000
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev    # open the URL it prints, usually http://localhost:5173
npm test       # runs the matcher, safety and plan tests
```

The pattern-based action plan works without keys. Nearby lookups use OpenStreetMap without keys. Add `ANTHROPIC_API_KEY` to `backend/.env` to enable AI tailoring; add `GOOGLE_MAPS_API_KEY` to use Google Places before the OSM fallback. Keys stay server-side. Set `VITE_SIGNAL_API_URL` to use a different API host.

See `STATUS.md` for what works, a demo script and known limitations.

## Tech stack

TypeScript, React, Vite, FastAPI, Pydantic, Anthropic SDK (optional) and HTTPX. The deterministic matcher remains the instant offline plan and safety pre-classifier; AI tailoring is opt-in and contact details are fetched separately from providers.

## Team

- Rohin Pidathala
- Ritik Pradhan
- Roshan Challa
