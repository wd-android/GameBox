# Stratum – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/06-stratum.md)*

This document specifies the first playable release (v1). Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Stratum" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Where the sand falls from | The concept's open question is now a **player setting**: the stream follows the thumb, or falls from a fixed central spout while the player slides the jar (section 7). |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, with PixiJS for 2D drawing. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **Sand is simulated grain by grain on a grid,** using simple falling rules, not a general physics engine. | This well-known method gives convincing piling and sliding, runs quickly on phones, and behaves identically on every device. |
| A2 | **Every target picture is made by the designer actually pouring it** in the game's own editor. The pour is recorded and kept with the level. | Guarantees that every target can be achieved, with the same rules the player has. |
| A3 | **With a fixed spout, the player slides the jar beneath it.** | A spout that could not move at all would make off-centre mounds impossible, so the same jars could not be offered under both options. Sliding the jar gives the same range of results. |
| A4 | **Three techniques in v1** (flat layers, mounds, slopes) and three jar shapes. Pokes, blends, special sands, teams and Memory mode come later. | As the concept's first-version scope. |
| A5 | **No server, adverts or purchases in v1.** | As for the other games. The team jar needs a server and is therefore not in v1. |

## 3. Scope of v1

**Included:** the sand simulation with tilt; three jar shapes; 80 jars in four stages; Match, Daily Jar and Free Pour modes; guide lines; undo; the shelf with themed sets; jar editor; local save, sound, haptics and settings.

**Not included:** poke and blend techniques; heart, star and hourglass jars; glitter and other special sands; Memory mode; teams and the shared jar; sharing pictures.

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `stratum` |
| App identifier | `<your reverse domain>.stratum` (to be supplied) |
| Display name | `Stratum`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
stratum/app/src/
  config/   sand/ (grid, falling rules, pouring, tilt, scoring – no drawing code)   jars/
  game/ (modes, stars, undo, shelf)   render/   input/   audio/   state/   ui/
stratum/app/tools/jar-editor/     stratum/app/tests/
```

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Cell** | One square of the sand grid, holding one grain or nothing. |
| **Grid** | 96 cells wide and 128 tall. |
| **Jar mask** | Which cells are inside the jar. Cells outside are solid glass. |
| **Fill line** | The height at which the jar counts as full. |
| **Tick** | One simulation step, 1/60 of a second. |

On a typical phone each cell is about 3 screen pixels, small enough to read as a grain of sand.

## 6. Sand simulation

### 6.1 Grid

Each cell inside the jar holds either nothing or a colour number from 1 to 8. A straight jar has about 11,000 cells.

### 6.2 Falling rules

Each tick, cells are examined from the bottom row upwards. A grain moves to the first free cell in its list of preferred moves:

**Jar level (no tilt):**

```
1. straight down
2. diagonally down, to one side
3. diagonally down, to the other side
```

The side tried first alternates by row and by tick, so piles form evenly. These rules make sand settle at a 45-degree slope: poured in one place it forms a cone; poured evenly it forms a flat layer.

**Jar tilted:** "down" leans towards the low side of the jar.

| Tilt | Preferred moves, in order |
|---|---|
| Level (under 8°) | Down; diagonal either side |
| Slight (8–20°) | Down; diagonal to the low side; diagonal to the high side only if the pile there is at least two grains steeper |
| Steep (20–30°) | Diagonal to the low side; down; straight sideways to the low side |

Tilt is limited to 30 degrees each way. Sand that has slid into a slope stays there when the jar is levelled again, provided the slope is 45 degrees or gentler, which a 30-degree tilt always gives. This is how sloping and zigzag layers are made.

Each grain makes at most one move per tick while falling freely, and two when the cell below is free, so a grain crosses the jar in about one second.

### 6.3 Only what moves is worked on

Rows that have not changed for 30 ticks are marked settled and skipped until something lands on them or the tilt changes. In practice only a thin band near the surface is active, so the simulation costs very little.

### 6.4 Pouring

While the player pours:

```
each tick, add POUR_RATE grains of the chosen colour
    at the top of the jar, in the spout's column, scattered up to 1 cell either side
    (a grain is not added if its cell is occupied)
```

| Constant | Value | Notes |
|---|---|---|
| POUR_RATE | 5 grains per tick | Fills a straight jar in about 35 seconds of continuous pouring. |
| Scatter | ±1 cell | Chosen by a seeded random generator. |

Pouring stops by itself when sand reaches the fill line at the spout's column.

### 6.5 Limited colours

Some jars supply a measured number of grains of each colour, shown as a level in each palette pot. When a colour runs out, it cannot be poured.

### 6.6 Repeatability

The rules use only whole numbers and one seeded random generator. The same jar and the same sequence of inputs always produce exactly the same picture, on every device. This is what allows a designer's recorded pour to be replayed as the target, and as a hint.

### 6.7 Scoring

When the jar is full, or the player taps Done, the result is compared with the target cell by cell.

```
a cell is correct if the target has the same colour in that cell,
    or in any cell within 2 cells of it                      (so a boundary a little out still scores)
accuracy = correct cells / cells inside the jar up to the fill line
```

Empty cells below the fill line count as wrong.

| Stars | Accuracy |
|---|---|
| 3 | 95% or more |
| 2 | 85% or more |
| 1 | 70% or more |
| None | Below 70%. The jar is still kept, and can be poured again. |

The designer's own recording must score at least 97% against its own target when replayed, which checks that the tolerance and the target agree.

### 6.8 Undo

- A snapshot of the grid is taken each time pouring starts.
- Undo restores the most recent snapshot, removing the last pour and returning any limited sand used.
- Three undos per jar in Match and Daily Jar; unlimited in Free Pour.

### 6.9 Guide lines

Faint lines on the glass trace the boundaries between colours in the target. They are on by default for jars 1 to 15, and optional afterwards. Completing a jar with guide lines off adds a small "freehand" mark beside its stars and 5 extra corks.

## 7. Where the sand falls from (player setting)

Setting name: **"Pouring"**. Default: **Follow my thumb**.

| Option | Behaviour |
|---|---|
| **Follow my thumb** (default) | Holding anywhere on the jar pours. The stream falls in the column above the thumb and moves as the thumb moves sideways. |
| **Fixed spout** | The spout stays in the centre of the screen. Holding anywhere on the jar pours, and moving the thumb sideways **slides the jar** beneath the spout, by the same distance. |

Rules:

- Both options can produce exactly the same pictures: in one the stream moves over the jar, in the other the jar moves under the stream. Every jar is therefore achievable with either.
- Pour rate, sand behaviour, scoring and stars are identical.
- **Tilt is the same in both:** dragging the jar's rim (the top band of the jar) left or right tilts it, up to 30 degrees. Releasing the rim leaves the jar at that tilt; a double tap on the rim levels it.
- In "Fixed spout", the jar can slide until its inner wall reaches the spout, so the stream can reach every column.
- The setting can be changed from Settings or the pause menu and takes effect at once.

## 8. Jars

### 8.1 Shapes

| Shape | Character | From |
|---|---|---|
| **Straight jar** | Simple; layers are easy to judge | Jar 1 |
| **Round bottle** | Narrow neck and wide body; layers thin out as the jar widens | Jar 26 |
| **Tall vase** | Narrow and tall, flaring at the top; slopes are exaggerated | Jar 51 |

Each shape is a jar mask and a glass outline.

### 8.2 Jar file

```json
{
  "id": 42, "stage": 2, "shape": "round-bottle",
  "palette": [3, 5, 7],
  "limits": { "3": 2600, "5": 3100, "7": 2900 },
  "target": "the finished grid, run-length compressed",
  "recording": "the designer's inputs per tick",
  "set": "Sunsets"
}
```

### 8.3 Progression

| Stage | Jars | Layers | Technique | Shapes | Limits |
|---|---|---|---|---|---|
| 1 | 1–15 | 3–4 | Flat layers | Straight | None |
| 2 | 16–40 | 4–6 | Mounds (16); slopes (25) | Straight; bottle (26) | From jar 30 |
| 3 | 41–65 | 6–9 | Zigzags from alternating tilt | All; vase (51) | Most jars |
| 4 | 66–80 | 9–12 | Simple pictures: hills, waves, a sunset | All | All jars |

### 8.4 Modes

| Mode | Rules |
|---|---|
| **Match** | The 80 jars, in order. |
| **Daily Jar** | A separate set of 30 jars, played in rotation by date, the same for every player. One scored attempt per day; a streak counts consecutive days. |
| **Free Pour** | Any unlocked shape and all eight colours, no target, unlimited undo. Results can be kept on the shelf. Unlocks after jar 5. |

### 8.5 Corks

Earned: 5 per jar completed, plus 5 per star, plus 5 for freehand; 20 for the Daily Jar. Replays pay only for improvement. Spent on shelf backdrops, lighting and labels (30 to 300).

## 9. The shelf

| Feature | Rule |
|---|---|
| **Kept jars** | Every finished jar is stored exactly as poured and shown on the shelf. Re-pouring replaces it only if the player chooses. |
| **Sets** | Jars belong to themed sets of eight to ten (Stripes, Deserts, Sunsets, Seas, Hills and others). Completing every jar of a set at two stars or better awards 100 corks and a shelf decoration. |
| **Free Pour jars** | Up to 20 can be kept, on their own shelf. |
| **Storage** | Each jar is saved compressed; 100 jars take well under a megabyte. |

## 10. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on an empty jar with a three-stripe target, the first colour already chosen, and a hand icon showing a hold. Guide lines on. No menu. The shelf appears after the first jar is corked. |
| **Home (the shelf)** | The shelf of jars, Next jar, Daily Jar, Free Pour, Sets, Settings. Shows corks and streak. |
| **Pouring** | Jar in the centre. Target picture small at the top; tap it to lay it faintly over the glass for 2 seconds. Palette pots along the bottom, each at least 56 points. Undo and Done at the bottom corners. Pause top right. |
| **Result** | The jar is corked and turns once. Accuracy counts up; stars; corks. Buttons: Next, Pour again, Shelf. |
| **Sets** | Progress through each set. |

## 11. Drawing and feedback

- **Sand** is drawn from the grid every frame. Each grain is given a slight random lightness, fixed for its cell, so the sand has texture instead of flat colour.
- **Glass** has soft highlights drawn over the sand, on a plain neutral background.
- **Colours** are eight strongly saturated hues. Each also has a pattern (dots, stripes, and so on) that can be switched on for players who cannot tell them apart; the pattern appears on the palette pot, in the target and in the sand.
- **Performance:** 60 frames per second on the minimum phones while pouring continuously.

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Pouring | Stream of grains; surface builds | Fine hiss, falling in pitch as the jar fills; each colour has a slightly different tone | Continuous gentle buzz, stopping the instant the thumb lifts |
| Tilting | Jar leans; sand slides | Soft shifting rustle | Light tick as sand begins to slide |
| Colour chosen | Pot lifts | Small tap | Light tick |
| Colour runs out | Pot shown empty | Hollow tap | Double pulse |
| Undo | Last pour lifts away | Reverse whoosh | Light tick |
| Jar full | Cork drops in; jar turns | Cork "pop" | Firm pulse |
| Stars | Fill one by one | Rising notes | One pulse per star |

With "Reduce motion" on, the jar does not turn on the result screen. The game is fully playable in silence.

## 12. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Pouring | Follow my thumb / Fixed spout | Follow my thumb |
| Guide lines | On / Off (always on for jars 1–15) | On |
| Colour patterns | On / Off | Off |
| Music, sound effects, vibration | On / Off each | On |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every jar: settings; corks; per-jar best accuracy, stars, freehand mark and the kept grid; Free Pour jars; sets completed; shelf decorations; Daily Jar history and streak. The jar in progress is saved when the app is closed, so pouring resumes where it stopped. A `version` number allows later builds to convert older saves. Nothing leaves the device.

## 13. Tools and testing

**Jar editor** (browser page, developer only): choose a shape and palette; pour with the real simulation while inputs are recorded; save the finished grid as the target with its recording; replay to confirm the score; set colour limits from the amounts actually used, plus a margin of 15%.

**Automated tests**

- A grain never enters a glass cell or an occupied cell, and the number of grains never changes except by pouring and undo.
- Sand poured in one place on a level jar settles at 45 degrees.
- Sand poured evenly across a level jar settles flat to within one cell.
- A jar tilted 25 degrees and filled settles to a slope, and keeps it when levelled.
- The same jar and inputs always give an identical grid.
- A picture poured with "Follow my thumb" can be reproduced exactly with "Fixed spout" by the mirrored inputs.
- Undo restores the exact earlier grid and sand amounts.
- Every jar's recording replays to at least 97% against its own target; the build fails otherwise.
- A deliberately poor pour (one colour only) scores below one star on every jar.

**Acceptance criteria**

1. A new player is pouring within 5 seconds of launch.
2. The stream starts and stops with the thumb, with no perceptible delay.
3. The pouring setting takes effect immediately.
4. A careful pour that looks right to the eye scores at least two stars.
5. Fully playable with sound and vibration off, and in aeroplane mode.

## 14. Build order

| Stage | Deliverable |
|---|---|
| 1 | Sand grid, falling rules and pouring in a browser — **proves that the sand looks and feels satisfying** |
| 2 | Tilt; both pouring options; settled-row skipping; performance check on real phones |
| 3 | Scoring, tolerance, undo, guide lines |
| 4 | Jar editor with recording; three shapes |
| 5 | 80 jars and 30 Daily Jars |
| 6 | Shelf, sets, modes, corks, save |
| 7 | Artwork, grain shading, sound, haptics |
| 8 | Android and iOS packaging |

## 15. Risks

| Risk | Mitigation |
|---|---|
| **The sand does not look or feel good enough.** The whole game rests on it. | Stage 1 is nothing but sand. Grid size, pour rate and the falling rules are tuning constants. |
| **Scoring feels unfair.** | The 2-cell tolerance, the acceptance test that a good-looking pour earns two stars, and thresholds tuned on real play. |
| **Continuous vibration is limited on some phones,** particularly iPhones, which favour short taps. | Emulate with rapid light taps where a continuous buzz is not available, and test on real devices in stage 2. If it feels poor, vibration during pouring is dropped on those phones and kept for events. |
| **Tilt rules are the least proven part.** | Built and tested on their own in stage 2 before any jars depend on them. |
| **110 jars to design.** | Each is made simply by pouring it in the editor, which takes about a minute. |

## 16. Open questions

1. Are assumptions A1 to A5 acceptable, in particular sliding the jar under a fixed spout (A3)?
2. What is the app identifier (reverse domain)?
3. Should a jar scoring below 70% count as completed for unlocking the next jar? As specified, it is kept on the shelf but does not unlock the next.
