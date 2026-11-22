# Vesper City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kriptmwan/vesper-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kriptmwan/vesper-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vesper City** is a complete open-world crime game in the spirit of GTA 6,
built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). It
runs offline in a desktop browser from static files — no build step, no
network requests, no assets to download. Everything is original: the city,
the characters, the story, the art and the music are Vesper City's own.

## The story

Rook Calloway, a getaway driver fresh out of prison, works for fixer Vera
Kline to take Vesper City back from Don Aurelio Voss — one job at a time.
Ten story missions, each with its own verb: steal, tail, breach, heist, race,
boat chase, rescue, takeover, smuggle, takedown.

## The city

Five districts plus the Harbor, all connected by one road grid you can drive
end to end: **Marina Bay** (yachts and smugglers), the **Old Quarter**
(brick lanes and informants), **The Strip** (neon boardwalk and casinos),
**Downtown** (glass towers and the Vesper Bank), **Palm Heights** (hills,
mansions, the Kingpin) and the **Harbor** (docks, containers, patrol boats).

## Systems

- **Wanted 0–5** — patrol cars, roadblocks at 3+, the AIR-1 helicopter at 4+, SWAT vans at 5
- **6-weapon wheel** — Fists, Pistol, SMG, Shotgun, Rifle, Rocket
- **3 crew abilities** — Juno (Ghost Hack), Bishop (Ram Truck), Sable (Ghost Ride)
- **Territory + passive income** — flip districts, get paid every day
- **Garage, 4 tiers** — Street, Sport, Super, Hyper, plus armor and engine upgrades
- **Respect ranks** — Rookie to Kingpin of Vesper
- **Radio, 3 stations** — Vesper FM, Bay Talk, Harbor Blues (synthesized live)
- **Day/night + rain**, **save/load**, **minimap with GPS route**, traffic,
  pedestrians, exploding cars

Systems are data-driven: districts, missions, weapons, crew, radio, garage
tiers and respect ranks live in `game/src/config.js`; the simulation in
`game/src/world.js` is generic over them.

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Drive or walk |
| E | Steal / enter car, exit car |
| Space | Handbrake drift |
| Mouse + Click | Aim and shoot |
| Q | Weapon wheel (hold) |
| 1–6 | Weapons |
| 7 / 8 / 9 | Crew abilities (Juno / Bishop / Sable) |
| N | Current mission briefing |
| R | Cycle radio station |
| P | Pause |
| L | Save game |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Self-test (12 checks) at `http://localhost:8080/?selftest=1`. Staged
screenshots are real gameplay frames: `?shot=world|verb|chase|combat&seed=7`.

## License

MIT — see [LICENSE](LICENSE).
