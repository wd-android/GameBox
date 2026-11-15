# Sunward – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/02-sunward.md)*

This document specifies the first playable release (v1). Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Sunward" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Growth when the thumb is lifted | The concept's open question is now a **player setting**: growth either pauses or continues (section 7). |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, with PixiJS for 2D drawing. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **Rewind is a button,** held to wind the stem back. The concept proposed dragging back along the stem, which would clash with dragging the sun. | One drag gesture, one meaning. |
| A2 | **Three plants in v1** (sunflower, vine, fern) and three garden features (walls, water drops, frost). Clouds, mirrors and the other three plants come later. | As the concept's first-version scope. |
| A3 | **Levels are hand-built** in an editor that is part of the project. Each is released only with a recorded three-star playthrough by the designer, which the game can replay exactly. | Proves every level is achievable, and supplies the hint route. |
| A4 | **No server, adverts or purchases in v1.** Hints cost seeds earned in play. | As for the other games. |

## 3. Scope of v1

**Included:** three plants; walls, trellises, water drops and frost; 100 levels in four stages; rewind; the greenhouse with watering; Plant of the Day with streak; hints; level editor; local save, sound, haptics and settings.

**Not included:** sweet pea, bamboo and moonflower; clouds and mirrors; two seeds at once; seasons; friends' greenhouses; picture sharing.

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `sunward` |
| App identifier | `<your reverse domain>.sunward` (to be supplied) |
| Display name | `Sunward`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
sunward/app/src/
  config/   sim/ (growth, collisions, blooms – no drawing code)   levels/   game/
  greenhouse/   render/   input/   audio/   state/   ui/
sunward/app/tools/editor/     sunward/app/tests/
```

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Tile** | Unit of length. The playfield is 12 tiles wide and 18 tall. |
| **Half-tile** | Obstacles are laid out on a grid of half-tiles (24 × 36). |
| **Tip** | The growing end of the stem. |
| **Length** | How much stem the plant has left to grow, in tiles. |
| **Tick** | One simulation step, 1/60 of a second. |

## 6. Growth simulation

### 6.1 The sun

- The sun travels on a fixed arc across the top of the playfield, from the left edge to the right edge, highest in the middle.
- Its position is one number, **s**, from 0 (left) to 1 (right).
- The player drags horizontally anywhere on the screen; s follows the thumb's horizontal position across the screen width. The sun is drawn at the top, so the thumb never covers it.
- The sun moves towards the thumb's position at up to 1.5 arc-lengths per second, so it glides instead of jumping.

### 6.2 The stem

The plant is a line of points. Its state is the tip position **p**, the heading **h** (a direction of length 1), and the remaining length **L**.

Each tick, while growing:

```
want = direction from p to the sun                       (fern: the opposite direction)
h    = normalise(h + want x TURN x dt)                   the heading swings towards the light
step = h x SPEED x dt
step = resolve against obstacles (6.3)
if step is not zero:
    p = p + step;   L = L - length of step;   add p to the stem
check water drops, frost and bloom points (6.4)
if L <= 0:  growth ends
```

Because the heading swings gradually, the stem always curves smoothly; the plant cannot turn on the spot. This turning limit is what makes each level a puzzle.

| Plant | SPEED | TURN | Starting heading | Behaviour |
|---|---|---|---|---|
| **Sunflower** | 1.6 tiles/s | 2.2 | Straight up | Grows towards the sun. |
| **Vine** | 2.4 tiles/s | 3.0 | Straight up | Grows towards the sun and clings to surfaces (6.3). |
| **Fern** | 1.4 tiles/s | 2.0 | Straight up | Grows directly away from the sun. |

Only addition, multiplication, division and square root are used, so a recorded playthrough replays identically on every device.

### 6.3 Obstacles

Obstacles are solid half-tiles. The playfield's edges are solid.

- **Blocked step:** if the step would carry the tip into a solid half-tile, the part of the step pointing into the surface is removed, and the tip slides along the surface.
- **Stalled:** if nothing is left of the step (the plant is growing straight into a wall), the tip stays where it is and **no length is used**. A small swirl shows that the plant is waiting for light from another direction.
- **Vine clinging:** while a vine's tip is touching a surface, it follows that surface in whichever direction is closer to the sun, turning corners with it. It lets go when the direction to the sun points away from the surface by more than 30 degrees.
- **Trellis:** drawn as a lattice. It is solid to the sunflower and fern, and is a surface for the vine to cling to.
- The stem may cross itself. Crossings are drawn but have no effect.

### 6.4 Things the tip touches

| Item | Size | Effect |
|---|---|---|
| **Bloom point** | Radius 0.45 | A flower opens there. Growth continues. Each bloom point counts once. |
| **Water drop** | Radius 0.35 | Adds 3 tiles to the remaining length. Used up. |
| **Frost patch** | One or more half-tiles | The tip freezes and growth ends at once. |

### 6.5 Rewind

- Holding the rewind button winds the stem back at three times growth speed. Releasing it stops.
- Rewinding restores length, closes any blooms passed, and restores any water drops passed.
- It is free and unlimited, and can be used after growth has ended.
- The stem is stored as a list of points with the game state at each, so rewinding is exact.

### 6.6 End of a level

Growth ends when length runs out or the tip freezes. The result panel then appears, with Rewind still available. There is no fail state.

| Stars | Condition |
|---|---|
| 3 | Every bloom point reached |
| 2 | All but one reached |
| 1 | At least one reached |

A **perfect** mark is added when every bloom is reached with at least 10% of the plant's total length unused.

## 7. Growth when the thumb is lifted (player setting)

Setting name: **"When I lift my thumb"**. Default: **Growth pauses**.

| Option | Behaviour |
|---|---|
| **Growth pauses** (default) | The plant grows only while the screen is touched. Lifting the thumb stops everything, giving time to look and think. |
| **Growth continues** | Growth starts with the first touch and then never stops until the level ends. The sun stays where it was last left. A pause button is shown. |

Rules:

- The setting does not change growth speed, turning or any level's design.
- Stars and the perfect mark are unaffected.
- It can be changed from Settings or the pause menu, and takes effect at once.
- Levels are designed and recorded with "Growth pauses", which is the more forgiving option. Since "Growth continues" only removes thinking time, every level remains achievable.

## 8. Levels

### 8.1 Level file

```json
{
  "id": 24, "stage": 2, "plant": "sunflower",
  "seed": { "x": 6.0, "y": 1.0 }, "length": 22,
  "solid": ["rows of 24 characters, one per half-tile …"],
  "trellis": [[10, 14], [10, 15]],
  "blooms": [ { "x": 3.5, "y": 9.0 }, { "x": 9.0, "y": 14.5 } ],
  "drops":  [ { "x": 7.0, "y": 6.0 } ],
  "frost":  [[18, 20]],
  "recording": "designer's three-star run, as sun positions per tick"
}
```

### 8.2 Progression

| Stage | Levels | Bloom points | Introduces |
|---|---|---|---|
| 1 | 1–20 | 1–2 | Sunflower; walls (level 4); limited length matters (level 10) |
| 2 | 21–50 | 2–3 | Vine (21); trellis (26); water drops (35) |
| 3 | 51–80 | 3–4 | Fern (51); frost (60) |
| 4 | 81–100 | 4–5 | Tight routes mixing every feature |

Each new plant or feature first appears on a level with one bloom point and a generous length.

### 8.3 Plant of the Day

- A separate set of 30 levels, played in rotation by date, the same for every player.
- Each awards a named species for the greenhouse (a cosmetic variety of one of the three plants).
- One completion per day; a streak counts consecutive days.

### 8.4 Seeds and hints

- **Seeds earned:** 5 per level completed, plus 5 per star; 20 for Plant of the Day. Replays pay only for stars newly earned.
- **Hint (15 seeds):** a faint ghost of the designer's recorded stem is shown for 3 seconds. Once per attempt.

## 9. The greenhouse

| Feature | Rule |
|---|---|
| **Collection** | Each plant grown for the first time is potted in the greenhouse, shown in the shape the player grew it. |
| **Habitats** | Plants are grouped into Meadow, Woodland and Tropical. Completing a habitat opens a new wing with its own backdrop. |
| **Plant cards** | Name and one short fact for each species. |
| **Watering** | Each plant can be watered once a day for 2 seeds. Watering on consecutive days builds the watering streak; at 7, 14 and 30 days a rare species is awarded. |
| **Furnishing** | Pots, benches and ornaments bought with seeds (20 to 250) and placed in fixed slots. |

## 10. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on level 1: a seed, the sun, and one bloom point up and to the right, with a hand icon showing a sideways drag. No menu. The greenhouse appears after level 3. |
| **Home** | Play, Plant of the Day, Level map, Greenhouse, Settings. Shows seeds and streak. |
| **Level** | Garden fills the screen. Top: sun arc. Top corners: level number, pause. A thin bar shows length remaining. Bottom corners: Rewind and Hint, each at least 56 points. |
| **Result** | Stars, perfect mark, seeds, any new plant. Buttons: Next, Rewind and retry, Greenhouse. |
| **Greenhouse** | Swipe along the wings; tap a plant for its card; watering can; shop drawer. |

## 11. Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Sun moves | The whole scene's light and colour shift from dawn through midday to dusk | Soft ambient change (birdsong by day, crickets near the horizon) | None |
| Growing | Stem extends; leaves unfurl along it | Plucked notes, rising in pitch with height | Faint repeating tick |
| Stalled at a wall | Small swirl at the tip | Notes stop | None |
| Bloom | Flower opens with a burst of petals | Warm chime and a breath of wind | Light pulse |
| Water drop | Drop absorbed; length bar refills | Droplet | Light tick |
| Frost | Tip whitens and stops | Soft crackle | Double pulse |
| Level ends | Shimmer along the stem | Short phrase made from the notes just played | One pulse per star |

No sound or effect signals failure, because there is none. With "Reduce motion" on, petals and shimmer become fades.

## 12. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| When I lift my thumb | Growth pauses / Growth continues | Growth pauses |
| Music, sound effects, vibration | On / Off each | On |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every level and greenhouse change: settings; seeds; per-level stars and perfect mark; the stem shape of each plant's best run (for the greenhouse); species collected; furnishings; Plant of the Day history; watering dates and streak. A `version` number allows later builds to convert older saves. Nothing leaves the device.

## 13. Tools and testing

**Level editor** (browser page, developer only): paint solid half-tiles, trellis and frost; place the seed, bloom points and drops; set plant and length; play the level with the real simulation; record a run and attach it to the level; save and load.

**Automated tests**

- The heading never turns faster than its limit.
- The tip never enters a solid half-tile.
- A stalled plant uses no length.
- A vine follows a surface round a corner and lets go when the sun is behind it.
- A fern grows away from the sun.
- Rewinding to any earlier point restores exactly the state at that point.
- Every level's recording replays to three stars; the build fails otherwise.
- Changing the thumb-lift setting changes only when growth runs.

**Acceptance criteria**

1. A new player is dragging the sun within 5 seconds of launch.
2. The stem visibly bends towards the sun with no perceptible delay.
3. The thumb-lift setting takes effect immediately.
4. Fully playable with sound and vibration off, and in aeroplane mode.
5. 60 frames per second on the minimum phones.

## 14. Build order

| Stage | Deliverable |
|---|---|
| 1 | Growth simulation with sunflower and walls; tests |
| 2 | Browser prototype with plain lines and three test levels — **proves that steering a stem by the sun feels good** |
| 3 | Level editor with recording |
| 4 | Vine, fern, trellis, drops, frost, rewind, thumb-lift setting |
| 5 | Levels 1–100 and 30 Plant of the Day levels |
| 6 | Stars, seeds, hints, level map, greenhouse, save |
| 7 | Artwork, lighting, sound, haptics |
| 8 | Android and iOS packaging |

## 15. Risks

| Risk | Mitigation |
|---|---|
| **No fail state may feel aimless.** | Limited length and three-star targets supply tension; the perfect mark rewards mastery. |
| **Steering feels indirect.** | Stage 2 tests it with plain lines. SPEED and TURN are tuning constants per plant. |
| **130 hand-built levels.** | Editor with instant play and recording. v1 could launch with stages 1 to 3 (80 levels). |
| **Vine clinging is the most intricate rule.** | Built and tested on its own in stage 4, with its own test levels. |

## 16. Open questions

1. Are assumptions A1 to A4 acceptable, in particular the rewind button (A1)?
2. What is the app identifier (reverse domain)?
3. Should v1 launch with 100 levels, or 80 with the fourth stage as an update?
