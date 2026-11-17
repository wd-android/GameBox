# Murmur – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/04-murmur.md)*

This document specifies the first playable release (v1). Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Murmur" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| How the flock is steered | The concept's open question is now a **player setting**: the flock either follows the thumb continuously or follows a line drawn in advance (section 8). |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, with PixiJS for 2D drawing. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **The flock is a ribbon that follows its leader's path,** not a simulation of every bird reacting to its neighbours. Lifelike rippling is added in the drawing only. | Predictable for the player, cheap to run with hundreds of birds, and the ribbon is exactly the shape the game's risk depends on. |
| A2 | **The sky is assembled from hand-made sections** ("chunks") chosen at random by difficulty, not generated bird by bird. | Every section can be checked in advance to have a way through. |
| A3 | **Hawks strike a marked spot,** shown in advance, not the flock directly. | A dive the player can see coming and steer away from is fair; one that tracks the flock is not. |
| A4 | **Free Flight only in v1.** Daily Migration and Calm Skies follow. | As the concept's first-version scope. |
| A5 | **No server, adverts or purchases in v1.** The one revive per run costs feathers. | As for the other games. |

## 3. Scope of v1

**Included:** Free Flight; three species (starlings, swallows, geese); hawks, storm clouds, wires; stray birds, roost trees, thermals; murmurations; missions; two skies; one revive per run; local save, sound, haptics and settings.

**Not included:** Daily Migration, Calm Skies, wind gusts, rival flocks, sparrows and swifts, seasonal events, leaderboards, sharing images.

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `murmur` |
| App identifier | `com.promethica.murmur` |
| Display name | `Murmur`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
murmur/app/src/
  config/   sim/ (leader, flock, hazards, scoring – no drawing code)   world/ (chunks, spawner)
  game/ (runs, missions, unlocks)   render/   input/   audio/   state/   ui/
murmur/app/tools/chunk-editor/     murmur/app/tests/
```

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Tile** | Unit of length. The visible sky is 12 tiles wide and 20 tall. |
| **Leader** | The front bird. The rest of the flock follows where it has been. |
| **Trail** | The record of the leader's recent path. |
| **Chunk** | A hand-made section of sky, 12 tiles wide and 20 tall. |
| **Tick** | One simulation step, 1/60 of a second. |

## 6. Flight simulation

### 6.1 The sky

The world scrolls downwards past the flock, so the flock appears to fly up the screen. Scroll speed starts at 3 tiles per second and rises steadily to 6 after two minutes, then holds.

### 6.2 The leader

Each tick the leader moves towards a **target point** (section 8 says where that comes from):

```
toTarget = target - leader position
move     = toTarget, limited to LEADER_SPEED x dt
leader position = leader position + move, kept inside the visible sky
add the leader's position to the trail
```

In "Follow my thumb" mode the target sits **2.5 tiles above the thumb**, so the thumb never hides the flock or what is coming.

### 6.3 The flock

The flock has **N** birds. Bird number *i* sits on the trail at a distance of *i × SPACING* behind the leader, measured along the path, and is shifted sideways by a fixed personal offset.

```
sideways spread = min(0.2 + 0.01 x N, SPREAD_MAX)        the flock gets wider as it grows
bird i offset   = (its personal value between -1 and 1) x sideways spread
```

So a small flock is a thin thread and a large one a broad ribbon that needs a wider gap. N is limited to 300.

| Species | LEADER_SPEED | SPACING | SPREAD_MAX | Points per bird | Unlock |
|---|---|---|---|---|---|
| **Starlings** | 9 tiles/s | 0.12 | 1.2 | 1.0 | Start |
| **Swallows** | 12 tiles/s | 0.10 | 0.7 | 0.8 | 500 birds gathered in total |
| **Geese** | 6.5 tiles/s | 0.22 (V shape) | 2.0 | 1.6 | 2,000 birds gathered in total |

Geese are drawn in a V: the sideways offset grows with distance behind the leader.

### 6.4 Gathering

A stray bird joins the flock when any flock bird comes within 0.6 tiles of it. It is added to the back of the ribbon. Strays are placed by the chunks.

### 6.5 Hazards

| Hazard | Shape | Effect |
|---|---|---|
| **Storm cloud** | Circle, radius 1.5 to 2.5 | Any bird inside it is lost. |
| **Wires and pylons** | Thin horizontal bars with gaps; solid pylons | Any bird touching one is lost. |
| **Hawk** | A dive onto a marked spot | See below. |

**Losing birds.** A lost bird is removed and those behind close up. If the leader is lost to a cloud or a wire, the next bird becomes the leader. If no birds remain, the run ends.

**Hawks.**

1. A shadow appears on the sky, at the point the leader will reach in 1.2 seconds if it carries on as it is, and the hawk's cry sounds.
2. The shadow stays fixed to that point of sky and darkens for 1.2 seconds.
3. The hawk lands. Any bird within 0.8 tiles of the spot is taken.
4. **If the leader is among them, the run ends.**

Hawks arrive every 14 seconds at first, shortening to every 6. The first hawk of a new player's first three runs takes 2 seconds to land.

### 6.6 Roost trees and banking

Score is only kept when banked.

- A roost tree has a banking circle of radius 3 tiles.
- While the leader is inside the circle, the game tracks how far round the tree it has travelled.
- When the leader has gone the whole way round in one direction, the unbanked score moves to the banked score, and the tree lights up.
- Each tree can bank once. Trees come every 25 to 35 seconds.

### 6.7 Murmurations

- If the leader's path crosses itself within its last 8 tiles of travel, the flock gathers into a swirling ball for 1.5 seconds.
- During it, the gathering distance triples and the player scores a bonus of 5 × N.
- A murmuration cannot be triggered again for 4 seconds.
- Circling a roost tree does not count as a murmuration.

### 6.8 Thermals

A thermal is a soft column. While the leader is inside it, the scroll speed is raised by half for as long as it stays there, and points accumulate half as fast again.

### 6.9 Scoring

```
each tick:   unbanked = unbanked + N x (points per bird) x dt
near miss:   +2 when a hazard passes within 0.4 tiles of a bird without touching   (at most once per hazard)
murmuration: +5 x N
banking:     banked = banked + unbanked;  unbanked = 0
run score  = banked                         (anything unbanked when the run ends is lost)
feathers   = run score / 50, rounded down
```

### 6.10 End of a run and revive

When the run ends, the player may revive once for 50 feathers: the flock restarts with 10 birds just above the point of failure, all hazards on screen are cleared, and the unbanked score is kept. Otherwise the result screen appears, with a one-tap restart.

## 7. The sky's contents

### 7.1 Chunks

Each chunk is a small data file listing wires, pylons, clouds, strays, thermals and at most one roost tree. Clouds may be given a slow sideways drift.

| Tier | Used from | Clear lane at least | Character |
|---|---|---|---|
| 1 | Start | 6 tiles wide | Strays and single clouds |
| 2 | 20 seconds | 4.5 tiles | Wires with wide gaps |
| 3 | 45 seconds | 3.5 tiles | Wires and clouds together |
| 4 | 80 seconds | 2.5 tiles | Narrow gaps; drifting clouds |
| 5 | 120 seconds | 2 tiles | Sequences that force quick weaving |

v1 ships with 40 chunks, eight per tier. A tool checks that each has a continuous clear lane of the required width from bottom to top, and that the lane lines up acceptably with any chunk that may follow it.

### 7.2 Choosing chunks

From a random seed chosen at the start of each run, the spawner picks the next chunk at random from the current tier and the one below it, never repeating either of the last two. A roost-tree chunk is forced whenever 35 seconds have passed without one.

### 7.3 Missions

Three missions are active at a time. Completing one pays feathers and replaces it. v1 has about 40, built from templates:

| Template | Example |
|---|---|
| Bank a total | "Bank 200 points in one run" |
| Flock size | "Reach a flock of 80" |
| Survive | "Pass 10 hawks in one run" |
| Skill | "Make 3 murmurations in one run" |
| Collect | "Gather 500 birds in total" |
| Species | "Bank 100 points with geese" |

Every five missions completed raises the player's rank, which unlocks the second sky.

## 8. How the flock is steered (player setting)

Setting name: **"Steering"**. Default: **Follow my thumb**.

| Option | Behaviour |
|---|---|
| **Follow my thumb** (default) | The leader heads for a point 2.5 tiles above the thumb for as long as the screen is touched. With the thumb lifted, it holds its position on screen. |
| **Draw a path** | The player draws a line anywhere on the sky. The leader flies along it from the nearest end at its usual speed. Drawing a new line replaces whatever remains of the old one. When the line runs out, the leader holds its position on screen. |

Rules:

- The leader's top speed, the flock, hazards and scoring are identical in both.
- A drawn line is fixed to the sky and scrolls with it, so a route planned through a gap stays aligned with the gap.
- The drawn line is shown as a faint dotted trail ahead of the leader.
- The setting can be changed from Settings or the pause menu, and takes effect when the next run starts.
- Scores are not separated by steering option in v1. If leaderboards arrive later, they will be.

## 9. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly in flight with a small flock, strays straight ahead, and a hand icon tracing a curve. No menu. The first roost tree arrives after 12 seconds with a looping arrow around it; the first hawk after 20. |
| **Home** | Fly, Species, Skies, Missions, Settings. Shows best score, feathers and rank. |
| **Flight** | Sky fills the screen. Top: banked score (large), unbanked score (smaller, pulsing), flock size, pause. Nothing in the lower third. |
| **Run over** | Revive offer for 3 seconds, then: score, best, birds gathered, feathers, mission progress. Buttons: Fly again, Home. |
| **Species / Skies** | Cards with unlock conditions and personal bests. |

## 10. Drawing and feedback

- **Look:** birds are dark shapes against a vivid sky gradient from deep orange to violet. Hazards are distinct shapes with a warning-coloured edge. Strays glow faintly.
- **Life in the ribbon:** each bird is drawn with a small wobble and wing-beat of its own, and a ripple passes down the ribbon when the leader turns sharply. This affects appearance only.
- **Performance:** 300 birds at 60 frames per second on the minimum phones, drawn as one batch.

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Flying | Bright trace where the leader has been | Rush of wings, fuller as the flock grows | None |
| Bird gathered | Soft flash at the join | Rising note; consecutive joins climb a scale | Light tick |
| Birds lost | Scatter of feathers | Short flutter | Firm pulse |
| Hawk warning | Darkening shadow on the sky | Hawk's cry | Double pulse |
| Banked | Tree lights; unbanked score flies to banked | Warm chord | Long soft pulse |
| Murmuration | Flock swirls into a ball | Swell of wings and a chime | Rolling pulse |
| Run over | Flock scatters | Wings fade | Single pulse |

Music builds in layers as the flock grows. With "Reduce motion" on, the ripple and screen effects are removed. Every sound cue has a visual equivalent.

## 11. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Steering | Follow my thumb / Draw a path | Follow my thumb |
| Music, sound effects, vibration | On / Off each | On |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every run: settings; feathers; rank; best score overall and per species; total birds gathered; species and skies unlocked and selected; active missions and their progress; number of runs played. A `version` number allows later builds to convert older saves. A run in progress is not saved. Nothing leaves the device.

## 12. Tools and testing

**Chunk editor** (browser page, developer only): place and size hazards, strays, thermals and trees; show the clear lane; fly through the chunk with the real simulation; save and load.

**Automated tests**

- Bird *i* is always the right distance behind the leader along the trail.
- The flock's width follows the formula and never exceeds the species' limit.
- A bird touching a hazard is lost; one that passes outside is not.
- A hawk's spot does not move once shown, and the run ends only if the leader is inside when it lands.
- Banking requires a complete circuit, and each tree banks once.
- A path that crosses itself within 8 tiles triggers a murmuration; a wide curve does not.
- Unbanked score is lost when a run ends without a revive.
- Every chunk has a clear lane of its tier's width.
- An automatic pilot that simply follows the clear lane survives 500 random runs for at least three minutes each (hawks excluded).

**Acceptance criteria**

1. A new player is steering the flock within 3 seconds of launch.
2. The flock follows the thumb with no perceptible delay beyond the designed one.
3. The steering setting takes effect from the next run.
4. Restarting after a run takes one tap and under one second.
5. Fully playable with sound and vibration off, and in aeroplane mode.

## 13. Build order

| Stage | Deliverable |
|---|---|
| 1 | Leader, trail and ribbon in a browser with dots — **proves the feel of the flock** |
| 2 | Scrolling sky, strays, clouds, wires, losing birds |
| 3 | Hawks, roost trees and banking, murmurations, scoring |
| 4 | Chunk editor and lane checker; 40 chunks |
| 5 | Both steering options; species; revive |
| 6 | Missions, rank, skies, menus, save |
| 7 | Artwork, flock animation, sound, haptics |
| 8 | Android and iOS packaging |

## 14. Risks

| Risk | Mitigation |
|---|---|
| **The flock does not feel alive or responsive.** | Stage 1 tests it before anything else. Leader speed, spacing and spread are tuning constants per species. |
| **Endless games retain players less well than level games.** | Missions, species, skies and rank give goals; Daily Migration is the first planned addition. |
| **"Draw a path" may prove much easier or harder than following the thumb.** | Both are measured in playtesting with the automatic pilot's survival times as a baseline; leader speed can be tuned per option if needed. |
| **Large flocks cover too much of a small screen.** | The 300-bird cap and SPREAD_MAX keep the ribbon to about a sixth of the screen width. |

## 15. Open questions

1. Are assumptions A1 to A5 acceptable, in particular hawks striking a marked spot (A3)?
2. ~~What is the app identifier (reverse domain)?~~ Answered: `com.promethica.murmur`.
3. Should unbanked score be lost entirely when a run ends, as specified, or partly kept?
