# Harbour Lights – v1

A lighthouse-keeping game for iOS and Android. It is built from
[`../build-specification.md`](../build-specification.md) and the guidance in
[`../../mobile-game-report.md`](../../mobile-game-report.md). Menus, sheets and
buttons follow the supplied *Battle Game Apps UI Kit* Figma file: deep violet
cards, glowing cyan pill buttons and Readex Pro type. The sea is drawn dark
blue, and the beam is warm.

Turn the lighthouse beam to light the boats coming home:

- A boat in the light (or lit within the last second) finds its own safe way home.
- A boat in the dark keeps going straight, pushed by the currents, and may hit a rock.
- Three boats wrecked or lost ends the night.
- Landed catches build up the town, which earns coins while you are away and pays for lighthouse upgrades.

## Running it

```bash
npm install
```

```bash
npm run dev          # play in a browser at http://localhost:5173
```

```bash
npm test             # simulation, nights, keeper, town and save (21 tests)
```

```bash
npm run build        # type-check and build to dist/
```

Tools:

```bash
npm run nights       # chooses each night's seed with the automatic keeper; writes src/nights/accepted.json
```

```bash
npm run nights -- --check   # re-verifies the committed seeds
```

```bash
npm run economy      # simulates a week against the balance target (§9.5)
```

```bash
npx tsx tools/routes-check.ts   # every kept-lit start from every edge reaches the harbour
```

**Chart editor** (developer only): run `npm run dev`, then open
`http://localhost:5173/tools/chart-editor/`. Use it to place rocks, currents and
the harbour mouth, see the safe-route grid, and run any night on the chart with
the real simulation and the keeper.

### Phones

The native projects are in `android/` and `ios/` (Capacitor 7). Minimum
versions are Android 8.0 (API 26) and iOS 15. The app runs in portrait only.

```bash
npm run android      # build, copy into android/, open Android Studio
```

```bash
npm run ios          # build, copy into ios/, open Xcode (macOS; run `pod install` in ios/App first)
```

Before release, set the real app identifier in `src/config/app.ts`. It is
currently the placeholder `com.example.harbourlights` (§16, question 2).

## Layout (as §4)

```
src/
  config/   app.ts (name, id, save key), tuning.ts (every tuning constant)
  sim/      beam, safe routes, the night (boats, hazards, rules), keeper, rng – no drawing code
  charts/   Home Bay and The Skerries
  nights/   recipes, arrivals and fog from the seed, accepted.json, the tutorial nights
  town/     buildings, idle earnings, upgrades, requests
  game/     progress: recording nights, purchases, unlocking
  render/   Pixi sea view and town view
  input/    beam control (drag to turn / touch to aim)
  audio/    synthesised sound, haptics
  state/    save.ts – one JSON document, versioned
  ui/       app, night screen, home (town), sheets, styles
tools/      nights.ts, economy.ts, routes-check.ts, chart-editor/
tests/
```

## How the spec is met

**Fixed step (§6.7).** The simulation runs in ticks of 1/60 second, whatever the
frame rate. The same night with the same inputs always plays the same way, and
this is tested.

**Safe routes (§6.3, A1).** Each chart gets a quarter-tile grid, marked unsafe
within 0.6 tiles of a rock. Each safe square stores its distance to the harbour
mouth. A lit boat follows the route of falling distance. It steers for the
furthest point within 1.4 tiles that it can reach in a straight, safe line, so it
never cuts a corner into the unsafe band. A test checks every edge start on both
charts, for every boat kind, with headings 25° either side: all 1,134 cases kept
alert reach the harbour.

**Automatic keeper (§8.3).** The keeper always turns the beam towards the boat
that will come to harm soonest if left dark. A night's seed is accepted only if
the keeper earns three stars with the starting lighthouse. All 40 accepted seeds
are committed, and a test replays every one.

**Beam control (§7).** Both "Drag to turn" (the default, 0.3–0.8° per point) and
"Touch to aim" set only the beam's target. The beam itself never turns faster
than its turning speed; this is tested for both options and every upgrade.
Changing the setting from Settings or the pause menu takes effect at once,
mid-night included. In "Touch to aim", touches on the harbour strip are ignored.

**Feedback (§11):**

- Lit boats brighten, glow, give a small bob and get a light ring, so which boats are lit can be seen at a glance (acceptance 3).
- A dark boat with harm ahead within 3 seconds shows a flashing warning triangle as well as sounding the foghorn.
- A lantern pulses on the edge 1.5 seconds before each arrival.
- Wrecked crews row ashore.
- Strike markers fill at the top of the screen.
- Dawn glows at the end of the night.
- With "Reduce motion" on, water glints, spray and bobbing are removed.

**First launch (§10).** The game opens straight on a tutorial night: one boat
heading for one rock, with a hand showing the sideways drag. Then come two boats
from opposite sides. Their catch builds the fish market, and the town is shown.
In a browser test, the first night appears in about 1.2 seconds.

**Town (§9).**
- Six buildings with five levels each.
- Idle earnings measured by the device clock, stopping at four hours' worth. A clock set backwards earns nothing; one set forwards can claim at most one full store.
- Collecting is one tap.
- Three lighthouse upgrades of two levels each; the chandlery takes 10% off them.
- Requests once the inn is built, paying 50 to 300 coins.

**Saving (§12).** The game saves after every night and every purchase. A night in
progress is not saved. Nothing leaves the device.

## Checked in a browser

These checks used Playwright against `vite preview` at 390 × 844:

- First launch lands on the tutorial night with the hand hint.
- Dragging the beam onto the boat lands it.
- In the town, collecting earnings works, and the Buildings and Lighthouse sheets open.
- Night 15 (fog and a current) and night 25 (the Skerries) play through to the result sheet, and the night is recorded.
- Switching to "Touch to aim" in the pause menu takes effect at once, and touching the sea aims the beam.
- The chart editor checks every edge start on the Skerries (504/504 land) and runs night 22 with the keeper.

## Decisions and deviations

- **Fair arrivals.** The starting beam reaches only 13 tiles, so the top three or four rows of the sea cannot be lit. The generator therefore rejects any start where a boat left dark would come to harm before spending 3.5 seconds within reach (`FAIR_WARNING`). Without this, some boats were doomed on arrival.
- **Fog keeps clear of out-of-reach rocks.** Inside fog the beam reaches only 60%. Fog that settled over a rock beyond that reach (for example on the Skerries reef) would make wrecks unavoidable. Fog banks are placed, and bounce, so that they stay 1.2 tiles clear of such rocks (`FOG_ROCK_ROOM`). This is tested.
- **Routes keep sea room.** Squares near rocks cost a little more in the distance field (`ROUTE_ROOM`, `ROUTE_ROOM_COST`). Lit boats therefore pass rocks with a margin rather than hugging the unsafe band.
- **Rocks** are circles with a radius. "Within 0.35 / 0.6 / 0.8 tiles of a rock" is measured from the rock's edge.
- **Economy.** With the spec's figures, `tools/economy.ts` showed about three purchases a day against the target of about one. Idle earnings snowballed because each building paid for itself within a day. The tuned values are:
  - Building costs rise ×2.3 per level and earnings ×1.5, instead of "about 1.8" for both.
  - The fish market's later levels are priced from 150.
  - Night catches grow 2% per night.
  - With this, the simulated player buys about two buildings or levels a day while playing nights almost perfectly; an ordinary player gets closer to the target. All of these values are in `tuning.ts`.
- **Requests** come in six kinds: land N boats of one kind, land N boats, three-star nights, a night with no close calls, close calls, and nights kept. They are the same for every player.
- **Artwork** is drawn in code (Pixi graphics and soft gradient textures). There are no bitmap assets apart from the generated icons. Sound is synthesised with Web Audio.
- **Frame rate.** The 60 fps target on the minimum phones could not be measured here, because there is no device or GPU. The simulation is cheap: the keeper plays a whole 20-boat night in about 0.3 seconds.
- **Open questions (§16)** are left as specified: a lost boat counts as a wreck, and a failed night keeps the catch already landed.
