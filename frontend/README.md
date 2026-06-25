# PathParallel — Frontend

Next.js 15 (App Router) + TypeScript + Tailwind frontend for PathParallel.
Covers signup/login (email + Google OAuth), the personalized feed, posting
a situation, and the situation detail page with AI-matched stories and the
PathLine visual.

This has been tested end-to-end against the live FastAPI backend — real
signup, real cookie-based auth, real situation creation, and real AI
matches, all verified working across the actual network boundary (CORS,
credentialed cookies, the works).

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# edit .env.local if your backend runs anywhere other than localhost:8000

# 3. Make sure the backend is running first (see ../backend/README.md)

# 4. Start the dev server
npm run dev
```

Visit `http://localhost:3000`.

## Google OAuth setup

The "Continue with Google" button only appears once configured — leave
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` blank in `.env.local` to hide it entirely
(useful if you just want to test email/password auth first).

To enable it:

1. In the Google Cloud Console, add `http://localhost:3000/auth/callback`
   as an Authorized redirect URI on the same OAuth client used by the
   backend (see `../backend/README.md`).
2. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` to that client's ID.
3. `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` already defaults to
   `http://localhost:3000/auth/callback` — only change it if you're
   running on a different port/domain, and make sure it's added to
   Google's authorized redirect URIs too.

Flow: clicking the button redirects to Google's consent screen
(`src/lib/googleAuth.ts` builds this URL) → Google redirects back to
`/auth/callback` with a `code` param → that page POSTs the code to the
backend's `/auth/google`, which does the actual token exchange and sets
the session cookie → redirect to `/feed`.

## What's built

- **Auth**: `/signup`, `/login` (email/password + Google OAuth),
  `/auth/callback` (OAuth redirect handler). Session state lives in an
  httpOnly cookie set by the backend — the frontend never touches the
  token directly, only a lightweight `AuthProvider` (`src/lib/auth.tsx`)
  tracking *who's* logged in for UI purposes (e.g. showing their name).
- **Feed** (`/feed`): personalized situation feed.
- **Share a situation** (`/situations/new`): the post-creation form,
  including the stage picker and an outcome field that only appears once
  "Resolved" is selected.
- **Situation detail** (`/situations/[id]`): shows the situation, its
  AI-matched stories, and the PathLine visual — a literal trail showing
  where this situation sits relative to its matches, with resolved
  stories glowing gently to signal "this is where the path leads."
- **PathLine** (`src/components/PathLine.tsx`): the project's signature
  visual. Worth understanding if you're explaining this project in an
  interview — it's a direct visualization of the matching engine's
  stage-proximity logic, not just decoration.

## Design system

Dusk palette (`ink`/`paper`/`amber`/`sage`/`slate` in `tailwind.config.js`)
rather than a generic dark-mode default — deliberately warm, not clinical,
given the subject matter. Fraunces (serif, for situation text and
headlines) + Inter (UI) + JetBrains Mono (stage labels/metadata, small
caps, tracked out — like trail markers). See `tailwind.config.js` for the
full token set.

## Known issues / things to check yourself

- **Visual QA not done, and fonts couldn't be verified in the build
  sandbox**: this was built and verified for correct compilation, types,
  and live data-fetching against the real backend — including a genuine
  end-to-end test with both servers running together (real signup, real
  cookie-based auth, real situation creation, real AI matches, all over
  actual CORS). What could *not* be verified here: `fonts.googleapis.com`
  was unreachable in the sandboxed build environment, so `npm run build`
  with the real font-enabled layout fails there specifically on the font
  fetch step (confirmed twice, not a fluke). This is a sandbox network
  restriction, not a code problem — `next/font/google` is the standard,
  correct approach and will work normally on your machine, on Vercel, or
  anywhere with normal internet access. Every other check (TypeScript,
  all 8 routes, component structure) passed cleanly when fonts were
  swapped for system fonts to isolate the issue. Run `npm run dev`
  yourself and actually look at the result before considering the visual
  design "done" — spacing, contrast, and mobile responsiveness haven't
  been eyeballed by anyone yet.
- **`useSearchParams()` Suspense boundary**: `/auth/callback` originally
  failed `next build` outright (not just a dev warning) because
  `useSearchParams()` needs a Suspense boundary for static prerendering
  in the App Router. Fixed by splitting the page into an inner component
  wrapped in `<Suspense>` — see the comment in that file. If you add
  other pages using `useSearchParams()`, watch for the same issue; `npm
  run dev` won't catch it, only `npm run build` will.
- **Next.js version**: pinned to `15.5.19`, not `15.0.x` as originally
  specced. `15.0.3` shipped with a critical RCE (CVE-2025-66478), and
  npm's own audit recommends `15.5.19` as the version with all known
  advisories patched. Don't downgrade without checking
  `npm audit` first.
- **Residual moderate vuln**: `npm audit` reports a moderate XSS-in-CSS-
  output advisory in a `postcss@8.4.31` copy bundled *inside* Next.js's
  own internals (not the top-level `postcss@8.5.15` this project actually
  uses for Tailwind). The only "fix" npm suggests is downgrading Next.js
  to v9, which is wrong — left as-is, low real-world exploitability for a
  student project, but worth knowing it's there.
