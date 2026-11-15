# Tide Pool – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/01-tide-pool.md)*

This document specifies the first playable release (v1) in enough detail to build from. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Tide Pool" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Flow rate | A **player setting** (section 7). The concept's open question, whether the player should steer the current by where they hold, is closed: the current's direction is fixed by each level, and its speed is set by the player. |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, for iOS and Android from one codebase. |

**Meaning of "flow rate" (confirmed 15 November 2026):** the speed at which the current carries floating creatures sideways. It does not change how fast the tide rises and falls, which stays tied to the player's thumb.

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **2D drawing with PixiJS** inside the same TypeScript and Capacitor shell. | The game is a side-on 2D scene with sprites and a water surface. PixiJS draws this quickly on phones. |
| A2 | **Simplified water, not a fluid simulation.** The sea is one level that rises and falls; pools keep water up to their rims. Creatures follow simple rules (section 6). | Predictable and fair: the player can always tell what the water will do. It also runs identically on every device, which lets levels be checked automatically. |
| A3 | **Levels are hand-built** in a level editor that is part of this project, and stored as small data files. | The puzzle depends on designed rock shapes. Random generation would not give reliable quality. |
| A4 | **Every level is checked by an automatic player** before release, which also sets its star targets (section 9). | Guarantees each level can be completed, at every flow-rate setting. |
| A5 | **No server, adverts or purchases in v1.** Boosters are bought with shells earned in play. | As for the other games. |

## 3. Scope of v1

**Included**

- Four creatures: starfish, crab, limpet, jellyfish
- Shore features: currents, seaweed, gulls
- 100 levels in four stages
- The reef, with decorations and resident creatures
- Daily Low Tide level, with streak
- Two boosters: Slack Water and Rescue
- Level editor and automatic level checker (development tools)
- Local save, sound, haptics, settings including flow rate

**Not included (planned for later)**

- Fish, hermit crab and urchin
- Channels, sluice rocks and currents that change mid-level
- Coastline events, friends' reefs, the field guide, leaderboards

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `tide-pool` (identifier form `tidepool` where hyphens are not allowed) |
| App identifier | `<your reverse domain>.tidepool` (to be supplied) |
| Display name | `Tide Pool`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
tide-pool/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      sim/        water, tide, creatures, win and fail rules     (no drawing code)
      levels/     level format, loader, level files
      game/       states, stars, boosters, modes
      reef/       reef contents, decoration, idle gifts
      render/     PixiJS scene, water surface, sprites, effects
      input/      hold and release
      audio/      sound, music, haptics
      state/      save data, settings
      ui/         menus and overlays
    tools/
      editor/     browser-based level editor
      checker/    automatic player and level report
    tests/
```

`sim/` must not import anything from `render/`. It is tested, and used by the level checker, without a screen.

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Tile** | The unit of length. The playfield is 12 tiles wide and 18 tall. |
| **Column** | A vertical strip half a tile wide. The playfield has 24 columns. |
| **Sea level** | The height of the tide at this moment. One value for the whole scene. |
| **Pool** | A hollow in the rock that keeps water when the tide is out. |
| **Rim** | The height at which a pool overflows: the lower of its two sides. |
| **Tick** | One simulation step, 1/60 of a second. |
| **Tide cycle** | One rise and fall of the sea. |

Heights are measured upwards from the bottom of the playfield. Speeds are in tiles per second.

## 6. Simulation

### 6.1 Shore

The shore is a **height profile**: one rock height for each of the 24 columns, in steps of a quarter tile. Each side of the playfield is either a cliff (water cannot escape) or open, as the level states.

From the profile, the game works out once per level:

```
for each column i:
    fillLevel[i] = the lower of (highest rock at or left of i) and (highest rock at or right of i)
    isPool[i]    = fillLevel[i] > rock[i]

a pool = an unbroken run of pool columns;  its rim = their shared fillLevel
```

This is the level to which a hollow fills before spilling. A level designer never marks pools by hand; they follow from the rock shape. The designer only states which creature each pool accepts.

### 6.2 Water

At any moment, with sea level **W**:

```
surface[i]    = the higher of W and fillLevel[i]
depth[i]      = surface[i] - rock[i]                 (zero or less means dry rock)
openWater[i]  = W > rock[i]  and  W >= fillLevel[i]  (the sea covers this column)
cutOff[i]     = isPool[i]  and  W < fillLevel[i]     (a pool left behind by the tide)
```

So pools always hold water, the sea rises over everything as one level, and a pool is "cut off" once the sea drops below its rim.

### 6.3 Tide

The player's input is one thing: held, or not held.

```
target = held ? HIGH_WATER : LOW_WATER               (set per level)
W moves towards target at up to RISE_SPEED when rising, FALL_SPEED when falling,
  eased over TIDE_EASE so it starts and stops softly
```

| Constant | Value |
|---|---|
| RISE_SPEED | 1.5 tiles per second |
| FALL_SPEED | 1.2 tiles per second |
| TIDE_EASE | 0.15 seconds |

A **tide cycle** is counted each time the sea returns to within 0.1 of low water after having risen at least 0.5 above it.

### 6.4 Current

Each level states a current **direction** (left or right) and a **base speed** (typically 0.8 to 1.6 tiles per second). The speed actually used is:

```
currentSpeed = level base speed x flow-rate setting (section 7)
```

The current acts only in open water. A cut-off pool is still.

### 6.5 Creatures

Each creature has a position, a kind, a state and the kind of pool it belongs in. All four kinds share one set of rules with different constants.

**Floaters (starfish, jellyfish, and a released limpet), each tick:**

```
if depth at the creature's column >= FLOAT_DEPTH:
    state = FLOATING
    rise or sink smoothly towards the surface
    if open water:
        try to move sideways by currentSpeed x DRIFT x dt
        the move is blocked if the rock in the next column is higher than (surface - 0.15)
    else (cut-off pool):
        drift gently towards the pool's deepest point at 0.3 tiles per second
else:
    state = RESTING on the rock
```

**Crab, each tick:**

```
never floats; the current does not move it
if the water covers it by at least 0.1:
    walk towards whichever neighbouring column is lower, at 1.2 tiles per second
    it cannot climb, and stops at the lowest point it can reach
else:
    stay still
```

**Limpet:** starts CLINGING and ignores the water. When the water above it has been at least 1.0 deep for 0.5 seconds, it lets go and behaves as a floater. The next time it rests on rock, it clings again.

| Creature | FLOAT_DEPTH | DRIFT | Notes |
|---|---|---|---|
| Starfish | 0.30 | 1.0 | The basic floater. |
| Jellyfish | 0.15 | 1.6 | Lifts off in shallower water and travels further. |
| Limpet (released) | 0.30 | 1.0 | Must first be fully covered. |
| Crab | – | – | Walks downhill under water. |

Creatures do not collide with each other in v1.

### 6.6 Seaweed

A patch of seaweed occupies one or two columns. A floater that drifts into it is held there until one full tide cycle has passed, then released. The crab is unaffected.

### 6.7 Stranding and gulls

A creature is **exposed** when it is resting on rock that is not in a pool and the sea is below it.

- An exposed creature shows a worried face, and a gull's shadow circles above it.
- After **STRAND_TIME = 4 seconds** of continuous exposure, a gull carries it off and the level is lost.
- Covering the creature with water again resets its timer.
- A clinging limpet is never exposed. It is at home on rock.

### 6.8 Winning and losing

**Win:** every creature is inside a pool that accepts its kind, and the sea is below those pools' rims, for 0.5 seconds without a break.

**Lose:** a gull takes a creature. One tap restarts the level instantly.

A creature in the wrong pool is not a failure. It looks unhappy, and the player can float it out on the next tide.

### 6.9 Fixed step

The simulation runs in fixed ticks of 1/60 second, whatever the screen's frame rate, and uses only basic arithmetic. The same level and the same sequence of holds therefore always give the same result. This is what allows the automatic checker (section 9) to play levels thousands of times, and would allow replays later.

### 6.10 Boosters

| Booster | Effect | Cost |
|---|---|---|
| **Slack Water** | The current stops for 5 seconds. | 25 shells |
| **Rescue** | The creature closest to being taken is lifted to the nearest water and its strand timer reset. | 40 shells |

Each can be used once per level attempt. The player starts with two of each, free.

## 7. Flow rate (player setting)

Setting name: **"Flow rate"**. Default: **Normal**.

| Option | Current speed | Character |
|---|---|---|
| **Gentle** | 0.6 × the level's base speed | More time to judge each release. Suits new and younger players. |
| **Normal** | 1.0 × | As designed. |
| **Brisk** | 1.5 × | Quick reactions needed. |

Rules:

- The setting changes **only the sideways speed of the current**. Tide speed, creature rules and the gull timer are unchanged.
- It applies in every mode and can be changed from Settings or the pause menu. A change takes effect when the current level is next started or restarted, never mid-attempt.
- **Stars are unaffected.** Stars depend on tide cycles used, and the number of cycles a level needs does not depend on how fast the current runs, because the player chooses how long to hold the tide in. The automatic checker confirms this for every level at all three rates.
- A level completed at Brisk shows a small wave mark beside its stars. It carries no reward; it is there for players who want the challenge.
- The seaweed hold and all timers are measured in tide cycles or seconds, so they behave the same at every rate.

## 8. Levels

### 8.1 Level file

```json
{
  "id": 37,
  "stage": 2,
  "rock": [6, 6, 5.5, 3, 3, 3, 5, 5, 5.25, "… 24 heights in all"],
  "leftEdge": "cliff",
  "rightEdge": "open",
  "lowWater": 2.0,
  "highWater": 9.0,
  "current": { "direction": "right", "speed": 1.2 },
  "pools": [ { "columns": [3, 5], "accepts": "starfish" } ],
  "creatures": [ { "kind": "starfish", "column": 20 } ],
  "seaweed": [ { "columns": [11, 12] } ],
  "par": 3,
  "springTide": false
}
```

`pools.columns` is filled in by the editor from the rock shape; the designer chooses only `accepts`. `par` is written by the checker.

### 8.2 Progression

| Stage | Levels | Creatures per level | Introduces |
|---|---|---|---|
| 1 | 1–20 | 1–2 | Starfish (level 1), current (2), two creatures (3), crab (8), gulls active from level 5 |
| 2 | 21–45 | 2–3 | Limpet (21), seaweed (30) |
| 3 | 46–75 | 3–4 | Jellyfish (46), mixed kinds, longer shores |
| 4 | 76–100 | 4–6 | Sequencing: which creature to place first |

- Every new creature or feature first appears alone, on a level that can be completed in one or two cycles.
- One level in five is a harder **spring tide** level, flagged on the map, paying double shells.
- Levels 1 to 4 have no gulls, so the first minutes cannot be failed.

### 8.3 Daily Low Tide

- A separate set of 30 levels, played in rotation by date, so every player gets the same one each day.
- Low water is set lower than usual, uncovering a pool that holds a rare colour variant of a creature. Completing the level adds that variant to the reef.
- One completion per day; a streak counts consecutive days.

### 8.4 Stars and shells

| Stars | Condition |
|---|---|
| 3 | Tide cycles ≤ par |
| 2 | Tide cycles ≤ par + 2 |
| 1 | Completed |

Shells: 10 per level completed, plus 5 per star, doubled on spring tide levels. Replays pay only for stars newly earned.

## 9. Development tools

### 9.1 Level editor

A browser page, for the developer only, that:

- draws the rock profile by dragging column heights
- shows pools and their rims as they form
- places creatures and seaweed, and sets which creature each pool accepts
- sets low water, high water, current direction and speed
- plays the level immediately, using the same simulation as the game
- saves and loads level files

### 9.2 Automatic checker

Because the simulation is exact and the only input is hold or release, a level can be searched by machine.

```
check(level, flowRate):
    search over sequences of (hold for h, release for r),
        with h and r in steps of 0.25 seconds, up to 12 cycles,
        discarding any sequence in which a creature is taken
    return the fewest cycles that win, or "unsolvable"
```

For every level the checker reports, at each of the three flow rates:

- whether it can be completed
- the fewest cycles needed (which sets `par`)
- how much timing leeway the best solution has: the smallest change in any hold or release that makes it fail

A level is released only if it is solvable at all three rates with the same par, and its leeway at Brisk is at least 0.25 seconds in stage 1 and 0.15 seconds later. The report is committed with the levels.

## 10. The reef

| Feature | Rule |
|---|---|
| **Residents** | The first time each creature kind, and each rare variant, is rescued, it joins the reef and swims or sits there. |
| **Decorations** | Coral, rocks, plants and ornaments bought with shells (20 to 300 each) and placed on a grid of slots. The arrangement is saved. |
| **Gifts** | Residents leave shells over time: 2 per resident per hour, storing up to 4 hours. Tapping collects them. |
| **Growth** | The reef widens at 25, 50 and 75 levels completed, adding slots. |

Time away is measured from the device clock. Setting the clock forward can claim at most one full store, which is accepted in v1.

## 11. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on level 1: one starfish, one pool above it, and a hand icon showing a hold. No menu. After level 3 the reef and Home screen appear. |
| **Home** | Play (next level), Daily Low Tide, Level map, Reef, Settings. Shows shells and streak. |
| **Level map** | A coastline path of 100 levels with stars, spring tide flags and Brisk marks. |
| **Level** | The shore fills the screen. Top: level number, tide cycles used against par, pause. Bottom corners: the two booster buttons. The whole screen is the hold area. |
| **Level complete** | Stars, shells earned, any new resident. Buttons: Next, Replay, Reef. |
| **Level lost** | The gull flies off; "Try again" appears at once. No penalty. |
| **Reef** | The aquarium scene, shop drawer, collect button. |
| **Settings / Pause** | See section 13. |

Layout rules: the booster buttons are at least 56 × 56 points and placed where a resting thumb does not cover a pool; safe areas are respected; each pool shows the outline and colour of the creature it accepts, so matching never depends on colour alone.

## 12. Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Holding | Water rises; ripples spread from the thumb | Swell rising in pitch with the water | Slow, soft pulse while held |
| Releasing | Water falls | Swell falling | None |
| Creature lifts off | Bubbles; creature bobs | Soft "bloop" | None |
| Creature settles in its own pool | Small splash, sparkle, happy face | "Plop", one note higher for each in a row | Light pulse |
| Creature settles in the wrong pool | Puzzled face | Low "plop" | None |
| Creature exposed | Worried face; gull shadow circles | Distant gull call | Double pulse at the start |
| Gull takes a creature | Gull swoops and leaves | Wing flap | Firm pulse |
| Level complete | Creatures wave; shells burst | Short marimba flourish | One pulse per star |

The water surface is always drawn with a bright, clear line so the tide's height is unmistakable. With "Reduce motion" on, ripples and splashes become simple fades. Every sound has a visual equivalent, so the game is fully playable in silence.

## 13. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Flow rate | Gentle / Normal / Brisk | Normal |
| Music, sound effects, vibration | On / Off each | On |
| Creature outlines on pools | On / Off | On |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every level and every reef change: settings; shells; boosters held; for each level, best stars, fewest cycles and whether completed at Brisk; Daily Low Tide history and streak; reef residents, decorations and their positions; and the time gifts were last collected. A `version` number allows later builds to convert older saves. No personal data is collected and nothing leaves the device.

A level in progress is not saved. Levels last about a minute, and restarting is instant.

## 14. Testing

**Simulation (automated)**

- Pools and rims worked out from a rock profile match hand-checked examples, including nested hollows and open edges.
- With the sea at low water, every pool still holds water to its rim.
- A floater never passes through rock higher than the surface.
- The current never moves a creature inside a cut-off pool.
- A crab only ever moves downhill, and only under water.
- A limpet releases only after being covered to the required depth for the required time.
- The strand timer resets when a creature is covered again.
- The same level and inputs always give the same result.
- Changing the flow rate changes drift speed and nothing else.

**Levels (automated, by the checker)**

- All 100 levels and all 30 Daily Low Tide levels are solvable at Gentle, Normal and Brisk, with the same par.
- Every level meets the timing-leeway minimum.

**Acceptance criteria for v1**

1. A new player is holding the tide within 5 seconds of launch, and completes level 1 within 15.
2. The water visibly follows the thumb with no perceptible delay.
3. Changing the flow rate takes effect from the next start of a level.
4. The game is fully playable with sound and vibration off.
5. The game works in aeroplane mode.
6. A steady 60 frames per second on the minimum phones with six creatures on screen.

## 15. Build order

| Stage | Deliverable | Purpose |
|---|---|---|
| 1 | Simulation: shore, water, tide, starfish; tests | Proves the water model. |
| 2 | Playable prototype in a browser with plain shapes, and three test levels | **Proves the feel of thumb and tide.** The game depends on this stage. |
| 3 | Level editor | Needed before any real levels are made. |
| 4 | Crab, limpet, jellyfish, seaweed, gulls, win and lose rules | |
| 5 | Automatic checker; flow-rate setting | Checked content. |
| 6 | Levels 1–100 and 30 Daily Low Tide levels | The largest task. |
| 7 | Stars, shells, boosters, level map, reef, save | |
| 8 | Artwork, water effects, sound, haptics | |
| 9 | Android and iOS packaging | |

## 16. Risks

| Risk | Mitigation |
|---|---|
| **The tide does not feel good under the thumb.** | Stage 2 tests it with plain shapes before anything else is built. Rise speed, fall speed and easing are tuning constants. |
| **130 hand-built levels is a lot of design work.** | The editor and checker make each level quick to build and verify. v1 could launch with stages 1 to 3 (75 levels) and add stage 4 as an update. |
| **One input may limit variety.** | Four creature kinds with distinct rules, seaweed, and rock shape carry the variety; three more creatures and three more features are held for updates. |
| **Simplified water looks artificial.** | The drawn surface has waves, foam and ripples layered on top of the single level. Only the appearance is embellished; the rules stay simple. |
| **Brisk flow makes some levels unfairly tight.** | The checker enforces a minimum timing leeway at Brisk on every level. |

## 17. Open questions

1. Are assumptions A1 to A5 acceptable?
2. What is the app identifier (reverse domain)?
3. Should v1 launch with all 100 levels, or with 75 and the fourth stage as an update?
4. Should creatures be able to bump into one another? As specified, they pass through each other in v1.
