# Cubyrinth – Concept Design

*15 November 2026 · Concept 8 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | A maze wrapped around a cube. Roll the ball from one corner to the opposite corner, turning the cube as you go. |
| **Genre** | 3D dexterity and route-finding puzzle |
| **Audience** | Broad; skews towards players who enjoy skill and timing |
| **Orientation** | Portrait, one thumb |
| **Session** | 30 seconds (3 × 3) to four minutes (9 × 9); progress saved at every gate |
| **Works offline** | Yes, apart from the daily cube leaderboard |

## 2. Core gameplay

1. The ball starts in one corner of the top face.
2. The player tilts the cube to roll the ball along the maze.
3. Each face has one or more **gates** on its edges. When the ball rolls into a gate, control pauses, the cube turns a quarter about that edge, and the adjoining face becomes the top.
4. The ball continues on the new face.
5. The goal is the corner diagonally opposite the start, which means crossing at least three faces.

## 3. Controls

| Scheme | How it works | Notes |
|---|---|---|
| **Thumb tilt (default)** | Drag anywhere on the screen; the cube tilts in that direction, up to about 15 degrees. Release to level it. | Works one-handed, lying down or in transit. |
| **Device tilt (option)** | Tilt the phone itself. | More physical and satisfying, but awkward in many places. |
| **Step mode (option)** | Swipe in a direction; the ball rolls until it meets a wall. | Removes the dexterity demand. Turns the game into a pure route puzzle, and makes it accessible to players with limited fine motor control. |

Sensitivity is adjustable. The thumb-tilt scheme has no fixed joystick position, so it suits left- and right-handed players equally.

## 4. Structure of a cube

- Six faces, each an *n* × *n* grid of cells with walls between some of them.
- The whole surface is treated as **one maze** of 6 × *n* × *n* cells. Wherever the maze's route crosses from one face to another, that crossing becomes a gate.
- Because the surface is generated as a single maze in which every cell is reachable, a route from start to finish is guaranteed, and faces that are not on the direct route become natural dead-end detours.

### Grid sizes

| Grid per face | Cells on the cube | Possible layouts for a single face | Character |
|---|---|---|---|
| 3 × 3 | 54 | 192 | Introductory |
| 4 × 4 | 96 | About 100,000 | First real route-finding |
| 5 × 5 | 150 | About 557 million | Standard play |
| 6 × 6 | 216 | Effectively unlimited | Detours over extra faces |
| 7 × 7 | 294 | Effectively unlimited | Advanced |
| 8 × 8 | 384 | Effectively unlimited | Expert |
| 9 × 9 | 486 | Effectively unlimited | Master |

Layout counts are for "perfect" mazes on one face (every cell reachable, no loops). Treating the cube as one maze multiplies the variety far beyond these figures, so layouts need never repeat.

### Screen size

The camera sits above the cube, angled slightly, and zooms so that the top face fills the screen width with the edges of neighbouring faces just visible. On a typical phone this gives cells of about 40 points at 9 × 9, with a ball of about 20 points. That is workable, but tight on small phones. The proposal is to cap small phones at 7 × 7 and offer 8 × 8 and 9 × 9 on larger phones and tablets.

## 5. Balls

| Ball | Speed | Feel | Score multiplier |
|---|---|---|---|
| **Bronze** | 1.0× | Slow, heavy, forgiving | ×1 |
| **Silver** | 1.4× | Balanced | ×1.5 |
| **Gold** | 1.8× | Fast, hard to stop | ×2 |

- The player chooses a ball before each cube. Bronze is available from the start; silver and gold unlock within the first few levels.
- Completing a cube with a given ball earns the matching medal, so every cube can be completed three times.
- Later, cosmetic balls (glass, wooden, patterned) can be collected. These change appearance only, never speed.

## 6. Progression

| Stage | Grid | New element |
|---|---|---|
| 1 | 3 × 3 | Rolling and gates |
| 2 | 4 × 4 | Dead ends; silver ball |
| 3 | 5 × 5 | **Holes** – the ball drops back to the last gate; gold ball |
| 4 | 6 × 6 | **One-way gates** |
| 5 | 7 × 7 | **Keys** – collect on one face to open a gate on another |
| 6 | 8 × 8 | **Moving walls** on a slow, visible rhythm |
| 7 | 9 × 9 | **Blind faces** – the maze appears only when the ball arrives |

Each stage has 20 to 30 cubes. New elements are introduced one at a time on a small, simple cube before being combined.

## 7. Modes

| Mode | Rules |
|---|---|
| **Journey** | The staged progression above. |
| **Daily Cube** | One cube a day, the same for everyone. |
| **Endless** | Generated cubes at a chosen size, one after another. |
| **Time Trial** | Beat a target time on cubes already completed. |
| **Explore** | No timer and no holes; a relaxed mode. |

## 8. Scoring and rewards

- **Time** is the main measure, with target times for one, two and three stars.
- **Score** = base for the grid size × ball multiplier, plus a time bonus.
- **Falls** (into holes) are counted; a run with none earns a "clean" mark.
- **Coins** are earned per cube and spent on cosmetic cubes and balls.

## 9. Long-term layer

- Bronze, silver and gold medals on every cube, shown on a progress map.
- **Cube materials:** wood, marble, glass, brass, neon, ice. Cosmetic only.
- **Ball collection.**
- **Personal bests** for every cube and ball.

## 10. Daily and live features

- **Daily Cube** with a streak and a small-group time leaderboard.
- **Weekly event:** a themed set of cubes with a special material as the reward.
- **Daily reward** of coins.

## 11. Social

- Small-group leaderboards for the Daily Cube and Time Trial.
- **Ghost ball:** race a faint replay of a friend's run or of the player's own best. A later feature.
- Share a cube by its code, so a friend can play the identical layout.

## 12. Monetisation

- Opt-in rewarded adverts for a hint (a brief overhead view of the route) or doubled coins.
- A single purchase to remove interstitial adverts.
- Optional cosmetic packs.
- Nothing that affects speed or control is ever sold.

## 13. Visual direction

- **Cube:** chunky and toy-like, floating against a soft gradient. Pale floors, darker raised walls, a brightly coloured ball.
- **Lighting:** a single soft light from above, so walls cast short shadows that make the maze easy to read.
- **The turn:** the signature moment. It should be smooth and weighty, last about half a second, and bring the new face into view with the ball already in place.
- **Trail:** a faint line behind the ball shows where it has been on the current face.
- **Mini-map:** a small unfolded view of the cube in a corner, showing which faces have been visited. Optional, and off in expert stages.
- **Gates** glow gently so they can be found at a glance; the finish corner pulses.
- **Performance:** a steady 60 frames per second matters more than detail. Smooth motion is essential to the feel.

## 14. Audio and haptics

- A rolling sound whose pitch and volume follow the ball's speed; each ball has its own tone (bronze dull, silver bright, gold ringing).
- Soft knocks against walls, with a matching vibration scaled to the force of the impact.
- A heavy "clunk" and a low sweep as the cube turns.
- A falling whistle for a hole; a rising chime at the finish.
- Calm, spacious background music that does not hurry the player.
- Haptics matter more here than in any other concept, because they make the ball feel physical. Every sound has a visual equivalent, so the game is playable in silence.

## 15. The first 60 seconds

1. The game opens on a 3 × 3 cube with the bronze ball in a corner and a hand icon showing a drag.
2. The player rolls to a glowing gate; the cube turns.
3. Two faces later the ball reaches the pulsing corner. The whole cube takes about 20 seconds.
4. The second cube has one dead end. The third introduces the choice of ball.

## 16. Build scope

**First version:** thumb tilt and step mode, 3 × 3 to 6 × 6, three balls, holes, Journey mode, the Daily Cube, two cube materials.

**Later:** device tilt, 7 × 7 to 9 × 9, keys, one-way gates, moving walls, blind faces, Endless, Time Trial, ghost balls.

## 17. Risks and open questions

- **Control feel** is the make-or-break factor and can only be judged in a playable prototype. A single-face prototype should come before anything else.
- **Technical demand.** This is the most demanding of the nine concepts: 3D rendering, physics and smooth performance on modest phones.
- **Dexterity.** It asks more of the player's hands than the other concepts. Step mode, Explore mode and the bronze ball are the safeguards.
- **Disorientation.** Players may lose track of where they are on the cube. The mini-map, the trail and consistent turning are the remedies.
- **Existing products.** Physical maze-cube toys and flat marble-labyrinth apps exist. The wrap-around maze, the turning cube and the three balls are the distinguishing features.
- **Decided:** the cube turns automatically when the ball enters a gate. See the [build specification](../cubyrinth/build-specification.md).
- **Decided:** "Cubyrinth" is a working title, also used as the package name. It has not been checked for existing use.
