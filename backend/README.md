# PathParallel — Backend

FastAPI + PostgreSQL backend for PathParallel: auth (including Google
OAuth), situations with timeline updates, AI-powered matching, a
personalized feed, and follow/react engagement. All endpoints below have
been tested end-to-end against a live Postgres instance, including a
full run from a completely fresh clone (dropped DB, wiped vector store,
no `.env`).

## Setup

```bash
# 1. Create a virtualenv (recommended)
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET at minimum to get started

# 4. Make sure Postgres is running and the database exists
#    e.g. createdb pathparallel

# 5. Run migrations
alembic upgrade head

# 6. Start the server
uvicorn app.main:app --reload
```

API docs (Swagger UI) are at `http://localhost:8000/docs` once running.

## What's built so far

- **Auth**: signup, login, logout via email/password, plus Google OAuth
  (`POST /auth/google` — see below). JWT stored in an httpOnly cookie
  (not localStorage) to avoid XSS token theft.
- **Situations**: create, fetch (with full timeline), add timeline updates,
  react, follow/unfollow. Ownership is enforced — only the creator can add
  updates to their own situation.
- **AI Matching** (`GET /situations/{id}/matches`): the core feature. Finds
  situations of the same type and re-ranks them using:
  `score = 0.5*similarity + 0.3*stage_proximity + 0.2*outcome_boost`.
  See `app/services/matching.py` for the full logic and rationale — this
  is the part worth explaining in interviews, since it's a deliberate
  design choice on top of plain vector search, not just an API call.
- **Feed** (`GET /feed`): personalized, not a global firehose. Scoped to
  situation types the user has personally posted in, plus anything they
  explicitly follow (which is always included regardless of type or age —
  following something is a promise the user will see it). Falls back to
  general recent activity for new users with no posts/follows yet, or
  users who only follow things but haven't posted themselves. See
  `app/routers/feed.py` for the full ranking logic.
- **Schema**: `users`, `situations`, `situation_updates`, `reactions`,
  `follows` — all migrated and tested against a live Postgres instance.

## Google OAuth setup

1. Create OAuth credentials in the Google Cloud Console (APIs & Services
   → Credentials → OAuth Client ID, type "Web application").
2. Add your frontend's callback URL (e.g. `http://localhost:3000/auth/callback`)
   to "Authorized redirect URIs".
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
4. Frontend flow: redirect the user to Google's consent screen, receive
   the `code` query param on your callback page, then POST it here:

```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"code":"<code from Google redirect>","redirect_uri":"http://localhost:3000/auth/callback"}'
```

`redirect_uri` must exactly match what initiated the consent flow, or
Google will reject the exchange. If an account with the same email
already exists (e.g. signed up with a password), Google sign-in links to
that existing account rather than creating a duplicate.

## What's not built yet

- Comments/threads on situations (deliberately cut from MVP scope — see
  the original project plan for rationale)
- Push/email notifications when a followed situation updates

## AI Matching — setup details

Two embedding providers are supported, switchable via `EMBEDDING_PROVIDER`
in `.env`:

- `openai` (default, for real use) — calls OpenAI's `text-embedding-3-small`.
  Requires `OPENAI_API_KEY`.
- `local` — a deterministic, dependency-free fallback used for offline
  dev/testing without API costs or network access. **Not semantically
  meaningful** the way a real embedding model is (it can't tell "lost my
  job" and "got laid off" mean similar things) — only use it to verify the
  pipeline plumbing works, not to judge match quality.

Vector storage is Chroma, running embedded and persisted to
`CHROMA_PERSIST_DIR` (default `./chroma_data`). **Important deployment
note**: most free-tier hosts (Railway, Render) don't guarantee persistent
local disk across deploys/restarts unless you explicitly attach a volume.
Postgres is the real source of truth for situation content, so losing the
Chroma disk is recoverable, not data loss — run the backfill script below
to rebuild the index from Postgres.

```bash
# Rebuild the entire vector index from Postgres (e.g. after a fresh
# deploy, after wiping chroma_data/, or if the two stores ever drift)
python -m app.services.backfill_embeddings
```

You may see `Failed to send telemetry event ... capture() takes 1
positional argument but 3 were given` in stderr — this is a known
chromadb 0.5.x bug in its anonymized telemetry reporting, not a real
error. It doesn't affect indexing or search; safe to ignore.

## Testing the API manually

```bash
# Signup (saves cookie)
curl -c cookies.txt -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","display_name":"Your Name"}'

# Create a situation (uses saved cookie)
curl -b cookies.txt -X POST http://localhost:8000/situations \
  -H "Content-Type: application/json" \
  -d '{"situation_type":"job_search","stage":"in_it","body_text":"..."}'
```

## Notes on design decisions

- `situations` and `situation_updates` are separate tables on purpose — the
  situation is the container, updates are timeline events. This is what
  lets the matching engine reason about trajectory, not just a single
  snapshot.
- The feed deliberately treats "follow" as a stronger signal than type-
  matching or recency: a followed situation is always included and gets
  an explicit ranking boost, regardless of how old it is. An earlier
  version only included followed items when they also matched the user's
  own situation types or fell within the recency window — which meant a
  user who followed one old situation outside their own type would see a
  feed that collapsed to just that one item. Fixed by always unioning in
  followed situations and giving them their own boost in `_feed_score`.
- Auth uses passlib + bcrypt. If you see a `password cannot be longer than
  72 bytes` error on signup, it's a known passlib/bcrypt version
  incompatibility — `bcrypt==4.0.1` (pinned in requirements.txt) avoids it.
  Don't upgrade bcrypt past 4.0.x without checking passlib compatibility first.
