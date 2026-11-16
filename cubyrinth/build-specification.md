# Cubyrinth – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/08-cubyrinth.md)*

This document specifies the first playable release (v1) in enough detail to build from. The two areas that decide whether the game works, the **maze generator** (section 6) and the **ball physics** (section 7), are specified most closely. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Cubyrinth" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Cube turning | The cube **turns automatically** when the ball enters a gate. The player does nothing. |
| Technology | Same as Oddness: TypeScript, Vite and Capacitor, for iOS and Android from one codebase. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **3D rendering with Three.js** (WebGL; confirmed 15 November 2026), inside the same TypeScript and Capacitor shell as Oddness. | Keeps one toolchain for both games. The scene is small: one cube and one ball. |
| A2 | **Custom physics, not a physics library** (confirmed 15 November 2026). | The ball only ever rolls on one flat face among straight walls, which is a 2D problem. A purpose-built simulation is smaller, easier to tune, cannot tunnel through walls, and gives identical results on every device (section 7.9). |
| A3 | **Mazes are generated on the device from a seed,** not stored. A level is a handful of numbers. | Unlimited cubes with no download size, and any cube can be shared as a short code. |
| A4 | **No server, adverts or purchases in v1.** | As for Oddness. Leaderboards and ghost balls wait for v2. |
| A5 | **Performance risk accepted for now.** WebGL in a phone's web view is slower than a native game engine. | The scene is light, so 60 frames per second should be reachable. Stage 3 of the build order tests this on real phones before further work. If it fails, the generator and physics, which have no rendering code, transfer to a native engine unchanged. |

## 3. Scope of v1

**Included**

- Grid sizes 3 × 3 to 6 × 6
- Thumb-tilt control and step mode
- Bronze, silver and gold balls
- Holes (from 5 × 5)
- Journey mode, Daily Cube, Explore mode
- Medals, stars, coins, two cube materials
- Local save, sound, haptics, settings

**Not included (planned for later)**

- 7 × 7 to 9 × 9, device-tilt control
- Keys, one-way gates, moving walls, blind faces
- Endless and Time Trial modes, ghost balls, leaderboards

The generator and physics are specified for all sizes up to 9 × 9 now, so the later sizes need no rework.

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `cubyrinth` |
| App identifier | `com.promethica.cubyrinth` |
| Display name | `Cubyrinth`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
cubyrinth/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      maze/       topology, generator, solver, metrics      (no rendering code)
      physics/    ball simulation, collisions, gate logic   (no rendering code)
      game/       states, modes, scoring, levels
      render/     Three.js scene, cube mesh, camera, effects
      input/      thumb tilt, step swipes
      audio/      sound, music, haptics
      state/      save data, settings
      ui/         menus and overlays
    tools/        level calibration and selection scripts
    tests/
```

`maze/` and `physics/` must not import anything from `render/`. They are tested without a screen.

## 5. Terms and units

| Term | Meaning |
|---|---|
| **Cell** | One square of a face's grid. The unit of length throughout: 1 cell = 1.0. |
| **n** | Grid size: each face is n × n cells. |
| **Face** | One of the cube's six sides. |
| **Gate** | An opening in a face's rim that connects two cells on adjoining faces. |
| **Rim** | The wall around the edge of a face. |
| **Tick** | One physics step, 1/120 of a second. |
| **Seed** | A whole number from which a cube is generated. |

Speeds are in cells per second; accelerations in cells per second squared.

## 6. Maze generation

### 6.1 Requirements

1. Every cell on every face can be reached from the start.
2. There is exactly one route between any two cells (a "perfect" maze), so the route from start to finish is unique.
3. Start and finish are at diagonally opposite corners of the cube.
4. The same inputs always give the same cube, on every device.
5. The number of gates is small and controlled, so the cube does not turn constantly.
6. Difficulty is controlled by named parameters, not by luck.

### 6.2 Refinement of the concept

The concept design treated the whole surface as one maze and let gates fall wherever the maze happened to cross an edge. That can put many gates on one edge, and the cube would then turn every few seconds. This specification keeps the same idea, one connected perfect maze over the whole surface, but builds it in two layers so that there are **exactly five gates**:

- **Layer 1:** decide which faces connect to which (five connections join six faces with no loops).
- **Layer 2:** build a perfect maze inside each face, then open one gate for each connection.

Six perfect mazes joined by five gates with no loops form one perfect maze over the whole cube.

### 6.3 Random numbers

All randomness comes from one seeded generator, `mulberry32`, which uses only 32-bit whole-number arithmetic and therefore gives identical results on every device. The system's own random function is never used.

```
rng.next()    -> whole number 0 .. 2^32 - 1
rng.float()   -> rng.next() / 2^32                  (0 <= value < 1)
rng.int(k)    -> floor(rng.float() * k)             (0 .. k - 1)
rng.pick(list)-> list[rng.int(list.length)]
```

### 6.4 Cube topology

Working out which cell is next to which across an edge is the classic source of errors in cube games. This specification avoids hand-written tables by placing every cell at a point in 3D and deriving neighbours from geometry.

**Coordinates.** The cube spans −n to +n on each axis (doubled units, so every value is a whole number). A face is identified by its outward normal **N**, one of ±X, ±Y, ±Z. A cell centre on that face has:

- the normal coordinate equal to n × (sign of **N**)
- the other two coordinates each one of −n+1, −n+3, … , n−1

**Neighbour rule.** For a cell at point **P** on the face with normal **N**, and a step direction **d** (any of the four unit axes perpendicular to **N**):

```
Q = P + 2d
if Q is still within the face  (|Q along d| <= n - 1):
    neighbour = cell at Q, same face
else:
    neighbour = cell at  P + d - N,  on the face whose normal is d
```

A lookup from 3D point to cell is built once per cube size. Every cell then has exactly four neighbours, and each cross-edge pair is found from both sides, which is checked by a test.

**Face-local coordinates.** Each face also stores two whole-number axis vectors **u** and **v** (with **u** × **v** = **N**), so a cell is also addressed as (face, column, row) with column and row from 0 to n−1. These are used for storage and for physics.

**Start and finish.** The start is the cell on the +Y face nearest the cube corner (−, +, −). The finish is the cell on the −Y face nearest the opposite corner (+, −, +).

### 6.5 Layer 1: connecting the faces

The start face (+Y) and finish face (−Y) are opposite, so the route must cross at least one of the four side faces, which form a ring.

Parameter **routeFaces** (3 to 6) sets how many faces the solution passes through.

```
connectFaces(routeFaces, rng):
    ring      = the four side faces in order around the cube
    first     = rng.int(4)                    which side face the route enters
    direction = rng.pick([+1, -1])            which way round the ring it goes
    sides     = the (routeFaces - 2) consecutive ring faces from first, in that direction
    route     = [start face] + sides + [finish face]
    links     = each consecutive pair in route                    (routeFaces - 1 links)
    for each side face not in route, in ring order:
        attach it to rng.pick(its neighbouring faces already linked)   (a dead-end face)
        add that link
    return links                                                   (always exactly 5)
```

| routeFaces | Effect |
|---|---|
| 3 | Shortest route: top, one side, bottom. Three side faces are dead ends. |
| 4–5 | Longer route with one or two dead-end faces. |
| 6 | The route passes through every face. No dead-end faces. |

A dead-end face is a large detour, so at small sizes it is harmless and at large sizes it is punishing. The level tables (section 9) set this deliberately.

### 6.6 Layer 2: the maze inside each face

Each face is carved with the **growing tree** algorithm, chosen because a single parameter changes the character of the maze.

Parameter **windiness** (0 to 1).

```
carveFace(face, n, windiness, rng):
    all walls between cells start closed
    first = random cell on the face;  mark visited;  active = [first]
    while active is not empty:
        index = (rng.float() < windiness) ? last position in active
                                          : rng.int(active.length)
        cell  = active[index]
        options = cell's unvisited neighbours on the same face
        if options is empty:
            remove cell from active
        else:
            next = rng.pick(options)
            open the wall between cell and next
            mark next visited;  add next to the end of active
```

| windiness | Character |
|---|---|
| Near 1 | Long, winding corridors with few branches. Satisfying to roll through; few decisions. |
| Around 0.5 | A mix of corridors and branches. |
| Near 0 | Many short dead ends. More decisions; more stopping and starting. |

Every face has n² cells and ends with exactly n² − 1 open walls.

### 6.7 Opening the gates

```
for each link (faceA, faceB) from Layer 1:
    candidates = the n cell pairs that face each other across the shared edge,
                 excluding any pair containing the start or finish cell,
                 and any cell already used by another gate
    pair = rng.pick(candidates)
    remove the rim between the pair;  record it as a gate
```

### 6.8 Solving and measuring

A breadth-first search from the start gives the unique route to the finish. The following are then measured:

| Measure | Definition |
|---|---|
| **Length** | Cells on the solution route. |
| **Turns** | Changes of direction along the route. |
| **Dead ends** | Cells with only one open side (excluding start and finish). |
| **Longest detour** | Cells in the largest branch off the route, counting dead-end faces. |
| **Shortest face crossing** | Fewest cells travelled on any route face between entering and leaving it. |

### 6.9 Accept or retry

A cube is accepted only if its measures fall inside the bands for its level. Otherwise the attempt number is increased and the cube is regenerated.

```
generateCube(n, seed, params):
    for attempt in 0 .. 199:
        rng   = mulberry32(hash(seed, attempt, GENERATOR_VERSION, n))
        links = connectFaces(params.routeFaces, rng)
        carve all six faces
        open the gates
        solve and measure
        if measures are within params.bands:  return cube
    return the attempt whose measures were closest to the bands
```

**Rejected outright**, whatever the bands: any route face where the shortest face crossing is less than 2 cells when n ≥ 4, because the ball would enter and leave a face almost at once and the cube would turn twice in a second.

**Setting the bands.** The bands are not guessed. A calibration script in `tools/` generates 2,000 cubes for each combination of size and parameters and records the spread of each measure. Bands are then set from that spread: for example, "normal" length is the middle third of the range, "long" the upper third. The script's output is committed with the code.

### 6.10 Holes

Placed after the cube is accepted, at sizes 5 × 5 and above.

- A hole may only be placed in a **dead-end cell** that is not the start, the finish or a gate cell, and is at least 2 cells from any gate along the maze.
- Parameter **holeShare** sets the fraction of eligible dead ends that receive a hole (starting value 0.3).
- Holes are never on the solution route in v1, so a player who follows the correct route never meets one. They punish wrong turns, visibly and fairly.

### 6.11 Output

```
Cube {
  version:   generator version number
  n:         grid size
  seed, attempt
  cells:     for every (face, column, row): 4 bits, one per side, 1 = open
  gates:     5 entries of { faceA, cellA, sideA, faceB, cellB, sideB }
  start, finish:  (face, column, row)
  holes:     list of (face, column, row)
  solution:  list of cells
  measures
}
```

**Cube code.** Any cube is identified by `version-n-seed`, for example `1-5-48213`. The generator version is fixed into the code, so if the algorithm ever changes, old codes still produce their original cubes by running the old version.

### 6.12 Performance target

Generating a 9 × 9 cube, including retries, takes under 100 milliseconds on the minimum phone.

## 7. Ball physics

### 7.1 Model

The simulation is two-dimensional. At any moment the ball is on one face, and its state is:

| | |
|---|---|
| **face** | which face it is on |
| **p** | position on that face, in cells, from (0, 0) to (n, n) |
| **v** | velocity on that face |

The third dimension appears only in drawing: the cube's visible tilt, the ball's height above the surface, and the turn between faces.

### 7.2 Dimensions (tuning constants)

| Constant | Value | Notes |
|---|---|---|
| Ball radius, r | 0.25 | Ball diameter is half a cell. |
| Wall thickness, w | 0.12 | Walls are centred on cell boundaries. |
| Clear corridor width | 0.88 | 1 − w. Leaves 0.19 either side of a centred ball. |
| Hole radius | 0.30 | |
| Finish cup radius | 0.30 | |

### 7.3 Time step

- The simulation advances in **fixed ticks of 1/120 second**, independent of the screen's frame rate.
- Each frame, as many ticks are run as real time requires (at most 8, to avoid a spiral after a stall).
- Drawing interpolates between the last two ticks, so motion is smooth at any frame rate.

### 7.4 Input to acceleration

The input layer supplies a **tilt vector t** once per tick: a point within the unit circle, where (0, 0) is level and length 1 is full tilt.

```
target tilt   = input vector, with dead zone 0.06 removed and rescaled
t             = t + (target - t) * (1 - exp(-dt / 0.06))     smoothing, 60 ms time constant
                                                              (the exp term is a precomputed constant)
acceleration  = A_ball * t                                    in screen axes
```

The smoothing stands in for the weight of the cube: it cannot snap instantly from one tilt to another. The cube is drawn tilted by t × 15 degrees, so what the player sees matches what the ball feels.

The tilt vector is given in screen axes and converted to the current face's axes using the cube's orientation (section 7.8).

### 7.5 Motion

Each tick:

```
v = v + acceleration * dt                              gravity along the tilted face
v = v * (1 - C_drag * dt)                              rolling drag, proportional to speed
if |v| > 0:  reduce |v| by C_friction * dt, not below 0 constant rolling friction
if |v| > V_max:  scale v to length V_max               speed cap
p = p + v * dt
resolve collisions (7.6)
check gates, holes and finish (7.7, 7.10)
if |v| < 0.02 and |t| = 0:  v = 0                      come to rest
```

| Constant | Bronze | Silver | Gold | Notes |
|---|---|---|---|---|
| Speed factor | 1.0 | 1.4 | 1.8 | From the concept design. |
| A_ball (full-tilt acceleration) | 12 | 16.8 | 21.6 | From rest, bronze crosses one cell in about 0.4 s. |
| V_max (speed cap) | 6 | 8.4 | 10.8 | |
| C_drag | 1.2 per second | same | same | |
| C_friction | 0.6 | same | same | Stops a slow ball on a level cube. |

Only acceleration and top speed differ between balls. All three are the same size, so every route is possible with every ball.

### 7.6 Walls and collisions

**Geometry.** Each closed wall is a line segment along a cell boundary. Collinear segments are merged into single long segments when the face is loaded. The rim is treated the same way, with a one-cell gap at each gate.

**Detection.** For each nearby segment, find the closest point on the segment to the ball's centre. The ball touches the wall if the distance is less than r + w/2. Using the closest point means wall ends and corners behave as rounded posts with no special cases.

**Only nearby walls are tested:** those bordering the ball's cell and its eight neighbours.

**Response**, for each touching wall, repeated up to 4 times per tick until none remain:

```
normal      = unit vector from the closest point to the ball's centre
penetration = (r + w/2) - distance
p           = p + normal * penetration                       push the ball out
vn          = v . normal                                     speed into the wall (negative = approaching)
if vn < 0:
    bounce  = (|vn| < 0.5) ? 0 : RESTITUTION                 slow contact: no bounce, so no jitter
    v       = v - (1 + bounce) * vn * normal                 reflect the approaching part
    v       = v - WALL_FRICTION * (tangential part of v)     slight scrub along the wall
    report an impact of strength |vn| (for sound and haptics)
```

| Constant | Value |
|---|---|
| RESTITUTION | 0.30 |
| WALL_FRICTION | 0.02 |

**No tunnelling.** At the gold ball's top speed, the ball moves 10.8 / 120 = 0.09 cells per tick. To pass through a wall, its centre would have to jump 2r + w = 0.62 cells in one tick. The rule is that **movement per tick must stay below r**; a test enforces it for every ball, so no future tuning change can break it unnoticed.

### 7.7 Gates and the automatic turn

**Trigger.** A gate fires when the ball's centre crosses the edge line of the face within the gate's opening, while the gate is armed.

**Sequence.**

1. The game state changes from ROLLING to TURNING. Physics ticks stop. The level timer stops.
2. Over **0.45 seconds** (eased in and out), the cube rotates 90 degrees about its centre, on the axis parallel to the shared edge, so that the new face comes to the top.
3. During the rotation the ball stays attached to the cube and travels a quarter circle of radius r around the edge, from sitting above the edge on the old face to sitting above the edge on the new face.
4. The ball is placed on the new face (below), the tilt is reset to level, and the state returns to ROLLING.

**Position on the new face.** The ball sits on the edge line of the new face, at the same distance along the edge as it left, moved if necessary so that it is at least r + w/2 from each gate post.

**Velocity on the new face.** Let **N** be the old face's normal and **d** the direction in which the ball left (which is also the new face's normal). Split the velocity into the part along **d** and the part along the edge:

```
v_old = a * d  +  b * e           e = direction along the shared edge
v_new = a * (-N)  +  b * e        the outward part now points away from the edge, across the new face
```

The direction is therefore carried naturally around the corner. The speed is then limited to **V_entry = 2 cells per second**, so the ball arrives gently and the player has time to see the new face.

**Tilt reset.** When the turn ends, the tilt vector is set to zero and the player's current touch position becomes the new neutral point. The player does not need to lift their thumb. Without this, a thumb still held towards the gate would roll the ball straight on at full tilt.

**Re-arming.** The gate just used is disarmed on arrival and re-arms once the ball's centre is more than 0.6 cells from the edge. This prevents the ball from flipping back and forth.

**What the player sees.** Because the cube physically rolls over the shared edge, a ball that leaves by the right-hand side of the screen arrives at the left-hand side of the new face, still moving right. Screen direction is preserved across every turn, which is the main defence against disorientation.

### 7.8 Cube orientation

The cube's orientation is one of 24 possibilities, stored as a 3 × 3 matrix of whole numbers (each entry −1, 0 or 1) that converts cube axes to screen axes. Each turn multiplies it by a fixed 90-degree rotation matrix. Because only whole numbers are involved, the orientation never drifts.

The same matrix converts the player's tilt vector from screen axes to the current face's **u** and **v** axes.

### 7.9 Determinism

Given the same cube, ball and sequence of inputs, the simulation must produce exactly the same result on every device. This is what will make replays, ghost balls and fair leaderboards possible in v2.

- Fixed tick length; never the frame time.
- Only add, subtract, multiply, divide and square root inside the simulation. These give identical results on all devices. Sine, cosine and similar functions do not, and are used only for drawing.
- The input tilt vector is rounded to steps of 1/256 before use.
- A run is recorded as the list of rounded inputs per tick. Replaying that list reproduces the run.

### 7.10 Holes, finish and checkpoints

| Event | Rule |
|---|---|
| **Hole** | If the ball's centre comes within (hole radius − 0.08) of a hole's centre, it falls. State becomes FALLING for 0.3 s (the ball shrinks and drops), then the ball reappears at the checkpoint, at rest, after a 0.5 s pause. The fall is counted. The timer keeps running. |
| **Checkpoint** | The start cell, then the entry point of the most recent gate. Updated on every turn. |
| **Finish** | If the ball's centre comes within 0.30 of the finish cell's centre, at any speed, the ball is drawn settling into the cup and the level ends. |

In Explore mode, holes are not generated.

### 7.11 Step mode

Step mode uses the same cube but no continuous physics.

- A swipe in one of four directions slides the ball from cell centre to cell centre at 8 cells per second until the next cell is blocked by a wall.
- If the slide reaches a gate, the cube turns as in 7.7 and the ball stops in the entry cell.
- If the slide enters a hole cell, the ball falls.
- Swipes made during a slide are held and applied when it ends (one swipe remembered).
- Ball choice has no effect on movement in step mode. Step-mode completions earn a separate "step" medal and do not count towards bronze, silver or gold.

### 7.12 Thumb-tilt input

- Touching anywhere sets the neutral point. Dragging away from it gives the tilt vector: (current − neutral) ÷ 80 points, limited to length 1.
- Lifting the thumb returns the target tilt to level.
- A sensitivity setting scales the 80-point radius between 50 and 120.
- There is no fixed on-screen joystick, so the control suits either hand.

### 7.13 Game states

```
READY  ->  ROLLING  <->  TURNING
              |  \
              |   ->  FALLING  ->  ROLLING
              v
           FINISHED
PAUSED can be entered from ROLLING and returns to it.
```

The timer runs only in ROLLING and FALLING.

### 7.14 Hooks for drawing and sound

The simulation reports events; it never plays or draws anything itself.

| Event | Used for |
|---|---|
| Speed each tick | Rolling sound pitch and volume; the ball's visible spin (angle = distance ÷ r). |
| Impact, with strength | Knock sound and vibration scaled to strength. Impacts below 0.5 are silent. |
| Gate entered, turn finished | Turn animation, "clunk" sound, firm vibration. |
| Fell, respawned | Falling whistle, respawn effect. |
| Finished | Chime, celebration. |

## 8. Rendering

- One cube mesh built from the generated data: floor per face, merged wall boxes, rim, gate openings, holes, start marker and finish cup.
- Camera above the cube, angled about 20 degrees from vertical, zoomed so the top face fills the screen width with the adjoining faces just visible.
- One soft light from above with short wall shadows.
- A fading trail behind the ball on the current face.
- Gates glow; the finish pulses.
- An optional mini-map shows the six faces unfolded, with visited faces marked.
- Target: a steady 60 frames per second on the minimum phones at 6 × 6.

## 9. Levels and modes

### 9.1 Level definition

A level is `{ n, seed, routeFaces, windiness, holeShare, bands }`. Journey levels are chosen in advance with a selection script, which generates candidates, sorts them by their measures and writes an ordered list. The list is committed with the code, so every player gets the same Journey.

### 9.2 Journey (v1)

| Stage | Size | Levels | routeFaces | windiness | Holes | Introduces |
|---|---|---|---|---|---|---|
| 1 | 3 × 3 | 10 | 3 | 0.9 | None | Rolling, gates |
| 2 | 4 × 4 | 20 | 3–4 | 0.8 | None | Dead ends; silver ball |
| 3 | 5 × 5 | 25 | 4–5 | 0.6–0.8 | 0.3 | Holes; gold ball |
| 4 | 6 × 6 | 25 | 5–6 | 0.5–0.7 | 0.4 | Longer routes |

The first three levels are chosen by hand to be solvable in about 20 seconds.

### 9.3 Other modes

| Mode | Rules |
|---|---|
| **Daily Cube** | Seed is the date as a number. Size cycles through 4, 5 and 6 by day. One cube per day, unlimited attempts, best time kept. |
| **Explore** | Any unlocked size, random seed, no timer, no holes. |

### 9.4 Scoring

```
base        = 100 * n
ballFactor  = 1 (bronze), 1.5 (silver), 2 (gold)
timeBonus   = base * clamp(parTime / timeTaken, 0, 2)
score       = round((base + timeBonus) * ballFactor)
stars       = 3 if time <= par, 2 if time <= 1.5 * par, otherwise 1
parTime     = solution length / (0.45 * V_max of the ball) + 0.45 * gates on the route
```

Par is therefore different for each ball and follows from the cube itself. The 0.45 factor is a tuning constant.

## 10. Saved data and settings

Saved after every level as one JSON document: settings, coins, unlocked balls and materials, per-level best time, stars, falls and medals per ball, Daily Cube history and streak, and the level in progress (cube code, ball, face, position, elapsed time) so that a closed app resumes at the last checkpoint.

| Setting | Values | Default |
|---|---|---|
| Control | Thumb tilt / Step | Thumb tilt |
| Tilt sensitivity | 50–120 | 80 |
| Mini-map | On / Off | On |
| Ball trail | On / Off | On |
| Music, sound effects, vibration | On / Off each | On |
| Reduce motion | On / Off | Follows the device. When on, the turn is a 0.2 s cross-fade. |
| Reset progress | Button, with confirmation | – |

## 11. Testing

**Generator (automated, run over thousands of seeds at every size from 3 to 9)**

- Every cell has four neighbours, and neighbour relationships agree from both sides.
- Every cell is reachable from the start.
- Open walls total exactly 6n² − 1 (one connected maze with no loops).
- There are exactly 5 gates, and none touches the start or finish cell.
- Start and finish are at opposite corners of the cube.
- The same code always produces an identical cube.
- No hole lies on the solution route.
- Generation time is within the target.

**Physics (automated)**

- Movement per tick is below the ball radius for every ball.
- Over one million random ticks in random cubes, the ball's centre is never closer to a wall than r + w/2, allowing a tiny rounding margin.
- A collision never increases the ball's speed.
- A ball on a level cube always comes to rest.
- Crossing a gate and immediately crossing back returns the ball to the original face and orientation.
- After any sequence of turns, the orientation matrix is still one of the 24 valid ones.
- A recorded run replays to exactly the same final state.
- Every Journey level can be completed by a simple automatic player that steers along the solution, with each ball.

**On devices**

- 60 frames per second at 6 × 6 on the minimum phones.
- Thumb tilt feels responsive, with no visible delay between drag and tilt.
- Playtesters can follow the ball through a turn without losing track of it.

## 12. Build order

| Stage | Deliverable | Purpose |
|---|---|---|
| 1 | Topology, generator, solver and their tests; a script that prints cubes as text | Proves the maze design with no graphics. |
| 2 | Physics on a single flat face in a browser, drawn in 2D from above | **Proves the control feel.** The game depends on this stage. |
| 3 | Three.js cube, camera, gate turn; tested on real phones | Proves performance and that the turn is readable. |
| 4 | Balls, holes, checkpoints, finish, timer, scoring | A complete level. |
| 5 | Calibration and selection scripts; Journey level list | Tuned content. |
| 6 | Step mode, Daily Cube, Explore, menus, save and resume | |
| 7 | Sound, haptics, materials, mini-map, polish | |
| 8 | Android and iOS packaging | |

If stage 2 does not feel good after tuning, the project should pause there. Nothing later can rescue poor control.

## 13. Risks

| Risk | Mitigation |
|---|---|
| **Control feel.** | Stage 2 exists solely to test it, early and cheaply. All constants are in one file. |
| **Performance in a web view.** | Tested in stage 3. The generator and physics are independent of rendering and can move to a native engine if needed. |
| **Disorientation after turns.** | Screen direction is preserved across turns; gentle entry speed; tilt reset; mini-map; trail; only five gates per cube. |
| **Dead-end faces frustrate players at large sizes.** | `routeFaces` is set to 5–6 from 6 × 6 upwards, leaving at most one dead-end face. |
| **Gold ball too hard, or bronze too dull.** | Speed factors are tuning constants; par times scale with each ball. |
| **Thumb covers the ball.** | The camera frames the cube in the upper two-thirds of the screen, and the control works from anywhere, so the thumb rests in the lower third. |

## 14. Open questions

1. Are assumptions A3 to A5 acceptable? (A1 and A2 are confirmed.)
2. ~~What is the app identifier (reverse domain)?~~ Answered: `com.promethica.cubyrinth`.
3. Should the timer stop during the turn, as specified, or keep running?
4. Should step mode have its own medal, as specified, or count towards bronze?
5. Should small phones be capped at 7 × 7 when the larger sizes arrive, as the concept proposed?
