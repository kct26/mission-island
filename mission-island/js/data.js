// ─────────────────────────────────────────────────────────────
//  Mission Island — game data
//  Numbers are simplified but chosen to keep real-world proportions
//  (e.g. Mars sunlight 43%, deep-space data rates far below LEO).
// ─────────────────────────────────────────────────────────────

export const ROLES = {
  lead: { name: 'Mission Lead',        color: '#ffb347', icon: '🧭', stations: ['control', 'launch'],
          goal: 'Keep at least 10% of the budget in reserve' },
  eng:  { name: 'Spacecraft Engineer', color: '#5ad1ff', icon: '🔧', stations: ['hangar'],
          goal: '≥ 20% power margin and ≥ 10% launch-mass margin' },
  sci:  { name: 'Science Lead',        color: '#b98cff', icon: '🔬', stations: ['lab'],
          goal: 'Estimated science ≥ 110% of the mission goal' },
  ops:  { name: 'Comms & Ops',         color: '#6cf08a', icon: '📡', stations: ['ground'],
          goal: 'Downlink capacity covers 100% of daily data' },
};

// How roles are split between 1–4 players (hot-seat team play)
export const ROLE_SPLIT = {
  1: [['lead', 'eng', 'sci', 'ops']],
  2: [['lead', 'sci'], ['eng', 'ops']],
  3: [['lead', 'ops'], ['eng'], ['sci']],
  4: [['lead'], ['eng'], ['sci'], ['ops']],
};

export const DIFFICULTY = {
  cadet:    { name: 'Cadet',           budget: 1.25, events: 2, overrun: 0.5, hazard: 0.5, desc: 'Bigger budget, fewer surprises.' },
  engineer: { name: 'Engineer',        budget: 1.0,  events: 3, overrun: 1.0, hazard: 1.0, desc: 'The intended experience.' },
  director: { name: 'Flight Director', budget: 0.85, events: 4, overrun: 1.5, hazard: 1.6, desc: 'Tight money, more things go wrong.' },
};

export const SCENARIOS = {
  wildfire: {
    id: 'wildfire', name: 'Wildfire Watch', icon: '🔥', diff: 'Easy', budget: 180, years: 3, goal: 45,
    brief: 'Wildfires are growing larger every year. Build an Earth-observing satellite that spots fires early by their heat and maps burn scars afterward.',
    tip: 'Fires are hot, so thermal infrared is key. A sun-synchronous orbit crosses every place at the same local time each day — perfect for comparing images day to day.',
    orbitFit: { SSO: 1, LEO: 0.85, GEO: 0.6, L1: 0.1, MOON: 0, MARS: 0 },
    inst: { tir: 1, hyper: 0.8, cam: 0.6, sar: 0.6, hires: 0.5, lidar: 0.3 },
  },
  sentinel: {
    id: 'sentinel', name: 'Space Weather Sentinel', icon: '☀️', diff: 'Medium', budget: 300, years: 5, goal: 40,
    brief: 'Solar storms can knock out power grids and satellites. Station a sentinel between Earth and the Sun to warn us before eruptions arrive.',
    tip: 'The Sun–Earth L1 point, 1.5 million km sunward, sees the Sun nonstop and samples the solar wind about an hour before it hits Earth.',
    orbitFit: { L1: 1, GEO: 0.45, SSO: 0.3, LEO: 0.25, MOON: 0.2, MARS: 0 },
    inst: { corona: 1, particle: 1, mag: 1, hires: 0.3, cam: 0.2 },
  },
  lunar: {
    id: 'lunar', name: 'Lunar Ice Prospector', icon: '🌙', diff: 'Medium', budget: 320, years: 2, goal: 50,
    brief: 'Water ice hidden in permanently shadowed craters at the lunar poles could supply future astronauts. Find out where it is.',
    tip: 'Neutron spectrometers sniff out hydrogen (a sign of water). Laser altimeters and radar can map craters that never see sunlight.',
    orbitFit: { MOON: 1 },
    inst: { neutron: 1, lidar: 0.9, sar: 0.8, tir: 0.6, hyper: 0.6, cam: 0.4, hires: 0.4 },
  },
  mars: {
    id: 'mars', name: 'Mars Climate Orbiter', icon: '🔴', diff: 'Hard', budget: 420, years: 3, goal: 42,
    brief: 'Study the Martian atmosphere, dust storms and seasonal ice caps from orbit — up to 400 million km from home.',
    tip: 'At Mars sunlight is only 43% as strong and every bit of data must cross interplanetary space. Power and communications are the hard part.',
    orbitFit: { MARS: 1 },
    inst: { tir: 1, hyper: 0.9, hires: 0.7, cam: 0.6, sar: 0.5, lidar: 0.4, mag: 0.3, particle: 0.3 },
  },
  sandbox: {
    id: 'sandbox', name: 'Sandbox', icon: '🧪', diff: 'Free play', budget: 2000, years: 3, goal: 60,
    brief: 'No real objective and a huge budget. Experiment freely and watch how every choice ripples through the whole system.',
    tip: 'Try the same instruments in different orbits, or swap the antenna, and compare the mission reports.',
    orbitFit: {}, defaultFit: 0.8, inst: {}, defaultRel: 0.8,
  },
};

export const ORBITS = {
  LEO: { name: 'Low Earth Orbit', alt: '400 km', magOk: true, eclipse: 0.38, eclH: 0.6, sun: 1, rad: 1, dv: 30, insertion: false, transit: 0, period: '92 min', body: 'earth', r: 1.08,
    desc: 'Close to Earth: sharp images and fast radio links, but each ground station sees you for only a few minutes per pass. Thin air drags you down in ~2 years unless you carry thrusters.' },
  SSO: { name: 'Sun-Synchronous Orbit', alt: '700 km, polar', magOk: true, eclipse: 0.35, eclH: 0.58, sun: 1, rad: 1.2, dv: 0, insertion: false, transit: 0, period: '99 min', body: 'earth', r: 1.14, polar: true,
    desc: 'A polar orbit that passes over each place at the same local solar time every day — consistent lighting for comparing images. Covers the entire globe.' },
  GEO: { name: 'Geostationary Orbit', alt: '35,786 km', magOk: false, eclipse: 0.02, eclH: 1.2, sun: 1, rad: 3, dv: 1500, insertion: true, transit: 7, period: '24 h', body: 'earth', r: 3.2,
    desc: 'Circles once a day, so it hovers over one spot: a constant view of one hemisphere and nonstop contact with one ground station. Far away → less detail and harsher radiation. Needs a big burn to circularize.' },
  L1: { name: 'Sun–Earth L1 Point', alt: '1.5 million km', magOk: false, eclipse: 0, eclH: 0, sun: 1, rad: 2, dv: 150, insertion: true, transit: 100, period: '~6-month halo', body: 'l1', r: 0,
    desc: 'A gravitational balance point between Earth and Sun. Never in shadow, uninterrupted view of the Sun — but radio signals must travel 4× farther than to the Moon.' },
  MOON: { name: 'Lunar Polar Orbit', alt: '100 km above the Moon', magOk: false, eclipse: 0.4, eclH: 0.8, sun: 1, rad: 2, dv: 900, insertion: true, transit: 5, period: '2 h', body: 'moon', r: 1.1, polar: true,
    desc: 'Flies over both lunar poles every orbit. You need a substantial engine burn to be captured by the Moon\'s gravity.' },
  MARS: { name: 'Mars Science Orbit', alt: '300 km above Mars', magOk: false, eclipse: 0.35, eclH: 0.75, sun: 0.43, rad: 2.5, dv: 1000, insertion: true, transit: 210, period: '2 h', body: 'mars', r: 1.12, polar: true,
    desc: 'Seven months of cruise, then a braking burn to be captured. Sunlight is 43% of Earth\'s and radio signals take up to 22 minutes each way.' },
};

export const LAUNCHERS = {
  small:  { name: 'Small Launcher',  cls: 'Electron-class',     cost: 8,   rel: 0.93, h: 9,
            cap: { LEO: 300, SSO: 200, GEO: 0, L1: 0, MOON: 0, MARS: 0 },
            desc: 'Cheap ride for small satellites to low orbit. Cannot reach deep space.' },
  medium: { name: 'Medium Launcher', cls: 'Vega/Antares-class', cost: 45,  rel: 0.95, h: 14,
            cap: { LEO: 3000, SSO: 2000, GEO: 600, L1: 500, MOON: 400, MARS: 0 },
            desc: 'Mid-size rocket. Can throw a light spacecraft toward the Moon or L1.' },
  large:  { name: 'Large Reusable',  cls: 'Falcon 9-class',     cost: 70,  rel: 0.98, h: 21,
            cap: { LEO: 17000, SSO: 12000, GEO: 5500, L1: 3500, MOON: 3000, MARS: 2000 },
            desc: 'Workhorse with a reusable first stage. Very reliable; can reach Mars with a modest payload.' },
  heavy:  { name: 'Heavy Lift',      cls: 'Falcon Heavy-class', cost: 150, rel: 0.97, h: 21, boosters: true,
            cap: { LEO: 50000, SSO: 35000, GEO: 20000, L1: 15000, MOON: 15000, MARS: 13000 },
            desc: 'Three cores strapped together. Massive capacity anywhere — and a massive price.' },
};

// Spacecraft parts. Each category belongs to one station (and therefore one role).
export const PARTS = {
  bus: {
    label: 'Structure (Bus)', station: 'hangar',
    why: 'The bus is the skeleton everything bolts to. Bigger buses carry more but weigh and cost more and draw more housekeeping power (heaters, sensors).',
    options: [
      { id: 'cube',   name: 'SmallSat Bus', mass: 20,  cost: 4,  maxPayload: 120,  base: 8,   desc: 'A suitcase-size platform. Great for 1–2 small instruments.' },
      { id: 'small',  name: 'Small Bus',    mass: 80,  cost: 12, maxPayload: 400,  base: 20,  desc: 'Mini-fridge size. Handles a few instruments and a small engine.' },
      { id: 'medium', name: 'Medium Bus',   mass: 250, cost: 30, maxPayload: 1500, base: 50,  desc: 'Car-size. Room for big tanks and heavy instruments.' },
      { id: 'large',  name: 'Large Bus',    mass: 600, cost: 60, maxPayload: 4000, base: 100, desc: 'Flagship-class platform for the most ambitious payloads.' },
    ],
  },
  power: {
    label: 'Power Source', station: 'hangar',
    why: 'Solar arrays only work in sunlight and get weaker far from the Sun. A radioisotope generator (RTG) gives steady power anywhere, but little of it and at a high price.',
    options: [
      { id: 'solar_s', name: 'Body-Mounted Solar', mass: 8,   cost: 2,  gen: 150,  desc: 'Cells glued to the bus. Simple, but limited area.' },
      { id: 'solar_m', name: 'Deployable Wings',   mass: 35,  cost: 8,  gen: 800,  desc: 'Two fold-out wings. The common choice.' },
      { id: 'solar_l', name: 'Large Solar Arrays', mass: 110, cost: 20, gen: 3000, desc: 'Huge wings for power-hungry radar or distant orbits.' },
      { id: 'rtg',     name: 'RTG (Nuclear)',      mass: 45,  cost: 80, gen: 110,  rtg: true, desc: 'Plutonium heat → electricity. Works in shadow and far from the Sun.' },
    ],
  },
  battery: {
    label: 'Battery', station: 'hangar',
    why: 'When your orbit passes into Earth\'s (or a planet\'s) shadow, solar arrays produce nothing. The battery must carry everything through each eclipse.',
    options: [
      { id: 'batt_s', name: 'Small Battery',  mass: 3,  cost: 0.5, wh: 200,  desc: '200 Wh — enough for a small satellite\'s eclipse.' },
      { id: 'batt_m', name: 'Medium Battery', mass: 12, cost: 2,   wh: 1000, desc: '1,000 Wh — comfortable for most missions.' },
      { id: 'batt_l', name: 'Large Battery',  mass: 45, cost: 6,   wh: 4000, desc: '4,000 Wh — keeps power-hungry payloads running in the dark.' },
    ],
  },
  computer: {
    label: 'Flight Computer', station: 'hangar',
    why: 'Radiation can flip bits and crash ordinary electronics. Radiation-hardened computers are slower and pricier but far more robust. Onboard processing can shrink data before sending it.',
    options: [
      { id: 'obc',    name: 'Standard Computer',   mass: 2, power: 5,  cost: 1,  storage: 64,   fault: 1.0,  desc: 'Commercial chips. Cheap, but vulnerable to radiation.' },
      { id: 'radhard',name: 'Radiation-Hardened',  mass: 8, power: 20, cost: 10, storage: 512,  fault: 0.25, desc: 'Built for harsh space. 4× fewer faults.' },
      { id: 'edge',   name: 'Onboard AI Processor',mass: 6, power: 45, cost: 7,  storage: 2000, fault: 0.7,  compress: 0.5, desc: 'Processes images in orbit and sends only what matters: halves your data volume.' },
    ],
  },
  adcs: {
    label: 'Attitude Control (Pointing)', station: 'hangar',
    why: 'Instruments must point where you want. Telescopes need very precise, steady pointing; magnetometers don\'t care. Magnetorquers push against Earth\'s magnetic field, so they only work close to Earth.',
    options: [
      { id: 'magtorq', name: 'Magnetorquers',              mass: 3,  power: 5,  cost: 1,  pointing: 0.5, magnetic: true, desc: 'Coarse pointing using Earth\'s magnetic field. Useless far from Earth.' },
      { id: 'wheels',  name: 'Reaction Wheels',            mass: 15, power: 30, cost: 5,  pointing: 0.85, desc: 'Spinning wheels twist the spacecraft. Good pointing anywhere.' },
      { id: 'star',    name: 'Wheels + Star Trackers',     mass: 22, power: 40, cost: 12, pointing: 1.0, desc: 'Cameras recognize star patterns for arc-second precision.' },
    ],
  },
  prop: {
    label: 'Propulsion', station: 'hangar',
    why: 'Engines change your velocity (Δv). You need enough Δv to brake into orbit around the Moon or Mars, circularize at GEO, hold position at L1, or fight air drag in low orbit.',
    options: [
      { id: 'none',   name: 'No Propulsion',       mass: 0,   cost: 0,  dv: 0,    desc: 'Lightest and cheapest. You go where the rocket puts you.' },
      { id: 'cold',   name: 'Cold-Gas Thrusters',  mass: 10,  cost: 2,  dv: 50,   desc: 'Puffs of gas. Enough to fight drag in low orbit.' },
      { id: 'mono',   name: 'Monopropellant',      mass: 120, cost: 8,  dv: 1000, desc: 'Hydrazine thrusters. Enough for lunar capture or L1.' },
      { id: 'biprop', name: 'Bipropellant Engine', mass: 300, cost: 20, dv: 2000, desc: 'Powerful main engine. Handles GEO, Moon or Mars capture.' },
      { id: 'ion',    name: 'Ion Engine',          mass: 60,  cost: 15, dv: 5000, ion: true, cruisePower: 300, transitMult: 2.5, desc: 'Super-efficient electric thruster. Huge Δv for little mass, but needs ~300 W and takes much longer to get there.' },
    ],
  },
  comms: {
    label: 'Antenna / Radio', station: 'ground',
    why: 'Radio signals weaken with the square of distance. Bigger dishes and higher frequencies (X, Ka band) squeeze more data through, but need precise pointing and more power.',
    options: [
      { id: 'uhf',   name: 'UHF Whip Antenna',   mass: 1,  power: 4,  cost: 0.5, rate: { LEO: 1,   SSO: 1,   GEO: 0.05, L1: 0.005, MOON: 0.01, MARS: 0 },     desc: 'Simple and tiny. Fine for a few pictures a day from low orbit.' },
      { id: 'sband', name: 'S-band Patch',       mass: 4,  power: 15, cost: 3,   rate: { LEO: 8,   SSO: 8,   GEO: 2,    L1: 0.2,   MOON: 0.5,  MARS: 0.005 }, desc: 'Reliable workhorse radio for near-Earth missions.' },
      { id: 'xband', name: 'X-band High-Gain Dish', mass: 25, power: 50, cost: 12, rate: { LEO: 100, SSO: 100, GEO: 30,   L1: 4,     MOON: 10,   MARS: 1 },     desc: 'Steerable dish. Standard for deep space.' },
      { id: 'ka',    name: 'Ka-band High-Gain Dish', mass: 35, power: 80, cost: 20, rate: { LEO: 500, SSO: 500, GEO: 120,  L1: 20,    MOON: 50,   MARS: 5 },     desc: 'Highest frequency, highest rate. Expensive and power-hungry.' },
    ],
  },
  gs: {
    label: 'Ground Network', station: 'ground',
    why: 'Your spacecraft can only send data while a ground antenna can see it. More stations = more contact hours. Deep-space missions need giant dishes to hear faint signals.',
    options: [
      { id: 'uni',  name: 'University Station',  costYr: 0.5, hours: { LEO: 0.5, SSO: 0.7, GEO: 12, L1: 8,  MOON: 8,  MARS: 8 },  gain: { LEO: 1, SSO: 1, GEO: 0.5, L1: 0.05, MOON: 0.1, MARS: 0.02 }, desc: 'One small campus dish. Almost free, but brief passes and weak deep-space reception.' },
      { id: 'comm', name: 'Commercial Network',  costYr: 4,   hours: { LEO: 3,   SSO: 4,   GEO: 24, L1: 16, MOON: 16, MARS: 16 }, gain: { LEO: 1, SSO: 1, GEO: 1,   L1: 0.3,  MOON: 0.4, MARS: 0.1 },  desc: 'Stations around the globe. Many passes per day near Earth.' },
      { id: 'dsn',  name: 'Deep Space Network',  costYr: 12,  hours: { LEO: 1,   SSO: 1,   GEO: 8,  L1: 8,  MOON: 8,  MARS: 8 },  gain: { LEO: 1, SSO: 1, GEO: 1,   L1: 1,    MOON: 1,   MARS: 1 },    desc: '34–70 m dishes in California, Spain and Australia. Hears the faintest signals, but time is shared and costly.' },
    ],
  },
};

// ── Shadowline (Lunar Ice Prospector only) ──────────────
// Rover + lander packages. Values are simplified, loosely inspired by VIPER-class rovers
// (VIPER: ~430 kg rover, top speed ~0.8 km/h, solar powered, built to survive short shadow trips).
PARTS.rover = {
  label: 'Lunar Rover (with lander)', station: 'hangar', only: 'lunar',
  why: 'A rover can drive into permanently shadowed craters where ice hides. In the dark it runs on battery alone and must keep its heaters on, so battery size decides how long it can stay.',
  options: [
    { id: 'rover_s', name: 'Small Rover', mass: 350, cost: 35, battWh: 1500, panelW: 200, driveW: 110, baseW: 35, heaterW: 70, sampleW: 60, speed: 720, storage: 6000,
      desc: 'Light and cheap. Small battery: short trips into shadow only.' },
    { id: 'rover_m', name: 'VIPER-class Rover', mass: 1100, cost: 90, battWh: 4500, panelW: 450, driveW: 220, baseW: 60, heaterW: 120, sampleW: 120, speed: 600, storage: 16000,
      desc: 'Big battery and a drill. Can stay in the dark much longer, but heavy and costly.' },
  ],
};
PARTS.relay = {
  label: 'Surface Comms Relay', station: 'ground', only: 'lunar',
  why: 'Crater rims block the view of Earth, so a rover inside a crater cannot talk home. A relay can help: your orbiter passes overhead every couple of hours, or a mast on the rim can watch the rover.',
  options: [
    { id: 'none',    name: 'Direct to Earth only', mass: 0,  cost: 0,  desc: 'Cheapest. Works only where the rover can see Earth.' },
    { id: 'orbiter', name: 'Orbiter Relay',        mass: 5,  cost: 6,  desc: 'Your orbiter relays data during short passes (about 20 min every 2 h).' },
    { id: 'mast',    name: 'Rim Relay Mast',       mass: 60, cost: 18, desc: 'A tall mast dropped on the crater rim. Constant link wherever the rover can see the mast.' },
  ],
};

export const HANGAR_CATS = ['bus', 'power', 'battery', 'computer', 'adcs', 'prop'];
export const GROUND_CATS = ['comms', 'gs'];
/** Categories a station shows for a given scenario. */
export const catsFor = (station, scenario) => Object.keys(PARTS).filter(k => PARTS[k].station === station && (!PARTS[k].only || PARTS[k].only === scenario));

export const INSTRUMENTS = [
  { id: 'cam',      name: 'Wide-Field Camera',          icon: '📷', mass: 5,   power: 10,  cost: 3,  data: 20,  sci: 10, point: 0.5,  desc: 'Color pictures of big areas. Cheap and light.' },
  { id: 'hires',    name: 'High-Resolution Telescope',  icon: '🔭', mass: 45,  power: 60,  cost: 30, data: 150, sci: 30, point: 0.95, desc: 'Sees fine detail, but needs rock-steady pointing and produces a flood of data.' },
  { id: 'tir',      name: 'Thermal Infrared Imager',    icon: '🌡️', mass: 15,  power: 25,  cost: 12, data: 30,  sci: 20, point: 0.6,  desc: 'Sees heat: fires, volcanoes, surface temperature, cold traps.' },
  { id: 'hyper',    name: 'Hyperspectral Spectrometer', icon: '🌈', mass: 30,  power: 50,  cost: 22, data: 200, sci: 28, point: 0.8,  desc: 'Splits light into hundreds of colors to identify materials and gases.' },
  { id: 'sar',      name: 'Synthetic Aperture Radar',   icon: '📶', mass: 150, power: 500, cost: 45, data: 300, sci: 32, point: 0.6,  desc: 'Bounces radio waves off the surface. Sees through clouds, smoke and darkness. Extremely power-hungry.' },
  { id: 'lidar',    name: 'Laser Altimeter',            icon: '🎯', mass: 15,  power: 40,  cost: 15, data: 5,   sci: 20, point: 0.75, desc: 'Fires laser pulses to measure terrain height to centimeters.' },
  { id: 'neutron',  name: 'Neutron Spectrometer',       icon: '⚛️', mass: 18,  power: 15,  cost: 14, data: 0.5, sci: 22, point: 0.2,  desc: 'Counts neutrons leaking from the surface; hydrogen (water) changes the count.' },
  { id: 'mag',      name: 'Magnetometer',               icon: '🧲', mass: 3,   power: 4,   cost: 2,  data: 0.2, sci: 8,  point: 0,    desc: 'Measures magnetic fields. Tiny, cheap and doesn\'t need pointing.' },
  { id: 'particle', name: 'Solar Wind Particle Detector', icon: '💨', mass: 8, power: 10,  cost: 6,  data: 1,   sci: 14, point: 0.3,  desc: 'Measures speed and density of charged particles streaming from the Sun.' },
  { id: 'corona',   name: 'Coronagraph',                icon: '🌞', mass: 30,  power: 35,  cost: 18, data: 15,  sci: 26, point: 0.9,  desc: 'Blocks the Sun\'s disk to watch eruptions (CMEs) leave the Sun.' },
];

export const FACTS = [
  'Solar cells near Mars get only ~43% of the sunlight they would at Earth, because light spreads out with distance squared.',
  'The International Space Station loses about 2 km of altitude per month to air drag and must boost itself regularly.',
  'A geostationary satellite is ~36,000 km up — about 90 times higher than the ISS.',
  'Signals from Mars take between 3 and 22 minutes to reach Earth, so rovers and orbiters must act on their own.',
  'Radiation can flip a 0 to a 1 in a computer\'s memory — a "single-event upset".',
  'Most of a rocket\'s launch mass is propellant: often only 2–4% reaches orbit as payload.',
  'Satellites in low Earth orbit see 16 sunrises and 16 sunsets every day.',
  'Deep Space Network dishes in California, Spain and Australia are 120° apart so one can always see a distant spacecraft.',
  'Every kilogram added to a spacecraft needs more fuel, more structure and often a bigger rocket — mass snowballs.',
  'Engineers typically keep 20–30% margins on mass and power early in a design because things always grow.',
];
