# Harbour Lights – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/05-harbour-lights.md)*

This document specifies the first playable release (v1). Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting. The economy figures in section 9 in particular are first guesses.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Harbour Lights" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| How the beam is aimed | The concept's open question is now a **player setting**: the beam is turned by dragging sideways, or aimed by touching the sea (section 7). |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, with PixiJS for 2D drawing. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **A lit boat finds its own way home.** Each sea chart carries a pre-worked map of safe routes, and a boat in the light follows it. | Boats must behave predictably when lit, or wrecks feel unfair. The player's job is deciding which boat to light, not steering. |
| A2 | **A boat stays alert for one second after the beam leaves it.** | Makes sweeping between boats workable. Without it, the beam would have to sit on one boat at a time. |
| A3 | **A boat that drifts off the edge of the chart counts as lost,** the same as a wreck. | One clear rule for the three-strikes limit. |
| A4 | **Nights are generated from a seed and a recipe, on hand-made sea charts,** and each is passed by an automatic keeper before release. | Forty nights without hand-scripting every boat, with proof that each can be completed. |
| A5 | **No server, adverts or purchases in v1.** | As for the other games. |

## 3. Scope of v1

**Included:** three boats (fishing boat, dinghy, trawler); rocks, currents and fog; two sea charts and 40 nights; six town buildings with idle earnings; three lighthouse upgrades; townspeople's requests; local save, sound, haptics and settings.

**Not included:** ferry, squalls, whale, Long Watch, Tonight's Forecast, Storm Season, friends' harbours, the placeable second light.

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `harbour-lights` (identifier form `harbourlights` where hyphens are not allowed) |
| App identifier | `<your reverse domain>.harbourlights` (to be supplied) |
| Display name | `Harbour Lights`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
harbour-lights/app/src/
  config/   sim/ (beam, boats, hazards, night rules – no drawing code)   charts/   nights/
  town/ (buildings, idle earnings, requests)   game/   render/   input/   audio/   state/   ui/
harbour-lights/app/tools/ (chart editor, automatic keeper)     harbour-lights/app/tests/
```

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Tile** | Unit of length. The sea is 12 tiles wide and 16 tall, above a 2-tile strip holding the lighthouse and harbour. |
| **Chart** | A layout of rocks, currents and the harbour mouth. |
| **Night** | One level: a chart plus a timed list of arriving boats. |
| **Lit** | Inside the beam. |
| **Alert** | Lit now, or lit within the last second. |
| **Tick** | One simulation step, 1/60 of a second. |

## 6. Simulation

### 6.1 The beam

The lighthouse stands at the bottom centre. The beam is a wedge of light described by:

| Property | Starting value | Upgrades to |
|---|---|---|
| Half-width | 9 degrees | 11, 13 |
| Reach | 13 tiles | 15, 17 |
| Turning speed | 140 degrees per second | 180, 230 |

- The beam's angle runs from 80 degrees left of straight up to 80 degrees right.
- Each tick it turns towards the **target angle** (section 7) at up to its turning speed.
- A boat is **lit** if the line from the lighthouse to the boat is within the half-width of the beam's angle and no longer than the reach.

### 6.2 Fog

A fog bank is a soft-edged circle that drifts slowly. A boat inside fog is lit only if it is within **60% of the beam's reach**. Fog does not hide boats' own lanterns.

### 6.3 Safe routes

For each chart, a grid of quarter-tile squares is worked out once:

```
mark every square within 0.6 tiles of a rock as unsafe
for every safe square, find its distance to the harbour mouth, travelling only through safe squares
```

A boat that follows the direction of falling distance is guaranteed to reach the harbour without touching a rock.

### 6.4 Boats

Each boat has a position, a heading, a speed and a kind.

**Each tick:**

```
if the boat is alert:
    wanted heading = direction of falling distance on the safe-route grid
    turn towards it at the boat's turning rate
    move forward at the boat's speed
    (if it is on an unsafe square, it first heads for the nearest safe one)
else:
    keep its last heading
    move forward at the boat's speed
    also drift with the local current x the boat's drift factor
```

| Boat | Speed | Turning rate | Drift factor | Catch | First appears |
|---|---|---|---|---|---|
| **Fishing boat** | 1.0 tiles/s | 90°/s | 1.0 | 10 coins | Night 1 |
| **Dinghy** | 1.6 tiles/s | 140°/s | 2.0 | 15 coins | Night 4 |
| **Trawler** | 0.7 tiles/s | 35°/s | 0.6 | 35 coins | Night 8 |

The trawler turns slowly, so it must be lit early. The dinghy is quick and easily pushed off course when dark.

**Outcomes**

| Outcome | Condition | Effect |
|---|---|---|
| **Landed** | Reaches the harbour mouth | Its catch is added to the night's total. |
| **Wrecked** | Its centre comes within 0.35 tiles of a rock | Counts against the limit. The crew are shown rowing ashore. |
| **Lost** | Leaves the chart by any edge | Counts against the limit. |
| **Close call** | Passes within 0.8 tiles of a rock while alert | +5 coins. Once per boat. |

Boats do not collide with each other in v1.

### 6.5 Currents

A current is a rectangular zone with a direction and strength (0.2 to 0.8 tiles per second). It moves only boats that are not alert. Currents are drawn as faint streaks.

### 6.6 A night

- Boats arrive according to the night's list. Each entry gives a time, a kind, a point on the top or side edge, and a starting heading aimed loosely at the harbour, off by up to 25 degrees.
- A small lantern marker shows on the edge of the screen 1.5 seconds before a boat appears.
- The night ends when every boat is landed, wrecked or lost, **or when three boats are wrecked or lost**.

| Stars | Condition |
|---|---|
| 3 | No boats wrecked or lost |
| 2 | One |
| 1 | Two |
| Failed | Three. The catch from boats already landed is kept, but the night must be replayed to progress. |

Clean-night bonus: +25% of the catch for three stars.

### 6.7 Fixed step

The simulation runs in fixed ticks of 1/60 second, whatever the frame rate, so a night always plays the same way for the same inputs. This is what lets the automatic keeper test nights.

## 7. How the beam is aimed (player setting)

Setting name: **"Beam control"**. Default: **Drag to turn**.

| Option | Behaviour |
|---|---|
| **Drag to turn** (default) | Dragging left or right anywhere on the screen turns the target angle by 0.5 degrees per point dragged. Lifting the thumb leaves the beam where it is. The thumb can rest low on the screen, clear of the sea. |
| **Touch to aim** | The target angle points at wherever the thumb is touching. Lifting the thumb leaves the beam where it is. Faster for jumping between distant boats, but the thumb covers part of the sea. |

Rules:

- In both options the beam turns towards its target at the same turning speed, so neither can swing the beam faster than the lighthouse allows.
- Width, reach, boats, hazards and stars are identical.
- Drag sensitivity is adjustable (0.3 to 0.8 degrees per point).
- The setting can be changed from Settings or the pause menu and takes effect at once.
- In "Touch to aim", touches on the lower 2-tile strip are ignored for aiming, so the town button and pause are not triggered by accident.

## 8. Charts and nights

### 8.1 Charts

| Chart | Nights | Character |
|---|---|---|
| **Home Bay** | 1–20 | A few scattered rocks, a wide harbour approach. One current from night 5. Light fog from night 15. |
| **The Skerries** | 21–40 | A reef across the middle with two channels through it. Two currents. Heavier fog throughout. |

### 8.2 Night recipes

A night is `{ chart, seed, boats, mix, interval, fog, currentStrength }`. The arrival list is generated from the seed.

| Nights | Boats | Kinds | Interval between arrivals | Hazards |
|---|---|---|---|---|
| 1–3 | 4–6 | Fishing | 9 s | Rocks |
| 4–7 | 7–9 | + Dinghy | 7 s | + Current (5) |
| 8–14 | 9–12 | + Trawler | 6 s | Current |
| 15–20 | 12–15 | All | 5 s | Stronger current; light fog |
| 21–30 | 12–16 | All | 5 s | Reef, two currents, fog |
| 31–40 | 15–20 | All | 4 s | All, stronger |

Arrivals are staggered so that no two boats appear within 1.5 seconds of each other, and at most four are on the sea at once before night 15, six after.

### 8.3 Automatic keeper

A tool plays every night with a simple rule: always turn towards the boat that will come to harm soonest if left dark. A night's seed is accepted only if the keeper earns three stars with the starting lighthouse. If it cannot, the next seed is tried. The accepted seeds are committed with the code.

This proves that every night can be completed cleanly without upgrades, so upgrades make nights more comfortable but are never required.

## 9. The town

### 9.1 Buildings

Each building has five levels. Costs and earnings rise by about 1.8 times per level.

| Building | Unlocks at | First cost | Earns per hour (level 1) | Also |
|---|---|---|---|---|
| **Fish market** | Night 1 (free) | – | 20 | – |
| **Smokehouse** | Night 3 | 150 | 30 | – |
| **Boatyard** | Night 7 | 400 | 40 | Trawlers begin arriving at night 8 |
| **Inn** | Night 12 | 900 | 70 | Townspeople's requests |
| **Chandlery** | Night 18 | 1,800 | 110 | Lighthouse upgrades cost 10% less |
| **Pier** | Night 25 | 3,500 | 180 | – |

### 9.2 Idle earnings

- Buildings earn continuously, including while the app is closed, measured by the device clock.
- Earnings are stored for up to **4 hours**, then stop until collected.
- Collecting is one tap on the harbour.
- Setting the device clock forward can claim at most one full store, which is accepted in v1.

### 9.3 Lighthouse upgrades

| Upgrade | Levels | Costs |
|---|---|---|
| Wider beam | 2 | 500, 2,000 |
| Longer reach | 2 | 400, 1,600 |
| Faster turn | 2 | 300, 1,200 |

### 9.4 Requests

Once the inn is built, one townsperson's request is active at a time, for example "Land 5 trawlers" or "Finish a night with no close calls". Completing it pays 50 to 300 coins and brings the next.

### 9.5 Balance target

A player who plays three nights and collects twice a day should afford a new building or level about once a day in the first week. This is the figure the economy is tuned against.

## 10. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on a night with one boat heading for one rock, and a hand icon showing a sideways drag. Then two boats from opposite sides. Then the first catch builds the fish market and the town is shown. |
| **Home (the town)** | The town above the harbour, lit windows, collect button, Next night, Buildings, Lighthouse, Settings. Shows coins. |
| **Night** | Sea fills the screen; lighthouse bottom centre. Top: night number, boats remaining, three strike markers, pause. |
| **Night over** | Stars, boats landed, catch, bonuses, request progress. Buttons: Next night, Replay, Town. |
| **Buildings / Lighthouse** | Cards with level, earnings and upgrade cost. |

## 11. Drawing and feedback

- **Darkness and light:** the sea is drawn dark blue. The beam is a warm wedge that brightens everything inside it: waves, rocks and boats. Rocks are faintly visible in the dark by their foam, and clearly visible when lit.
- **Boats** each carry a small lantern so they can always be found.
- **Town** windows multiply as buildings are added and upgraded.

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Beam turning | Wedge sweeps; water glints | Low mechanical hum, rising with speed | None |
| Boat becomes lit | Brightens; gives a relieved bob | Soft bell | Light tick |
| Boat in danger (dark, rock ahead within 3 seconds) | Flashing marker above it | Low foghorn | Double pulse |
| Close call | Spray; "+5" | Splash | Light pulse |
| Landed | Flare of light at the harbour; coins | Warm chime, rising with each in a row | Soft pulse |
| Wrecked or lost | Boat tips; crew row ashore; a strike marker fills | Creak and splash | Firm pulse |
| Night over | Dawn glow on the horizon | Gentle folk phrase | One pulse per star |

With "Reduce motion" on, the water glints and spray are removed. Every sound cue has a visual equivalent, and the danger marker in particular never relies on the foghorn alone.

## 12. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Beam control | Drag to turn / Touch to aim | Drag to turn |
| Drag sensitivity | 0.3–0.8 | 0.5 |
| Music, sound effects, vibration | On / Off each | On |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every night and every purchase: settings; coins; per-night stars and best catch; building levels; lighthouse upgrades; the active request and its progress; and the time earnings were last collected. A `version` number allows later builds to convert older saves. A night in progress is not saved. Nothing leaves the device.

## 13. Tools and testing

**Chart editor** (browser page, developer only): place rocks, currents and the harbour mouth; display the safe-route grid; run any night on the chart with the real simulation.

**Automated tests**

- A boat is lit exactly when it is inside the beam's angle and reach, with the reduced reach in fog.
- A boat stays alert for one second after the beam leaves it, and no longer.
- A boat kept alert from arrival always reaches the harbour, from every edge position on every chart.
- A dark boat holds its heading and drifts only inside a current.
- The beam never turns faster than its turning speed in either control option.
- A night ends at the third wreck or loss.
- Idle earnings stop at four hours' worth.
- Every accepted night earns three stars under the automatic keeper with the starting lighthouse.

**Acceptance criteria**

1. A new player is turning the beam within 5 seconds of launch.
2. The beam-control setting takes effect immediately.
3. It is always possible to tell at a glance which boats are lit.
4. Fully playable with sound and vibration off, and in aeroplane mode.
5. 60 frames per second on the minimum phones with six boats and fog.

## 14. Build order

| Stage | Deliverable |
|---|---|
| 1 | Beam, lit test, one boat kind and rocks in a browser with plain shapes — **proves that juggling boats with one beam is fun** |
| 2 | Safe-route grid; chart editor; both control options |
| 3 | Dinghy, trawler, currents, fog, night rules and stars |
| 4 | Night generator and automatic keeper; 40 accepted nights |
| 5 | Town, idle earnings, upgrades, requests, save |
| 6 | Economy tuning against the balance target |
| 7 | Artwork, lighting, sound, haptics |
| 8 | Android and iOS packaging |

## 15. Risks

| Risk | Mitigation |
|---|---|
| **Two games in one: the nights and the town.** | The town never blocks play; nights can always be played. Stage 1 tests the nights alone. |
| **Economy balance.** | One stated target (9.5), tuned in its own stage. All figures in one file. |
| **Wrecks that feel unfair.** | Lit boats always find a safe route; a one-second alert period; a danger marker three seconds ahead; less predictable hazards such as the whale are held back for later versions. |
| **Idle earnings make nights pointless, or the reverse.** | The four-hour store limits idle income; night catches scale with night number. |
| **"Touch to aim" hides the sea under the thumb.** | It is the alternative, not the default, and is described as such in Settings. |

## 16. Open questions

1. Are assumptions A1 to A5 acceptable, in particular a lost boat counting the same as a wreck (A3)?
2. What is the app identifier (reverse domain)?
3. Should a failed night keep the catch from boats already landed, as specified?
