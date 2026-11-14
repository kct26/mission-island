// ─────────────────────────────────────────────────────────────
//  Real NASA reference material used by the game.
//  Sources: NASA mission pages, the NASA Space Apps 2026 challenge
//  resources (mission segments, JPL Concept Maturity Levels,
//  Mission Design Lab, GMAT), and published mission histories.
//  Masses are approximate launch masses; null = not shown.
// ─────────────────────────────────────────────────────────────

export const MISSIONS = [
  { id: 'landsat8', name: 'Landsat 8', agency: 'NASA / USGS', year: 2013, orbit: 'SSO', orbitText: 'Sun-synchronous, 705 km', rocket: 'Atlas V 401', lv: 'large', mass: 2600,
    inst: ['cam', 'tir'], instText: 'OLI (visible/infrared imager), TIRS (thermal infrared)', tags: ['wildfire'],
    fact: 'Part of the Landsat series, the longest continuous satellite record of Earth\'s land surface (since 1972).',
    lesson: 'A sun-synchronous orbit gives the same lighting every pass, so changes on the ground stand out.' },
  { id: 'terra', name: 'Terra (MODIS)', agency: 'NASA', year: 1999, orbit: 'SSO', orbitText: 'Sun-synchronous, 705 km', rocket: 'Atlas IIAS', lv: 'large', mass: 5190,
    inst: ['cam', 'tir', 'hyper'], instText: 'MODIS (36 spectral bands incl. thermal), ASTER, MISR, CERES, MOPITT', tags: ['wildfire'],
    fact: 'MODIS has detected active fires around the globe every day since 2000; its data feeds NASA\'s FIRMS fire-alert system.',
    lesson: 'Wide-swath instruments trade fine detail for daily global coverage — exactly what fire monitoring needs.' },
  { id: 'npp', name: 'Suomi NPP (VIIRS)', agency: 'NASA / NOAA', year: 2011, orbit: 'SSO', orbitText: 'Sun-synchronous, 824 km', rocket: 'Delta II', lv: 'medium', mass: 2130,
    inst: ['cam', 'tir'], instText: 'VIIRS (visible + infrared imager), CrIS, ATMS, OMPS', tags: ['wildfire'],
    fact: 'VIIRS detects fires at 375 m resolution, finding smaller fires than MODIS; alerts reach firefighters within hours.',
    lesson: 'Better sensors on a similar orbit can multiply science without changing the rest of the mission.' },
  { id: 'ecostress', name: 'ECOSTRESS', agency: 'NASA JPL', year: 2018, orbit: 'LEO', orbitText: 'On the Space Station, ~400 km', rocket: 'Falcon 9 (Dragon cargo)', lv: 'large', mass: null,
    inst: ['tir'], instText: 'Thermal infrared radiometer', tags: ['wildfire'],
    fact: 'Measures plant temperature to see water stress, and has mapped heat from active wildfires.',
    lesson: 'Riding on the ISS saves the cost of a whole spacecraft bus — but you accept its orbit and schedule.' },
  { id: 'nisar', name: 'NISAR', agency: 'NASA / ISRO', year: 2025, orbit: 'SSO', orbitText: 'Sun-synchronous, ~747 km', rocket: 'GSLV', lv: 'large', mass: null,
    inst: ['sar'], instText: 'L-band and S-band synthetic aperture radar, 12 m mesh antenna', tags: ['wildfire', 'sandbox'],
    fact: 'Maps nearly all of Earth\'s land and ice every 12 days, through clouds and darkness.',
    lesson: 'Radar sees through smoke but needs huge power, a huge antenna and a huge downlink.' },
  { id: 'soho', name: 'SOHO', agency: 'ESA / NASA', year: 1995, orbit: 'L1', orbitText: 'Halo orbit around Sun–Earth L1', rocket: 'Atlas IIAS', lv: 'large', mass: 1850,
    inst: ['corona', 'particle', 'cam'], instText: 'LASCO coronagraphs, EIT imager, solar-wind particle instruments', tags: ['sentinel'],
    fact: 'Planned for 2 years, it has watched the Sun for decades and discovered more than 5,000 comets along the way.',
    lesson: 'L1 gives an uninterrupted view of the Sun — no night, no eclipses.' },
  { id: 'ace', name: 'ACE', agency: 'NASA', year: 1997, orbit: 'L1', orbitText: 'Halo orbit around Sun–Earth L1', rocket: 'Delta II', lv: 'medium', mass: null,
    inst: ['particle', 'mag'], instText: 'Particle spectrometers, magnetometer', tags: ['sentinel'],
    fact: 'Samples the solar wind about an hour before it reaches Earth, giving forecasters early warning of storms.',
    lesson: 'Small, low-data instruments can deliver enormous value if they are in the right place.' },
  { id: 'dscovr', name: 'DSCOVR', agency: 'NOAA / NASA / USAF', year: 2015, orbit: 'L1', orbitText: 'Lissajous orbit around Sun–Earth L1', rocket: 'Falcon 9', lv: 'large', mass: 570,
    inst: ['particle', 'mag', 'cam'], instText: 'Solar-wind plasma sensor, magnetometer, EPIC Earth camera', tags: ['sentinel'],
    fact: 'Took over real-time solar-wind monitoring for NOAA. Its EPIC camera photographs the whole sunlit Earth from 1.5 million km.',
    lesson: 'A light spacecraft (~570 kg) can do an operational job at L1 on a single medium-class launch.' },
  { id: 'sdo', name: 'Solar Dynamics Observatory', agency: 'NASA', year: 2010, orbit: 'GEO', orbitText: 'Inclined geosynchronous', rocket: 'Atlas V 401', lv: 'large', mass: 3000,
    inst: ['hires', 'mag'], instText: 'AIA (high-res UV imagers), HMI (solar magnetic fields), EVE', tags: ['sentinel'],
    fact: 'Sends about 1.4 terabytes per day — its geosynchronous orbit keeps it in constant contact with a dedicated ground station.',
    lesson: 'When data volume is extreme, choosing an orbit for communications can matter as much as the instruments.' },
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter', agency: 'NASA', year: 2009, orbit: 'MOON', orbitText: 'Lunar polar, ~50 km', rocket: 'Atlas V 401', lv: 'large', mass: 1900,
    inst: ['lidar', 'neutron', 'tir', 'cam', 'hires', 'sar'], instText: 'LOLA laser altimeter, LEND neutron detector, Diviner thermal radiometer, LROC cameras, Mini-RF radar', tags: ['lunar'],
    fact: 'Diviner found polar crater floors colder than −240 °C — among the coldest places measured in the solar system, cold enough to trap ice.',
    lesson: 'A polar orbit lets one spacecraft map the entire Moon, including the shadowed craters at the poles.' },
  { id: 'lp', name: 'Lunar Prospector', agency: 'NASA', year: 1998, orbit: 'MOON', orbitText: 'Lunar polar, 100 km', rocket: 'Athena II', lv: 'medium', mass: 300,
    inst: ['neutron', 'mag'], instText: 'Neutron spectrometer, gamma-ray spectrometer, magnetometer', tags: ['lunar'],
    fact: 'Detected hydrogen signatures at the lunar poles — a hint of water ice — on one of NASA\'s lowest-cost missions (about $63 million).',
    lesson: 'A focused question plus a few well-chosen instruments can beat a bigger, costlier design.' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter', agency: 'NASA', year: 2005, orbit: 'MARS', orbitText: 'Low Mars orbit, ~300 km', rocket: 'Atlas V 401', lv: 'large', mass: 2180,
    inst: ['hires', 'hyper', 'tir', 'sar', 'cam'], instText: 'HiRISE telescope, CRISM spectrometer, Mars Climate Sounder, SHARAD radar, CTX camera', tags: ['mars'],
    fact: 'Its 3-meter dish has returned more data than all earlier Mars missions combined.',
    lesson: 'At Mars, a big high-gain antenna and Deep Space Network time are what make high-resolution science possible.' },
  { id: 'odyssey', name: '2001 Mars Odyssey', agency: 'NASA', year: 2001, orbit: 'MARS', orbitText: 'Mars polar, ~400 km', rocket: 'Delta II', lv: 'medium', mass: 725,
    inst: ['tir', 'neutron'], instText: 'THEMIS thermal imager, gamma-ray spectrometer with neutron detectors', tags: ['mars'],
    fact: 'Found evidence of water ice just below the Martian surface and became one of the longest-working spacecraft at Mars.',
    lesson: 'A modest orbiter can also become a vital communications relay for rovers.' },
  { id: 'maven', name: 'MAVEN', agency: 'NASA', year: 2013, orbit: 'MARS', orbitText: 'Elliptical Mars orbit', rocket: 'Atlas V 401', lv: 'large', mass: 2450,
    inst: ['particle', 'mag', 'hyper'], instText: 'Solar-wind and particle instruments, magnetometer, ultraviolet imaging spectrograph', tags: ['mars'],
    fact: 'Measured how the solar wind strips away Mars\'s upper atmosphere — a key part of how Mars lost its water.',
    lesson: 'Climate questions can need particle and field instruments, not just cameras.' },
  { id: 'mco', name: 'Mars Climate Orbiter', agency: 'NASA', year: 1998, orbit: 'MARS', orbitText: 'Planned low Mars orbit', rocket: 'Delta II', lv: 'medium', mass: 640,
    inst: ['tir', 'cam'], instText: 'Atmospheric sounder, color imager', tags: ['mars'], failed: true,
    fact: 'Lost in 1999: one team used imperial units and another metric, so the spacecraft dipped too deep into the atmosphere.',
    lesson: 'Systems engineering is about interfaces between teams as much as hardware — check every hand-off.' },
  { id: 'pace', name: 'PACE', agency: 'NASA', year: 2024, orbit: 'SSO', orbitText: 'Sun-synchronous, ~676 km', rocket: 'Falcon 9', lv: 'large', mass: null,
    inst: ['hyper', 'cam'], instText: 'Ocean Color Instrument (hyperspectral), two polarimeters', tags: ['sandbox'],
    fact: 'Sees the ocean in more than 200 wavelengths to identify types of phytoplankton from space.',
    lesson: 'Hyperspectral instruments reveal composition, but generate very large data volumes.' },
];

// Who uses the mission's data — the "user segment" from NASA's mission-segment model.
export const USER_SEGMENT = {
  wildfire: 'Firefighters and land managers, who receive near-real-time fire alerts through systems like NASA FIRMS.',
  sentinel: 'Space-weather forecasters, who warn power-grid operators, airlines and satellite operators before storms arrive.',
  lunar: 'Mission planners choosing landing sites near the lunar south pole for future human missions.',
  mars: 'Climate scientists, and engineers planning future Mars landings who need to forecast dust storms.',
  sandbox: 'Whoever your mission serves: every mission is built for a community of data users.',
};

// Real-world precedents shown with in-flight events.
export const REAL_CASES = {
  storm: 'In May 2024 the strongest geomagnetic storm in over 20 years (rated G5) hit Earth, and satellite operators worldwide watched for upsets and extra drag.',
  wheel: 'NASA\'s Kepler telescope lost a second of its four reaction wheels in 2013. Engineers rescued it as the "K2" mission, using sunlight pressure to help balance it.',
  gs: 'NASA\'s Deep Space Network is shared by dozens of missions, so antenna time has to be booked and negotiated in advance.',
  funding: 'The James Webb Space Telescope\'s cost grew to about $10 billion — many times early estimates — and other programs were squeezed to pay for it.',
  debris: 'The International Space Station has fired its thrusters dozens of times since 1999 to dodge tracked debris.',
  meteor: 'In 2022 a micrometeoroid larger than engineers had planned for struck one of JWST\'s primary mirror segments. The telescope kept working.',
  discovery: 'In 2009 NASA\'s LCROSS slammed a spent rocket stage into a permanently shadowed lunar crater and detected water in the plume.',
  drag: 'In February 2022 a geomagnetic storm puffed up the upper atmosphere and about 38 newly launched Starlink satellites re-entered from the extra drag.',
};

// JPL Concept Maturity Levels (CML 1–4 are where the big design decisions happen).
export const CML = [
  { n: 1, name: 'Overview & Objectives', desc: 'The "cocktail napkin" idea: what question will the mission answer?' },
  { n: 2, name: 'Initial Feasibility', desc: 'Can we physically get there? Orbit, rocket and rough mass checked.' },
  { n: 3, name: 'Trade Space', desc: 'Options explored and compared for every subsystem and instrument.' },
  { n: 4, name: 'Point Design', desc: 'One complete, consistent design that passes review and fits the budget.' },
];

// The four mission segments from NASA's mission-design overview.
export const SEGMENTS = {
  launch: 'Launch segment', hangar: 'Space segment', lab: 'Space segment · payload',
  ground: 'Ground segment', control: 'Ground segment · operations',
};

/** Find the real missions most similar to a design. */
export function closestMissions(d, totalMass, n = 2) {
  const body = o => ({ LEO: 'earth', SSO: 'earth', GEO: 'earth', L1: 'l1', MOON: 'moon', MARS: 'mars' }[o]);
  return MISSIONS.map(ms => {
    let s = 0;
    if (ms.orbit === d.orbit) s += 3; else if (body(ms.orbit) === body(d.orbit)) s += 1.5;
    const a = new Set(d.instruments), b = new Set(ms.inst);
    const inter = [...a].filter(x => b.has(x)).length, union = new Set([...a, ...b]).size || 1;
    s += 4 * inter / union;
    if (ms.mass && totalMass) s += Math.max(0, 1 - Math.abs(Math.log(totalMass / ms.mass)) / 2);
    if (ms.tags.includes(d.scenario)) s += 0.5;
    if (ms.failed) s -= 0.8;   // still shown when it is clearly the best match
    return { ms, s, shared: [...a].filter(x => b.has(x)) };
  }).sort((x, y) => y.s - x.s).slice(0, n);
}
