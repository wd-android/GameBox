# Lockbox – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/09-lockbox.md)*

This document specifies the first playable release (v1) in enough detail to build from. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Lockbox" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Relaxed-mode feedback | A **player setting with two options**: show *how many* parts are correct, or show *which* parts are correct (section 7). |
| Technology | Same as Oddness and Cubyrinth: TypeScript, Vite, React and Capacitor, for iOS and Android from one codebase. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **Two-dimensional artwork** (confirmed 15 November 2026). Locks and chests are drawn as layered 2D illustrations with a rich, shaded look, animated by rotating and sliding the layers. No 3D engine. | The concept asked for a "slightly stylised 3D look". Painted 2D layers give that appearance at a fraction of the cost, and dials, wheels, bolts and bottles only ever move in a plane. |
| A2 | **Four lock types in v1:** digit padlock, coloured bottles, concentric rings, sliding bolts. | As the concept's first-version scope. Each further type is a self-contained addition (section 5). |
| A3 | **Puzzles are generated on the device from a seed,** and every generated puzzle is checked by a solver before it is shown. | Unlimited chests with no download, and a guarantee that every lock can be opened by reasoning. |
| A4 | **No server, adverts or purchases in v1.** Hints are bought with coins earned in play. | As for the other two games. |
| A5 | **Chained chests wait for v2.** In v1 a chest has one lock, or two to three independent locks. | Chaining (one lock revealing the next lock's clue) needs every lock type finished first. |

## 3. Scope of v1

**Included**

- Four lock types, each at three information levels where applicable
- Relaxed and Locksmith modes, and the Daily Safe
- Two chapters of 30 chests each
- Chest rewards, the vault, trinket sets and locksmith ranks
- Hints (Nudge and Clue)
- Local save, sound, haptics, settings

**Not included (planned for later)**

- The other eight lock types
- Heist and Workshop modes
- Chained chests, events, leaderboards, sending chests to friends

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `lockbox` |
| App identifier | `<your reverse domain>.lockbox` (to be supplied) |
| Display name | `Lockbox`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
lockbox/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      locks/      one folder per lock type: generator, solver, rules   (no UI code)
        padlock/  bottles/  rings/  bolts/
      chest/      chest assembly, rewards, chapters
      game/       modes, attempts, stars, hints
      state/      save data, settings
      ui/         screens, one view component per lock type
      audio/      sound, music, haptics
    tools/        calibration scripts
    tests/
```

`locks/` must contain no user-interface code, so every generator and solver can be tested without a screen.

## 5. The lock framework

Every lock type is a module with the same shape. Adding a lock type later means adding one module and one view; nothing else changes.

```
LockType {
  id                                   e.g. "padlock"
  generate(params, rng) -> Puzzle      builds a puzzle and verifies it (5.2)
  initialState(puzzle)  -> State       what the player first sees
  applyMove(state, move) -> State      a wheel turned, two bottles swapped, a bolt slid
  isAttemptBased                       true if the player presses "Try" to test a setting
  check(puzzle, state)  -> Feedback    result of an attempt, or of the current position
  isSolved(puzzle, state) -> boolean
  hint(puzzle, state, kind) -> Hint
  par(puzzle, feedbackDetail) -> number   expected attempts or moves for three stars
}

params   = { parts, information, seed }
information = "full" | "clued" | "feedback"
```

### 5.1 Random numbers

All randomness comes from one seeded generator (`mulberry32`), never the system's random function. The same chest seed always produces the same locks and the same reward, on every device.

### 5.2 The fairness guarantee

No puzzle is shown unless it passes all of the following:

1. **It has a solution.**
2. **The solution is unique** (padlock and bottles), or is reachable and its shortest length is known (rings and bolts).
3. **It can be solved by reasoning.** For clued puzzles, a *deduction solver* must reach the answer by applying the clues one at a time to narrow the possibilities, without trial and error. Late-chapter puzzles may require one "suppose this, then…" step; none may require more.
4. **It is not trivial.** For example, a clued puzzle whose first clue gives the whole answer is rejected.

If a generated puzzle fails, the generator tries again with the next attempt number (up to 100), all from the same seed.

### 5.3 Difficulty controls

As in the concept, two controls apply to every lock:

- **Parts:** the number of wheels, bottles, rings or bolts.
- **Information:**

| Level | Meaning |
|---|---|
| **Full** | The answer, or everything needed to read it off, is visible on the chest. |
| **Clued** | Clues must be combined to deduce the answer. |
| **Feedback** | No clues. The player learns only from the result of each attempt. |

## 6. Lock types

### 6.1 Digit padlock

**What the player sees:** a row of wheels, each showing a digit from 0 to 9. Drag a wheel up or down to turn it. A shackle button tries the code.

| Parameter | Range |
|---|---|
| Wheels | 3 to 5 |
| Digits | All different in v1 (repeats allowed in a later expert tier) |

**Full.** The code is visible somewhere on the chest (scratched on the lid, on a tag). Teaches the control.

**Clued.** The chest carries several clue lines. Each is a sample code and a statement about it:

| Statement | Meaning |
|---|---|
| "Nothing is correct." | None of these digits is in the code. |
| "One digit is correct and in the right place." | |
| "One digit is correct but in the wrong place." | |
| "Two digits are correct, but both are in the wrong place." | |
| "Two digits are correct; one is in the right place." | |

Generator:

```
generateCluedPadlock(wheels, rng):
    secret = random code with distinct digits
    clues  = []
    repeat:
        guess = random code with distinct digits, not the secret
        clues.add(guess, feedback(secret, guess))
        remaining = all codes consistent with every clue          (at most 100,000 to check)
    until remaining contains only the secret, or clues exceed 8
    remove any clue whose removal still leaves exactly one code   (keeps the set minimal)
    accept if 3 <= clues <= 6, at least one clue is "Nothing is correct" (early chapters),
           and the deduction solver succeeds (5.2)
```

**Feedback.** No clues. After each try the lock reports the result according to the feedback setting (section 7).

### 6.2 Coloured bottles

**What the player sees:** a shelf of bottles, each a different colour and shape. Drag a bottle onto another to swap them. A lever tries the arrangement.

| Parameter | Range |
|---|---|
| Bottles | 3 to 8 |

Each bottle differs in both colour and silhouette, and carries a symbol on its label, so the puzzle never depends on colour vision.

**Full.** A label on the shelf shows the order.

**Clued.** The chest carries statements about the order:

| Clue type | Example |
|---|---|
| Position | "Green is third." (at most one per puzzle) |
| Not position | "Blue is not at either end." |
| Left of | "Red is somewhere to the left of Yellow." |
| Next to | "Purple is next to Green." |
| Not next to | "Red is not next to Blue." |
| Between | "Yellow is between Red and Blue." |

Generator:

```
generateCluedBottles(count, rng):
    secret = random order of the bottles
    pool   = every clue of every type that is true of the secret, shuffled
    clues  = []
    for clue in pool:
        if clue removes at least one remaining order:  clues.add(clue)
        if only the secret remains:  stop                         (at most 40,320 orders to check)
    remove any clue whose removal still leaves exactly one order
    accept if the clue count is within the band for this size,
           at least three clue types are used (from 5 bottles),
           and the deduction solver succeeds
```

**Feedback.** No clues. After each try the shelf reports the result according to the feedback setting.

### 6.3 Concentric rings

**What the player sees:** a round picture cut into rings. Each ring has been turned. Drag a ring to rotate it in steps; the lock opens when the picture is whole.

| Parameter | Range |
|---|---|
| Rings | 2 to 5 |
| Steps per full turn | 8 or 12 |
| Linkages | 0 to 4 |

A **linkage** means that turning one ring also turns another, by one step in the same or the opposite direction.

| Information | Meaning for this lock |
|---|---|
| **Full** | No linkages. Every ring turns alone. |
| **Clued** | Linkages exist and are drawn as small gears between the rings. |
| **Feedback** | Linkages exist but are hidden. The player discovers them by turning. |

Generator:

```
generateRings(rings, steps, linkages, rng):
    choose `linkages` distinct ordered pairs (driver, follower), each +1 or -1
    start from the solved position
    apply 20 random turns                                         (so a solution is guaranteed)
    shortest = breadth-first search back to solved                (at most 248,832 positions)
    accept if shortest is within the band for this difficulty and is at least `rings`
```

This lock is not attempt-based: it opens the moment the picture is whole. Stars are based on the number of ring turns compared with the shortest solution.

### 6.4 Sliding bolts

**What the player sees:** a square frame holding horizontal and vertical bolts. Each bolt slides only along its own length and cannot pass through another. One bolt, marked in brass, is the latch; slide it fully out of the frame to open the lock.

| Parameter | Range |
|---|---|
| Frame | 5 × 5 or 6 × 6 squares |
| Bolts | 4 to 12 |
| Bolt length | 2 or 3 squares |

Generator:

```
generateBolts(size, boltCount, rng):
    place the latch on the exit row, away from the exit
    place the other bolts at random, without overlap
    shortest = breadth-first search for the fewest slides that free the latch
    accept if solvable and shortest is within the band for this difficulty
```

Everything is always visible, so the information control does not apply; difficulty comes from the number of bolts and the shortest solution. This lock is not attempt-based. Stars are based on slides used compared with the shortest solution.

### 6.5 Later lock types

Directional lock, switches, safe dial, word lock, key matching, pin tumblers, weights and scales, and sliding tiles each become one module. They are not specified here.

## 7. Feedback detail (the Relaxed-mode setting)

Setting name: **"After each try, show…"**. Options: **How many are correct** / **Which are correct**. Default: **Which are correct**.

| Lock | How many | Which |
|---|---|---|
| **Digit padlock** | "2 in the right place, 1 in the wrong place." | Each wheel in the right place glows green. The count in the wrong place is still given as a number, without saying which. |
| **Coloured bottles** | "3 bottles are in the right place." | Each correctly placed bottle glows and its cork lifts slightly. |
| **Concentric rings** | A counter: "2 of 4 rings aligned." | Each aligned ring shows a small lit marker. |
| **Sliding bolts** | Not applicable. | Not applicable. |

Rules:

- The setting takes effect **in Relaxed mode only**. Locksmith mode and the Daily Safe always use "How many", so that results are comparable between players.
- For the padlock and bottles, it matters only at the **Feedback** information level. At Full and Clued the answer is deduced before trying, and a wrong try simply says "That's not it."
- It can be changed at any time from Settings or from the pause menu, and applies from the next try.
- Each option has its own par (section 8.3), so choosing "Which" does not make three stars automatic.
- Earlier tries stay on screen as a scrollable history with their feedback, in whichever form they were given.

The default is "Which", because Relaxed is the mode new players meet first and it is the gentler option.

## 8. Modes, attempts and stars

### 8.1 Modes

| Mode | Attempts | Feedback detail | On failure |
|---|---|---|---|
| **Relaxed** | Unlimited | Player's setting | Cannot fail |
| **Locksmith** | Limited (8.2) | How many | The lock jams. The chest can be retried with a freshly generated puzzle of the same difficulty. |
| **Daily Safe** | Unlimited, counted | How many | Cannot fail |

Each chapter chest can be opened in either mode. Stars earned in Locksmith mode are shown in gold; stars earned in Relaxed mode are shown in silver. Only gold stars count towards locksmith rank.

### 8.2 Locksmith attempt limits

| Lock and level | Limit |
|---|---|
| Any lock at Full or Clued | 3 tries |
| Padlock, Feedback: 3 / 4 / 5 wheels | 7 / 8 / 10 tries |
| Bottles, Feedback: 3–4 / 5–6 / 7–8 bottles | 6 / 8 / 10 tries |
| Rings | Shortest solution × 3 turns |
| Bolts | Shortest solution × 2.5 slides |

### 8.3 Stars and par

| Lock kind | 3 stars | 2 stars | 1 star |
|---|---|---|---|
| Full or Clued (deduced) | First try | Second try | Third or later |
| Feedback (attempt-based) | Tries ≤ par | Tries ≤ par + 2 | Opened |
| Rings and bolts (move-based) | Moves ≤ shortest × 1.25 | Moves ≤ shortest × 2 | Opened |

**Par is measured, not guessed.** A calibration script plays 1,000 generated puzzles of each lock, size and feedback option with a competent reference solver, and sets par to the median number of tries plus one. The resulting table is committed with the code. Because "Which" gives more information, its par is lower than "How many" for the same puzzle.

A chest's stars are the lowest of its locks' stars.

## 9. Chests

### 9.1 Structure

```
Chest {
  id, chapter, tier            tier = wooden | iron | silver | gold
  seed
  locks: 1 to 3 of { type, parts, information }
  reward                       decided from the seed when the chest is first generated
}
```

- With several locks, the player taps any lock to work on it, in any order. Progress on each lock is kept.
- The chest opens when the last lock is solved.

### 9.2 Rewards

Decided from the chest's seed, so re-opening or reinstalling cannot change it.

| Tier | Coins | Trinket chance | Rare item chance |
|---|---|---|---|
| Wooden | 10–25 | 40% | 0% |
| Iron | 20–50 | 60% | 5% |
| Silver | 40–90 | 80% | 10% |
| Gold | 80–160 | 100% | 20% |

- A chest gives its full reward the first time it is opened, and coins only (at one fifth) on replays.
- A trinket is drawn from the sets belonging to the current chapter, favouring ones the player does not yet have.
- The opening sequence is always the same: the lid lifts, light spills out, and the contents rise one at a time.

### 9.3 Chapters

| | Chapter 1: The Attic | Chapter 2: The Ship's Hold |
|---|---|---|
| Chests | 30 | 30 |
| Lock types | Padlock, bottles | Adds rings, then bolts |
| Unlocks | From the start | On opening 24 chests in Chapter 1 |

**Chapter 1 progression**

| Chests | Locks per chest | Types and information | Parts |
|---|---|---|---|
| 1–3 | 1 | Padlock, Full | 3 wheels |
| 4–6 | 1 | Bottles, Full | 3 bottles |
| 7–12 | 1 | Padlock or bottles, Clued | 3–4 |
| 13–18 | 1 | Padlock or bottles, Feedback | 3–4 |
| 19–24 | 2 | One Clued, one Feedback | 4 |
| 25–30 | 2 | Mixed | 4–5 |

**Chapter 2 progression**

| Chests | Locks per chest | Types and information | Parts |
|---|---|---|---|
| 1–4 | 1 | Rings, Full | 2–3 rings |
| 5–8 | 1 | Rings, Clued | 3 rings, 1–2 linkages |
| 9–12 | 1 | Bolts | 5 × 5, 4–6 bolts |
| 13–20 | 2 | Any two types | Padlock and bottles 4–5; rings 3–4; bolts 6–8 |
| 21–26 | 2–3 | Any, including rings at Feedback | Up to 5 wheels, 6 bottles, 4 rings, 9 bolts |
| 27–30 | 3 | Any | Upper end of the above |

Every new lock type, and every new information level, first appears alone on a single-lock chest.

Chest seeds for both chapters are fixed in a list committed with the code, so every player meets the same chests.

### 9.4 Daily Safe

- One chest a day, seed taken from the date, so it is the same for everyone.
- Two locks of different types, at mid-chapter-2 difficulty.
- One completion per day. The result records total tries and can be copied as text: *"Lockbox Daily 15 Nov – opened in 7 tries."*
- A streak counts consecutive days completed.

## 10. Hints

| Hint | Effect | Cost |
|---|---|---|
| **Nudge** | Padlock: sets one wheel to its correct digit and locks it. Bottles: puts one bottle in its correct place and fixes it. Rings: shows the best next turn. Bolts: shows the best next slide. | 30 coins |
| **Clue** | Padlock and bottles: adds one more clue line that removes at least a quarter of the remaining possibilities. Not offered for rings and bolts. | 20 coins |

- Each hint can be used up to twice per lock.
- Using a hint limits that lock to two stars.
- Hints are not available in the Daily Safe.

## 11. Long-term progress

| Feature | Rule |
|---|---|
| **Vault** | A room showing every opened chest and collected trinket. Trinkets can be dragged between shelves; the arrangement is saved. |
| **Trinket sets** | Four sets of 8 per chapter (for example Old Keys, Foreign Coins). Completing a set awards 100 coins. |
| **Locksmith rank** | From gold stars: Apprentice (0), Journeyman (30), Locksmith (75), Safecracker (120), Master (165 of a possible 180). |

## 12. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on a small wooden chest with a three-wheel padlock, the code scratched on the lid. No menu. After three chests the Home screen appears. |
| **Home** | Continue, Daily Safe, Chapters, Vault, Settings. Shows coins, rank and daily streak. |
| **Chapter map** | The 30 chests along a path through the chapter's setting, with stars. |
| **Chest** | The whole chest with its locks. Solved locks hang open. Tap a lock to work on it. |
| **Lock** | The lock fills the upper two-thirds. Clues, if any, are part of the scene and can be tapped to enlarge. Try button (where used), hint buttons, tries remaining (Locksmith) and the history of earlier tries sit in the lower third. |
| **Opening** | The reward sequence. |
| **Vault** | Shelves of chests and trinkets; set progress. |
| **Settings / Pause** | See section 14. |

Layout rules: minimum touch target 56 × 56 points; all controls within the lower two-thirds of the screen; safe areas respected; clue text never smaller than 16 points and enlargeable.

## 13. Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Wheel or ring moves one step | Settles into its notch | Crisp tick | Light tick |
| Bottle picked up / swapped | Lifts with a shadow; neighbours shuffle aside | Glass clink | Light tick |
| Bolt slides / stops | Slides and stops firmly | Wooden slide, then knock | Tick on stopping |
| Try: wrong | Shackle or lever rattles; feedback appears | Dull rattle | Double pulse |
| Part shown as correct ("Which") | Green glow | Soft, warm click | Light pulse |
| Lock solved | Springs open | Bright metallic snap | Firm pulse |
| Chest opens | Lid lifts, light spills out | Heavy "thunk", creak, shimmer | Long soft pulse |
| Reward appears | Item rises and turns | Chime | Light pulse |

Every sound has a visual equivalent, so the game is fully playable in silence. With "Reduce motion" on, rattles and rises become simple fades.

## 14. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| After each try, show… (Relaxed mode) | How many are correct / Which are correct | Which are correct |
| Preferred mode for new chests | Relaxed / Locksmith | Relaxed |
| Music, sound effects, vibration | On / Off each | On |
| Symbols on bottles and lights | On / Off | On |
| Large clue text | On / Off | Off |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every move: settings; coins; rank; for each chest, its stars in each mode and whether the full reward has been taken; trinkets owned and vault arrangement; Daily Safe history and streak; and the chest in progress, including each lock's current state and try history, so a closed app resumes exactly where it stopped. A `version` number allows later builds to convert older saves. No personal data is collected and nothing leaves the device.

## 15. Testing

**Generators and solvers (automated, over thousands of seeds for every lock, size and information level)**

- Every generated puzzle has a solution, and padlock and bottle puzzles have exactly one.
- Every clued puzzle is solved by the deduction solver within the allowed depth.
- No clue in a clued puzzle is redundant.
- Ring and bolt puzzles are solvable, and the recorded shortest solution really is the shortest.
- The same seed always gives the same puzzle and the same reward.
- Generation takes under 200 milliseconds per lock on the minimum phone.

**Rules (automated)**

- "How many" and "Which" feedback always agree with each other and with the secret.
- Feedback in Locksmith mode and the Daily Safe is "How many" whatever the setting.
- A Nudge never contradicts the solution; a Clue is always true and always narrows the possibilities.
- Stars follow section 8.3 at each boundary.
- A save written mid-lock loads back to an identical state.

**Acceptance criteria for v1**

1. A new player is turning their first wheel within 5 seconds of launch.
2. Each of the four lock types can be learned from its first chest without written instructions.
3. Changing the feedback setting takes effect on the next try in Relaxed mode and has no effect in Locksmith mode.
4. The game is fully playable with sound and vibration off, and by a player who cannot distinguish colours.
5. The game works in aeroplane mode.
6. Closing the app at any moment loses nothing.

## 16. Build order

| Stage | Deliverable |
|---|---|
| 1 | Lock framework; padlock and bottle generators, solvers and tests |
| 2 | Playable padlock and bottles in a browser with plain placeholder graphics; attempts, feedback setting, history |
| 3 | Chest assembly, rewards, Relaxed and Locksmith modes, stars, save and resume |
| 4 | Ring and bolt generators, solvers, tests and views |
| 5 | Calibration script; par tables; chapter chest lists |
| 6 | Chapter map, vault, trinkets, ranks, Daily Safe, hints, settings |
| 7 | Artwork, animation, sound and haptics |
| 8 | Android and iOS packaging |

Stages 1 to 6 need no final artwork, so the puzzles can be played and tuned in full first.

## 17. Risks

| Risk | Mitigation |
|---|---|
| **Clued puzzles that are technically unique but feel like guesswork.** | The deduction solver (5.2) rejects them. Its depth limit is a tuning constant per chapter. |
| **Four small games to build.** | The shared framework keeps each lock to a generator, a solver and a view. Padlock and bottles come first and prove the framework. |
| **Feedback-level puzzles feel slow with many parts.** | Attempt history stays on screen; "Which" is the Relaxed default; parts rise gradually. |
| **Players dislike one lock type.** | Multi-lock chests in v2 may allow one lock to be skipped. In v1, hints cover this. |
| **Touch feel of wheels and rings.** | Step-by-step haptic ticks and snap-to-notch are built in stage 2 and tested on real phones early. |
| **Artwork cost.** | Four lock sets, four chest tiers and two chapter settings. 2D layers (A1) keep this modest. |

## 18. Open questions

1. Are assumptions A2 to A5 acceptable? (A1, 2D artwork, is confirmed.)
2. What is the app identifier (reverse domain)?
3. Should the default feedback option be "Which are correct", as specified, or "How many"?
4. Should Relaxed-mode stars count towards locksmith rank? As specified, only Locksmith-mode stars do.
5. Should the two chapter settings be the Attic and the Ship's Hold, as proposed?
