# Mission Island (web prototype)

NASA Space Apps 2026 · Space Mission Design Game. Next.js app, ready for Vercel.

Design a space mission on a 3D island, launch it, fly it day by day, and read a scored report.
**Ask CAPCOM** (press **C** in game) is an AI tutor: Claude answers questions, but every number
comes from the game's simulator through tool calls.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to use Claude; leave empty for offline CAPCOM
npm run dev                  # http://localhost:3000
```

Without a key (or with `AI_MODE=off`), CAPCOM still works: it tries every single-part change in the
simulator and suggests the best ones.

## Push to GitHub

Create an empty repository on github.com (no README), then in this folder:

```bash
git init
git add .
git commit -m "Mission Island"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/mission-island.git
git push -u origin main
```

`node_modules`, `.next`, `.vercel` and `.env.local` are in `.gitignore`, so they are not uploaded.

## Deploy to Vercel

1. Push this folder to a GitHub repository (above).
2. In Vercel, **Add New → Project**, import the repository (framework: Next.js, no settings to change).
3. In **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (and optionally `AI_MODE=live`).
4. Deploy. Every pull request gets its own preview URL.

## What is where

| Path | What it is |
|---|---|
| `src/game/sim/` | The engine: parts, orbits, rockets, design checks, science, flight simulation, scoring, NASA mission archive. Pure JS, runs in the browser and on the server. |
| `src/game/client/` | 3D (Three.js): island, launch, orbit view; HUD, station panels, report, CAPCOM chat. |
| `src/game/server/capcom.ts` | Ask CAPCOM: input validation, Claude tool loop (`get_metrics`, `what_if`, `explain_check`, `compare_missions`, `lookup_fact`), offline fallback. |
| `src/app/api/capcom/route.ts` | `POST /api/capcom`: rate limit, then AI or offline answer. |
| `src/components/Game.tsx` | Hosts the game in the Next.js page. |

## AI details

- Model `claude-opus-5-5`, effort `low` (fast replies), system prompt cached.
- Server-side fallback is on: if the model declines a request, the API retries on a fallback model.
- Suggestions are shown only for changes the simulator tested and that don't reduce science.
- Rate limit: 20 questions per 10 minutes per IP (in memory; move to Upstash Redis for production).

## Shadowline (Moon mission)

After the orbiter's flight, the Lunar Ice Prospector mission lands a rover near the south pole.
`src/game/sim/surface.js` computes, for every spot, whether the Sun (≤ 1.5° high) and Earth are
visible, then simulates the rover every 15 minutes: battery, heaters in shadow, slopes, data stored
and sent. `src/game/client/shadowline.js` draws only what the engine computed and lets the player
pick a landing site and click waypoints. The terrain is a procedural crater for now; a NASA Moon Trek
elevation grid can be passed to `makeTerrain({ heights })`.

## Not built yet (see the Build Map)

Design Review Board, Mission Director, AI debrief, saved designs and
verified leaderboard, TypeScript port of the engine, React Three Fiber scenes, Blender buildings.
