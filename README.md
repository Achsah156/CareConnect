# PathParallel — A Learning Journal

This README is written differently from a typical project README. Instead of
just listing setup steps, it walks through **what this project is, why every
major decision was made, what broke along the way, and what to actually
learn from each piece.** Treat it as a guided tour you can revisit whenever
you want to remind yourself how something works — or explain it in an
interview.

---

## 1. What PathParallel actually is

**The idea:** when someone is going through something hard — job rejection,
grief, burnout, relocation — the thing that helps most isn't generic advice.
It's finding someone who was at the *exact same stage* of the *exact same
situation*, and seeing what happened to them next.

**The technical translation of that idea:** a peer-matching app where the
ranking signal isn't just "similar text" (that's what every basic AI app
does) but "similar text + similar stage in the journey + bonus weight if
they made it through." That extra layer is the one piece of this project
that's genuinely yours to explain in an interview — not "I called the OpenAI
API," but "I designed a re-ranking system on top of it."

**The four-stage model**, used everywhere in this app:
`just_started → in_it → turning_point → resolved`

Every situation someone posts sits at one of these stages. The matching
engine and the feed both use this as a first-class signal, not an
afterthought.

---

## 2. The architecture, and why each piece exists

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Next.js     │  HTTPS  │   FastAPI    │         │  PostgreSQL │
│  (Vercel)    │ ──────> │   (Render)   │ ──────> │  (Render)   │
└─────────────┘         └──────────────┘         └─────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   ChromaDB    │  (vector index, rebuilt
                         │ (local disk)  │   from Postgres on boot)
                         └──────────────┘
```

**Why Next.js for the frontend?** It's the most common React framework in
real job postings right now, and the App Router (the `src/app/` folder
structure) is the current standard way to build with it — learning it here
is directly transferable.

**Why FastAPI for the backend?** Three reasons worth understanding, not just
accepting: (1) it auto-generates interactive API docs at `/docs` from your
code, which is genuinely useful for testing without building a frontend
first; (2) it uses Python type hints to validate incoming requests
automatically (that's what `pydantic` schemas are doing); (3) it's async by
default, which matters once you're calling external APIs like OpenAI.

**Why PostgreSQL?** It's a relational database — data is stored in tables
with defined relationships (a `Situation` belongs to a `User`, an `Update`
belongs to a `Situation`). This project's data is naturally relational
(users have situations, situations have updates), so a relational database
is the right tool. Compare this to a NoSQL database like MongoDB, which
would be a better fit for less structured, more document-like data.

**Why a separate vector database (Chroma)?** Postgres is excellent at exact
matches ("find the situation with this ID") but bad at *semantic* similarity
("find situations that mean something similar to this text"). Vector
databases store embeddings — long lists of numbers that represent meaning —
and can quickly find the "nearest" embeddings to a query. This is the
foundational concept behind almost all modern AI search/recommendation
features.

---

## 3. The backend, piece by piece

### 3.1 Models (`app/models/`) — the shape of your data

Each file defines a Python class that SQLAlchemy turns into a real database
table. Key relationships:

- `User` → has many `Situation`s
- `Situation` → has many `SituationUpdate`s (the timeline)
- `Situation` → has many `Reaction`s and can be `Follow`ed

**Worth understanding:** `Situation` and `SituationUpdate` are deliberately
separate tables. The situation is the container; updates are individual
timeline entries. This is a normalization decision — instead of overwriting
a single "current stage" field and losing history, every change is its own
row. This is what makes a real timeline UI possible, and it's a pattern
worth recognizing: **whenever you want history, don't overwrite — append.**

### 3.2 Schemas (`app/schemas/`) — the shape of your API

These are `pydantic` classes, and they do something different from models:
models define your *database* shape, schemas define your *API* shape. They
often look similar but serve different jobs — a schema can hide fields
(like `password_hash`) that exist in the model but should never be sent to
a client. This separation is a core API design principle: **never expose
your database schema directly as your API contract.**

### 3.3 The matching engine (`app/services/matching.py`) — the core idea

This is the file most worth reading slowly. The flow:

1. Convert the situation's text into an **embedding** (a vector of numbers)
   using OpenAI's embedding model.
2. Ask Chroma for the most similar embeddings, filtered to the same
   `situation_type` (so a job-search post never gets compared to a grief
   post just because the words happen to overlap).
3. **Re-rank** the results using a formula, not just raw similarity:

   ```
   score = 0.5 × similarity + 0.3 × stage_proximity + 0.2 × outcome_boost
   ```

   - `similarity`: how semantically close the text is (from Chroma)
   - `stage_proximity`: how close the candidate's stage is to yours — and
     deliberately *asymmetric*: someone slightly ahead of you on the path
     is weighted higher than someone slightly behind, because seeing what's
     next is more valuable than seeing someone equally stuck
   - `outcome_boost`: situations with a resolved outcome get weighted
     higher, because they're the ones that actually answer "what happens
     next?"

**The learning point here:** AI features are rarely just "call the model and
return what it says." The interesting engineering is almost always in the
layer *around* the model call — deciding what signals matter, how to
combine them, and why. This file is proof you did that, not just plumbing.

### 3.4 Auth (`app/routers/auth.py`, `app/core/security.py`)

A few concepts worth locking in:

- **Passwords are never stored directly** — `hash_password()` runs them
  through bcrypt, a one-way function. You can check if a password is
  correct (`verify_password`) but can never reverse a hash back to the
  original password. This is why a data breach of hashed passwords is
  recoverable, but a breach of plaintext passwords is catastrophic.
- **JWT (JSON Web Token)**: after login, the server creates a signed token
  containing the user's ID and an expiry time. The signature means the
  server can verify the token wasn't tampered with, without needing to
  look it up in a database every time.
- **httpOnly cookies**: the token is stored in a cookie that JavaScript
  *cannot read* (that's what `httponly` means). This is a deliberate
  defense against XSS attacks — even if malicious JS somehow ran on your
  page, it couldn't steal the token, because it can't access it at all.

### 3.5 The `SameSite` cookie bug — a real lesson in browser security

This actually happened during deployment, and it's worth understanding
properly because it's a classic, very common gotcha.

**What happened:** login succeeded, but every subsequent request (like
loading `/feed`) came back `401 Unauthorized` — even though the cookie had
clearly been set. The fix was changing `SameSite=Lax` to `SameSite=None;
Secure` in production.

**Why this happens:** browsers classify a request as *cross-site* if the
page's domain and the API's domain don't match — which is exactly the case
once your frontend is on `vercel.app` and your backend is on
`onrender.com`. `SameSite=Lax` (a sensible default) blocks cookies from
being sent on cross-site `fetch()`/XHR calls — it only allows them on
top-level navigation (clicking a link). So the cookie got set, but the
browser refused to send it back on the next API call.

`SameSite=None` removes that restriction, but browsers require `Secure`
(HTTPS-only) on any cookie that uses `None`, as a safety tradeoff for
relaxing the cross-site protection.

**The general lesson:** *"works on localhost" and "works in production" are
not the same claim* when your frontend and backend are on different
domains. Always check cookie/CORS behavior specifically once you deploy to
separate domains — it's one of the most common "works on my machine" traps.

### 3.6 CORS — the other half of the cross-origin story

`CORS_ORIGINS` in your backend's environment variables tells the browser
which frontend domains are allowed to make requests to your API at all.
Without the right CORS headers, the browser blocks the response before your
JavaScript ever sees it — a *different* mechanism from the cookie issue
above, but one that shows up in the same kinds of deployments. Both CORS
and `SameSite` exist for the same underlying reason: browsers are
defending users against malicious websites making requests on their
behalf without consent. Understanding *why* these exist makes them much
easier to debug than memorizing "set this header."

---

## 4. The frontend, piece by piece

### 4.1 The App Router structure

Each folder under `src/app/` becomes a URL route. `src/app/situations/[id]/page.tsx`
becomes the dynamic route `/situations/:id` — the `[id]` part captures
whatever's in the URL and makes it available via `useParams()`.

### 4.2 Why a typed API client (`src/lib/api.ts`)

Every backend endpoint has a matching TypeScript function and return type
in this one file, instead of scattering raw `fetch()` calls across every
page. The payoff: if the backend's response shape ever changes, TypeScript
will flag every place in the frontend that assumed the old shape — *before*
you ship a bug, not after.

### 4.3 `credentials: "include"` — the detail that makes auth work at all

Every request in `api.ts` includes `credentials: "include"`. Without this
single option, the browser would never attach the auth cookie to *any*
request, no matter how correctly the backend set it. This is the frontend
half of the cookie story above — both sides have to cooperate for
cross-origin cookie auth to work.

### 4.4 The PathLine component — turning a backend concept into a UI

`src/components/PathLine.tsx` is a direct visualization of the
`stage_proximity` idea from the matching engine: a horizontal line with a
dot for "you" and dots for each match, positioned by stage. This is a
useful general pattern: **when a backend has an interesting internal
concept, look for a way to make it visible, not just a number in a card.**
It's also a good interview point — it shows the matching logic isn't a
black box even to the people using the app.

---

## 5. Deployment — the concepts behind the steps

If you only remember the click-sequence, you'll be lost the next time you
deploy something. Here's what was actually happening at each stage:

- **Separate frontend/backend deploys** (Vercel + Render) mean your app is
  really two services talking over the public internet, not one program.
  Everything in sections 3.5–3.6 exists *because* of this split.
- **Environment variables** are how secrets and per-environment config
  (database URLs, API keys, CORS origins) get into your running app without
  ever being committed to git. `.env` files are for local dev only and are
  gitignored on purpose — if a real secret ever ends up in git history,
  treat it as compromised and rotate it, even after deleting the commit.
- **Ephemeral filesystems**: Render's free tier wipes local disk on every
  restart. This is why `backfill_embeddings.py` exists — it rebuilds the
  Chroma vector index from Postgres (the real source of truth) every time
  the server starts, rather than assuming the index survives. **General
  lesson**: in any system with a "derived" data store (a cache, an index, a
  vector DB) and a "source of truth" store, always be able to rebuild the
  derived one from the source — don't let it become a second source of
  truth by accident.
- **Free-tier cold starts**: Render's free web services sleep after
  inactivity and take time to wake up. This isn't a bug to fix — it's a
  tradeoff of free hosting worth knowing about so you're not confused by it
  during a demo.

---

## 6. Bugs that happened, and what they actually teach

It's tempting to scrub a project history of its mistakes, but the debugging
process is some of the most transferable learning here. Quick log:

| Bug | Root cause | What it teaches |
|---|---|---|
| `passlib`/`bcrypt` signup crash | Newer `bcrypt` versions broke an internal version-detection probe in `passlib` | Pin dependency versions deliberately; "latest" isn't always safe |
| Pydantic validation crash on `/matches` | Tried to construct a response object with required fields missing, then assign them after | Pydantic validates *at construction time* — build the full object in one step |
| `next build` failing on `/auth/callback` | `useSearchParams()` needs a `<Suspense>` boundary for static prerendering | Production builds catch things `next dev` doesn't — always test the real build before deploying |
| Feed collapsing to one item after following something | Followed items were only included if they also matched the user's own situation type or recency window | When adding a new signal (follows) to existing logic, check what happens when *only* the new signal is present, not just the common case |
| `pydantic-core` failing to build on Render | Render defaulted to a very new Python version with no precompiled wheel available | Pin your runtime version explicitly in any deployment — don't assume the host's default matches what you tested against |
| `runtime.txt` silently ignored | Render deprecated that file in favor of `.python-version` / a `PYTHON_VERSION` env var | Read the *current* docs for your host, not older tutorials — deployment platforms change config conventions over time |
| Login succeeded but `/feed` always 401'd | `SameSite=Lax` cookie blocked on cross-site requests once frontend/backend were on separate domains | Cross-origin auth has sharp edges that only appear once you deploy to separate domains — see section 3.5 |

---

## 7. Ideas for extending this, if you want to keep learning

- Add comments/threads (deliberately cut from MVP) — this would test your
  understanding of nested data and moderation concerns.
- Add a "why this match" explanation on each matched card, showing the
  actual `similarity` / `stage_proximity` / `outcome_boost` numbers — good
  practice in making an opaque AI feature legible to users.
- Swap the local embedding fallback for a real second provider (e.g.
  Cohere or a local sentence-transformers model) behind the same
  `EmbeddingProvider` interface — a good exercise in the *adapter pattern*.
- Add rate limiting to `/auth/login` — a real security gap in the current
  build, and a good intro to brute-force protection.

---

*This file is meant to be read again later, not just once now. If something
above doesn't make sense yet, that's fine — come back to it once you've sat
with the code a bit more.*
