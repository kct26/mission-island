# Mission Island

**NASA Space Apps Challenge 2026 · Space Mission Design Game**

Design a complete space mission on an explorable 3D island, launch it, fly it day by day through
surprise events, and on the Moon mission drive a rover into a dark crater to find ice. Every choice
changes mass, power, money, data, communications and time, and a scored report explains *why*
the mission succeeded or failed, compared with real NASA missions.

## What's in this repository

| Folder | What it is |
|---|---|
| [`mission-island-web/`](mission-island-web/) | **The game.** Next.js + Three.js app, ready to deploy on Vercel. Start here. |
| [`mission-island/`](mission-island/) | The first prototype (plain HTML/JS) and the original architecture notes. Kept for reference. |

## Play it locally

```bash
cd mission-island-web
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploy on Vercel

1. On vercel.com: **Add New → Project** and import this repository.
2. Set **Root Directory** to `mission-island-web` (Vercel asks during import).
3. Click **Deploy**.
4. Optional: add `ANTHROPIC_API_KEY` under Settings → Environment Variables to turn on AI answers in
   Ask CAPCOM. Without it, CAPCOM uses its free offline mode.

## Features

- **5 missions:** Wildfire Watch, Space Weather Sentinel, Lunar Ice Prospector, Mars Climate Orbiter, Sandbox
- **Design on an island:** orbits, rockets, spacecraft parts, instruments, antennas and ground stations,
  chosen in game-style menus with illustrations, stat bars and an "if you pick it" preview
- **Real physics and NASA references:** orbit periods and eclipses from real constants, a NASA mission archive,
  JPL Concept Maturity Levels
- **Flight simulation:** day by day, with in-flight events that explain the risk for *your* spacecraft
- **Shadowline:** plan a rover route into a permanently shadowed lunar crater; sunlight and radio contact are
  computed from the terrain
- **Ask CAPCOM:** an assistant that tests changes in the simulator before suggesting them
- **Team play:** up to 4 players on one screen with roles and competing goals
- **Results:** grade, plain-language reasons, and a side-by-side with a real NASA mission

See [`mission-island-web/README.md`](mission-island-web/README.md) for technical details.
