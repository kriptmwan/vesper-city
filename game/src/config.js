// Vesper City — data-driven configuration.
// Every district, mission, weapon, crew member, radio station, garage tier and
// respect rank is data here, so the game's content is declarative and the
// simulation code in world.js stays generic. Nothing here is Rockstar content:
// the city, people, story and names are original to Vesper City.
export const WORLD = { w: 3400, h: 2600, roadGap: 340, blockPad: 26 };

export const DISTRICTS = [
  { id: 'marina', name: 'Marina Bay', color: '#2e7f8f', ground: '#3f6b5a', label: 'MARINA BAY', x: 0, y: 0, w: 1150, h: 900, blurb: 'Yachts, fish markets, smugglers' },
  { id: 'oldtown', name: 'Old Quarter', color: '#b06a2c', ground: '#6b5a3f', label: 'OLD QUARTER', x: 1150, y: 0, w: 1050, h: 900, blurb: 'Brick lanes, pawnshops, informants' },
  { id: 'strip', name: 'The Strip', color: '#c22e8a', ground: '#5a3f6b', label: 'THE STRIP', x: 2200, y: 0, w: 1200, h: 900, blurb: 'Neon boardwalk, casinos, clubs' },
  { id: 'downtown', name: 'Downtown', color: '#3f6fb0', ground: '#4a4a55', label: 'DOWNTOWN', x: 0, y: 900, w: 1700, h: 850, blurb: 'Glass towers, the Vesper Bank' },
  { id: 'heights', name: 'Palm Heights', color: '#4f9a3f', ground: '#44543f', label: 'PALM HEIGHTS', x: 1700, y: 900, w: 1700, h: 850, blurb: 'Hills, mansions, the Kingpin' },
  { id: 'harbor', name: 'Harbor', color: '#1d5f7a', ground: '#22444f', label: 'HARBOR', x: 0, y: 1750, w: 3400, h: 850, blurb: 'Docks, containers, boat chases' },
];

// Story: Rook Calloway, a getaway driver fresh out of prison, works for fixer
// Vera Kline to take Vesper City back from Don Aurelio Voss, one job at a time.
export const MISSIONS = [
  { id: 'm1', name: 'Hotwire', verb: 'steal', text: 'Steal a car from the Marina lot', reward: 400, respect: 10, target: { x: 420, y: 300 } },
  { id: 'm2', name: 'Tail Job', verb: 'tail', text: 'Tail the courier. Stay out of sight.', reward: 600, respect: 15, target: { x: 1500, y: 500 } },
  { id: 'm3', name: 'Prison Van Breakout', verb: 'breach', text: 'Ram the van, then let Juno hack the lock', reward: 1200, respect: 25, target: { x: 900, y: 1200 } },
  { id: 'm4', name: 'The Marina Job', verb: 'heist', text: 'Hit the Vesper Bank — loud or quiet, your call', reward: 5000, respect: 40, target: { x: 800, y: 1150 } },
  { id: 'm5', name: 'Neon Grand Prix', verb: 'race', text: 'Win the Strip street race', reward: 2000, respect: 30, target: { x: 2700, y: 500 } },
  { id: 'm6', name: 'Harbor Run', verb: 'boat chase', text: 'Outrun the patrol boats to the dead drop', reward: 2500, respect: 35, target: { x: 2900, y: 2100 } },
  { id: 'm7', name: 'Extraction', verb: 'rescue', text: 'Pull Juno out of the police cordon', reward: 1800, respect: 30, target: { x: 1400, y: 1400 } },
  { id: 'm8', name: 'Take the Strip', verb: 'takeover', text: 'Flip the Strip to your crew', reward: 3000, respect: 50, target: { x: 2700, y: 400 } },
  { id: 'm9', name: 'Dead Drop', verb: 'smuggle', text: 'Deliver the package while the city is searched', reward: 2200, respect: 35, target: { x: 3200, y: 2000 } },
  { id: 'm10', name: 'Kingpin', verb: 'takedown', text: 'Take down Don Aurelio Voss at the Heights', reward: 10000, respect: 100, target: { x: 2500, y: 1200 } },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', dmg: 12, rate: 0.35, range: 46, auto: false, color: '#d8c49a' },
  { id: 'pistol', name: 'Pistol', dmg: 22, rate: 0.28, range: 420, auto: false, color: '#c8c8d0' },
  { id: 'smg', name: 'SMG', dmg: 14, rate: 0.09, range: 380, auto: true, color: '#8fb8d8' },
  { id: 'shotgun', name: 'Shotgun', dmg: 34, rate: 0.8, range: 260, auto: false, color: '#d88f4f' },
  { id: 'rifle', name: 'Rifle', dmg: 40, rate: 0.16, range: 620, auto: true, color: '#e0a030' },
  { id: 'rocket', name: 'Rocket', dmg: 120, rate: 1.4, range: 700, auto: false, color: '#e05050' },
];

export const CREW = [
  { id: 'juno', name: 'Juno', role: 'Hacker', ability: 'Ghost Hack', desc: 'Drops 2 wanted stars and opens locked doors', cooldown: 45 },
  { id: 'bishop', name: 'Bishop', role: 'Muscle', ability: 'Ram Truck', desc: 'Calls a truck that smashes a roadblock', cooldown: 60 },
  { id: 'sable', name: 'Sable', role: 'Driver', ability: 'Ghost Ride', desc: 'Delivers a tuned car and repairs yours', cooldown: 50 },
];

export const RADIO = [
  { id: 'vesperfm', name: 'VESPER FM', genre: 'Synthwave', bpm: 112, wave: 'sawtooth', bass: [55, 55, 65.4, 49] },
  { id: 'baytalk', name: 'BAY TALK', genre: 'Talk radio', bpm: 0, wave: 'sine', bass: [0] },
  { id: 'harborblues', name: 'HARBOR BLUES', genre: 'Blues', bpm: 84, wave: 'triangle', bass: [73.4, 65.4, 58.3, 65.4] },
];

export const GARAGE_TIERS = [
  { tier: 1, name: 'Street', cars: ['Dune', 'Civic'], topSpeed: 340, price: 0 },
  { tier: 2, name: 'Sport', cars: ['Falcon GT', 'Comet'], topSpeed: 420, price: 2500 },
  { tier: 3, name: 'Super', cars: ['Vesper S', 'Nightowl'], topSpeed: 500, price: 8000 },
  { tier: 4, name: 'Hyper', cars: ['Apex One'], topSpeed: 580, price: 20000 },
];

export const RESPECT_RANKS = [
  { at: 0, name: 'Rookie' },
  { at: 50, name: 'Hustler' },
  { at: 150, name: 'Made' },
  { at: 300, name: 'Boss' },
  { at: 500, name: 'Kingpin of Vesper' },
];

export const TUNING = {
  playerWalk: 210, playerRun: 300, carAccel: 520, carBrake: 700, carGrip: 2.6,
  carMaxBase: 460, wantedDecay: 0.05, copSpeed: 400, heliSpeed: 330,
  trafficCount: 26, pedCount: 42, parkedCount: 22, bulletSpeed: 900,
  dayLength: 240, incomePerDistrict: 150, maxWanted: 5,
};
