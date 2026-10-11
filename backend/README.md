# Signal API

The FastAPI entry point for optional AI tailoring, coarse location search and nearby resources is `plan_app:app`.

## Run locally

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn plan_app:app --reload --port 8000
```

Run the frontend separately from `frontend/` with `npm install && npm run dev`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | No | Enables Anthropic generation after the user chooses “Tailor steps with AI”. |
| `CLAUDE_MODEL` | No | Model id; defaults to `claude-sonnet-5-5`. |
| `GOOGLE_MAPS_API_KEY` | No | Uses Google Places Text Search before the OpenStreetMap provider. |
| `FRONTEND_ORIGINS` | No | Comma-separated CORS allowlist; defaults to Vite localhost origins. |
| `OSM_USER_AGENT` | No | Identifiable User-Agent for server requests to public OSM services. |

Keys belong only in `backend/.env`; never use a `VITE_` prefix for a secret.

## Data flow and fallbacks

- The browser runs its immediate safety check and pattern matcher first. It sends no request for an active-emergency result.
- The pattern-based plan is shown immediately and stays available without any key. AI tailoring is a separate, user-initiated request to `POST /api/plan/stream`; complete schema-checked steps arrive as SSE events. If the key is missing, the call fails, or output validation fails twice, the stream returns the local fallback plan.
- `POST /api/location/search` returns only rounded US city/ZIP coordinates. `POST /api/resources/nearby` rounds coordinates again, then tries Google Places when configured, OpenStreetMap next, and the curated 211 contact if no map result is available.
- The in-memory provider cache uses a 24-hour TTL. Location queries and situation text are not logged or saved by this API. Past situations and checklist state remain in browser local storage.
- A 211 data-platform API is not configured; the fallback is the national 211 referral, not a verified list of local agencies. Map listings can be incomplete or stale, so the UI preserves the official help lines and provider source for follow-up.

Run backend checks with `uv run python -m unittest -v test_plan_api.py`.
