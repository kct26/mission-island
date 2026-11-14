# Mission Island — Space Mission Design Game

NASA Space Apps 2026 · *Space Mission Design Game* challenge.

An open-world 3D spaceport you explore on foot. Each building is one part of mission design.
You design a complete mission, launch it, fly it day by day through random events, and get a
post-mission report that explains **why** it succeeded or failed.

## Run it
No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8765
```
Then open http://localhost:8765. (Three.js loads from a CDN.) To deploy, drop the folder on GitHub Pages / Netlify / Vercel.

## How it maps to the challenge
| Challenge asks for | In the game |
|---|---|
| Define objective & requirements | Mission Control briefing: 4 scenarios + sandbox, each with a science goal, budget, lifetime |
| Design spacecraft | Assembly Hangar: bus, power (solar/RTG), battery, flight computer, pointing, propulsion. The model on the stand updates live |
| Select instruments | Science Lab: 10 instruments with mass/power/cost/data/pointing needs and fit to the objective |
| Launch vehicle & orbit | Launch Complex: 6 orbits (LEO, SSO, GEO, L1, Moon, Mars), 4 rockets with destination-dependent capacity |
| Mass, power, budget, data, comms, time | Always-on resource HUD + design-review checklist with plain-language explanations |
| Team of up to 4 | Hot-seat roles (Lead, Engineer, Science, Comms & Ops), station ownership, conflicting role goals, required team sign-off, in-flight decisions routed to the right role |
| Simulation & evaluation | Day-by-day sim: eclipses, degradation, data downlink and storage, radiation faults, drag, 7 random events with choices |
| Feedback & learning | Score out of 1000, grade, "why it went this way" analysis, mission log |
| Replay, share, compare | Fly again, redesign, shareable design links, per-browser leaderboard |
| Difficulty levels | Cadet / Engineer / Flight Director |

Open-world extras: grant crystals hidden around the island (+$3M and a space fact each), minimap, quest checklist, launch sequence.

## NASA data & resources used
Built on the challenge's NASA Resources tab:
- **Mission segments** (NASA's mission-design overview): every building is labelled Launch, Space or Ground segment. The User segment (who uses the data) appears in Mission Control and the report.
- **JPL Concept Maturity Levels**: the quest tracker is the real CML 1–4 ladder (Objectives → Feasibility → Trade Space → Point Design), with a CML badge in the HUD.
- **Mission Design Lab-style trade studies**: the game counts the design trades you explored and shows them in the report.
- **GMAT-style orbital mechanics**: periods, orbital speeds and eclipse lengths are computed from real planetary radii and gravitational parameters (`js/physics.js`). The Launch Complex shows the formulas.
- **Real NASA mission archive** (`js/nasa.js`): 16 missions (Landsat 8, Terra, Suomi NPP, ECOSTRESS, NISAR, SOHO, ACE, DSCOVR, SDO, LRO, Lunar Prospector, MRO, Mars Odyssey, MAVEN, Mars Climate Orbiter, PACE). Mission Control shows the ones that tackled your objective. The report compares your design side by side with the closest real mission, like NASA's telescope-design learning game.
- **Real-world cases** for each in-flight event (e.g. Kepler's reaction-wheel failures, the micrometeoroid hit on JWST's mirror, the Feb 2022 Starlink drag losses).

Mission facts are approximate and drawn from public NASA mission pages and histories. Check figures against NASA sources before quoting them in your presentation.

## Code map
- `js/data.js`: all game numbers (parts, instruments, orbits, rockets, scenarios, roles). Tune balance here.
- `js/model.js`: design → mass/power/data/cost, design-review checks, science estimate, post-mission analysis.
- `js/sim.js`: day-by-day simulation, random events, scoring.
- `js/world.js`: the island, buildings, player, camera, launch animation, minimap.
- `js/space.js`: orbit view during the simulation (procedural Earth/Moon/Mars).
- `js/models.js`: spacecraft/rocket builders and planet textures.
- `js/main.js`: UI, panels, game state, main loop.

Debug: `window.MI` exposes the game state in the browser console.
