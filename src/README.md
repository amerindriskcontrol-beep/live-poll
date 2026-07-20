# AMERIND Live Poll

Real-hosted version of the training poll tool — same UI and features as the
Claude artifact build, but backed by Supabase instead of Claude's artifact
storage, so it can run on Cloudflare Pages independent of Claude's publish
limits and persists indefinitely.

## What changed from the Claude artifact version

Only the storage layer. Every `window.storage` call became a Supabase query
(see `src/lib/db.js`). The UI, poll types, quiz mode, templates, projector
view, CSV export, and static QR code all work exactly the same way.

## 1. Set up Supabase (free tier is plenty)

1. Create a project at [supabase.com](https://supabase.com) — free tier.
2. Open **SQL Editor** → **New query**, paste in the contents of
   `supabase/schema.sql`, and run it. This creates the four tables
   (`sessions`, `polls`, `responses`, `poll_templates`) and their access
   policies.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key (not the `service_role` key — that one must never
     ship in a browser bundle)

## 2. Run it locally first (recommended before deploying)

```bash
cp .env.example .env.local
# paste your Project URL and anon key into .env.local

npm install
npm run dev
```

Open the local URL, run through Present → Launch → Join in a second tab,
confirm responses show up live. Cheaper to catch a typo'd env var here than
after it's deployed.

## 3. Deploy to Cloudflare Pages

1. Push this folder to a GitHub repo (public or private — doesn't matter,
   unlike GitHub Pages, Cloudflare Pages has no public-repo requirement on
   the free tier).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → select the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Before the first deploy, add environment variables (Pages project →
   **Settings → Environment variables**, not committed to the repo):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Cloudflare gives you a permanent `*.pages.dev` URL — that's your
   new static QR / broadcast link, replacing the Claude artifact link.

Every push to the connected branch redeploys automatically, so future edits
(new poll types, tweaks, whatever) just need a `git push`.

## Two links, not one

The public QR/URL (the one you print, project, or hand out) only ever shows
the audience join screen — "Present a Session" isn't shown or reachable from
it at all. To build and run sessions, bookmark your own URL with
`?present=1` on the end, e.g.:

```
https://your-app.pages.dev/?present=1
```

That's the only way to reach the presenter screen. This is obscurity, not
real access control — anyone who learns that URL parameter can use it too,
same as anyone who obtains the anon key can query the database directly (see
the security section below). It stops attendees from casually clicking into
presenter controls; it does not stop someone who goes looking for them.

## Security model — read before relying on this for anything sensitive

This app has **no login system**. Every visitor — presenter and audience
alike — connects to Supabase with the same public `anon` key, which is
visible to anyone who opens their browser's dev tools. The Row Level
Security policies in `schema.sql` reflect that reality: they allow anyone to
read and write to all four tables. There's no database-level way to stop a
technically inclined attendee from, say, ending your session early or
stuffing extra responses into a poll.

This isn't a regression from the Claude artifact version — that version had
the identical property (anyone with the session code could do anything),
just hidden inside Claude's storage sandbox instead of visible in a public
schema file. Fine for an internal training tool where the worst case is
someone messing with a poll result. Not fine if you ever want this to gate
anything with real stakes — that would need actual authentication, which is
a meaningfully bigger project than this one.

## Ongoing costs

Supabase free tier: 500MB database, 5GB bandwidth/month, project pauses
after 1 week of no API activity (auto-resumes on next request, adds a few
seconds' delay to the first call after a pause). Cloudflare Pages: free,
unlimited requests on the free tier. At the scale of a training tool used a
few times a month, you will not hit either limit.
