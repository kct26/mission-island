# Space Apps 2026 Project Submission: Lazy Dragon

Draft text for the team's project page. Each heading matches a field on the Space Apps project form.

---

## Project Name

Mission Island

## Challenge

Space Mission Design Game

## High-Level Summary

Mission Island is a browser game in which players design, launch and fly a complete space mission. Each run starts from a real science goal, such as watching wildfires, warning of solar storms, finding ice on the Moon or studying Mars' climate. Players walk a 3D island spaceport and choose the orbit, rocket, spacecraft parts, instruments and ground network. Every choice moves six resources that stay on screen: weight, power, money, data, lifetime and science. A design review blocks any launch that is physically impossible and explains why. The mission then flies day by day, with ageing solar panels, radiation, data backlogs and surprise events based on real NASA cases. On the Moon mission, players drive a rover into a permanently shadowed crater and must get back to sunlight before the battery runs out. Up to four players can share one screen, each with their own role and goal. At the end, a debrief explains what worked and what to fix, and compares the design with real NASA missions. Students learn that every engineering choice affects every other part of a mission.

## Link to Final Project

https://mission-island.vercel.app

## Link to Project Demo

TODO: add the demo video or slides link (YouTube, Google Slides, etc.)

## Project Details

**What it does.** Mission Island turns mission design into a loop of decisions that players can try, fail at and improve:

1. **Read the mission.** Mission Control gives the science goal, the budget, the required lifetime, and the real NASA missions that tackled the same question.
2. **Design on the island.** There are five buildings, one for each part of a mission. The Launch Complex covers 6 orbits and 4 rockets. The Assembly Hangar covers structure, power, battery, flight computer, pointing system, engine and rover. The Science Lab has 10 instruments. The Ground Station sets the antenna, ground network, relay and observing time. Mission Control runs the design review.
3. **Launch.** A short launch scene, with real-style rocket reliability.
4. **Fly.** The mission runs day by day. Seven kinds of in-flight events appear, each explained with your spacecraft's own numbers and linked to a real event, such as Kepler's reaction wheel failures or the May 2024 geomagnetic storm.
5. **Shadowline (Moon mission).** Plan and drive a rover route into a permanently shadowed crater near the lunar south pole. The game computes sunlight and Earth line of sight across the terrain. Only data that reaches Earth counts.
6. **Debrief.** A score out of 1,000 and a grade from S to D, a plain-language report, one concrete tip, and a side-by-side comparison with the closest real NASA mission.

**Benefits.** Most learning tools teach one topic at a time. Mission Island shows how they connect. A better instrument adds mass, power draw, data and cost. A far orbit weakens sunlight and radio. There is rarely one perfect answer, and the game explains *why* a design succeeds or fails instead of just marking it right or wrong.

**Team play and accessibility.** Up to four players share one screen as Mission Lead, Spacecraft Engineer, Science Lead and Comms & Ops. Each role owns its buildings and has a goal that pulls against the others, and everyone must sign off before launch. The game has 3 difficulty levels, 5 missions plus a Sandbox, plain-word labels, illustrated option cards, a quest guide at the bottom of the screen, a *Fix* button for every design problem, and an in-game helper, Ask CAPCOM.

**How it is built.** Next.js and React, Three.js for the 3D island, launch, orbit and lunar crater, and a deterministic simulation engine in JavaScript that decides every outcome. The game is hosted on Vercel from GitHub and runs in any modern browser without installing anything.

**What we hope to achieve.** We want students to get a feel for real mission trade-offs in about ten minutes and keep coming back to improve their design. Next we plan to add real NASA Moon Trek terrain, touch controls, a class competition mode and a student playtest.

## Use of Artificial Intelligence (AI)

- **In the game:** Ask CAPCOM, an in-game mission controller, can use Claude (Anthropic) to answer player questions in plain language. Before suggesting a change, CAPCOM tests it in the game's own simulator. The AI never decides outcomes. Every number comes from the simulator, and the game works fully without AI (the deployed version runs CAPCOM in its offline, simulator-only mode).
- **In development:** the team used Claude (Anthropic) as a coding and design assistant to help write code, documentation and diagrams. All game rules and NASA facts were reviewed by the team.
- No AI-generated images, video or audio are presented as NASA imagery. The illustrations are hand-coded SVG, and the 3D scenes are built in code.

## NASA Data

- **Design and Develop Science Missions (NASA):** the four mission segments (launch, space, ground, user) organise the island's buildings and the debrief.
- **Concept Maturity Levels (JPL):** CML 1–4 is the design-progress ladder at Mission Control.
- **Mission Design Lab (NASA Goddard):** the design review checks the same disciplines (power, propulsion, communications, attitude control, mass, cost, risk), and the option cards act as small trade studies.
- **A Learning Game About Telescopes:** we follow its pattern of objective first, constrained choices, an animated launch, results, and real missions with similar goals.
- **General Mission Analysis Tool (GMAT):** used as a reference. Our orbit periods, speeds and eclipse times use the same basic physics (real gravitational parameters and radii), simplified so the game runs in a browser.
- **NASA mission facts** from public mission pages and histories: Landsat 8, Terra, Suomi NPP, ECOSTRESS, NISAR, SOHO, ACE, DSCOVR, SDO, LRO, Lunar Prospector, MRO, Mars Odyssey, MAVEN, Mars Climate Orbiter and PACE.
- **VIPER mission concept:** blocked radio, long blackouts and sunlit safe havens shape the Shadowline rover phase.
- **Real NASA events** paired with in-flight events: Kepler's reaction wheel failures, the micrometeoroid strike on JWST, the May 2024 geomagnetic storm and others.

## Space Agency Partner Data

- **CSA Digital Games and Activities:** used as inspiration for short, friendly space games for young players. No CSA data is used in the game.

## References

- Live game: https://mission-island.vercel.app
- Source code: https://github.com/kct26/mission-island (make it public before submitting)
- Three.js (MIT), Next.js and React (MIT), Anthropic SDK (MIT)
- NASA Space Apps 2026 challenge resources: https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources

## Tags

#game #missiondesign #education #moon #threejs #nextjs

---

## Before you submit

- [ ] Add a demo link (a 30-second video or up to 7 slides; Space Apps requires one).
- [ ] Make the GitHub repo public, or remove the link from References.
- [ ] Upload a project image: `docs/screenshots/02-island.png` or `01-menu.png` work well.
- [ ] Check the team member names on the Members tab.
