# Topple – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/03-topple.md)*

This document specifies the first playable release (v1) in enough detail to build from. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Topple" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Showing par | A **player setting, off by default** (section 7). With it off, par is revealed only after the puzzle is solved. |
| Technology | Same as the other games: TypeScript, Vite and Capacitor, for iOS and Android from one codebase. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **The chain is calculated by fixed rules, not by a physics engine.** Each domino either knocks the next or does not, according to section 6. The falling is then played as animation. | The concept identified this as essential: a puzzle must fall identically on every phone, or shared results mean nothing. It also lets every puzzle be checked by machine. |
| A2 | **3D drawing with Three.js,** as in Cubyrinth. | Falling dominoes and a camera that follows the chain need depth to look right. The scene is light: a table and up to about 150 dominoes. |
| A3 | **Daily puzzles are bundled in the app, with no server** (confirmed 15 November 2026). The app ships with 120 daily puzzles (about four months). More arrive with app updates. | Removes hosting from v1. If the supply runs out before an update, the app replays the earliest puzzles and says so. A later version can fetch new puzzles from a simple hosted file. |
| A4 | **Pieces sit in fixed positions and face a fixed way.** The player chooses which gaps to fill, not how to turn the piece. | The concept mentioned turning pieces. Leaving it out keeps the first version to one clear decision per piece; turning can arrive with a later pack as a new idea. |
| A5 | **"Par" means the fewest dominoes that can solve the puzzle,** worked out by the solver. Solving with exactly that number earns the gold mark. | The concept used "par" and "under par" loosely. One number is easier for players to understand. |
| A6 | **No adverts or purchases in v1.** The whole archive is free. | As for the other games. |

## 3. Scope of v1

**Included**

- The Daily Topple, with 120 puzzles bundled
- The Archive of all past daily puzzles
- One pack of 30 puzzles
- Standard domino, tall domino, forks, ramp and ball
- Streaks, calendar, statistics
- Shareable text result
- One hint per puzzle
- Four domino styles and two tables
- Puzzle editor and solver (development tools)
- Local save, sound, haptics, settings including the par setting

**Not included (planned for later)**

- Splitter, bell, seesaw, switch and gate, stairs, fan and magnet
- Turning pieces
- Shareable video, friends' leaderboards, Free Build
- Fetching new puzzles without an app update

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `topple` |
| App identifier | `<your reverse domain>.topple` (to be supplied) |
| Display name | `Topple`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
topple/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      chain/      puzzle model, chain calculation, solver      (no drawing code)
      puzzles/    puzzle files: daily/, packs/
      game/       attempts, results, daily schedule, streaks, hints
      render/     Three.js scene, dominoes, camera, effects
      input/      drag and drop, tap
      audio/      sound, music, haptics
      state/      save data, settings
      ui/         menus and overlays
    tools/
      editor/     browser-based puzzle editor
      report/     solver report for every puzzle
    tests/
```

`chain/` must not import anything from `render/`. The solver and tests use it without a screen.

## 5. Puzzle model

### 5.1 Slots and links

A puzzle is not a free arrangement of dominoes. It is a set of **slots** joined by **links**.

| Term | Meaning |
|---|---|
| **Slot** | A fixed position where a domino can stand, with a fixed facing. |
| **Link** | "If the piece in slot A falls, it strikes slot B." Each link has a reach of 1 or 2. |
| **Gap** | A slot that starts empty and can be filled by the player. |
| **Tray** | The pieces the player is given. |
| **Start** | The slot the player taps to begin. |
| **Flag** | The slot that must fall to win. |

A straight or curved run is a line of slots, each linked to the next with reach 1. Every slot is also linked to the slot two places ahead with reach 2, which only a tall domino can use.

### 5.2 Pieces and features in v1

| Element | Rule |
|---|---|
| **Standard domino** | When it falls, it strikes along its reach-1 links only. |
| **Tall domino** | When it falls, it strikes along its reach-1 links. For any reach-1 link whose target slot is empty, it strikes along the matching reach-2 link instead. It therefore bridges one empty slot. |
| **Fork** | A slot with two or more reach-1 links. One falling domino starts two branches. A fork is a shape, not a special piece. |
| **Ramp and ball** | A fixed feature with a trigger slot and a target slot. When the trigger slot's domino falls, a ball is released and strikes the target slot after the ramp's travel time. |

### 5.3 Puzzle file

```json
{
  "id": "daily-0142",
  "difficulty": 4,
  "board": { "width": 9, "height": 14 },
  "slots": [
    { "id": 0, "x": 1.0, "y": 1.0, "facing": 90, "holds": "standard" },
    { "id": 7, "x": 4.5, "y": 1.0, "facing": 90, "holds": "gap" }
  ],
  "links": [ { "from": 0, "to": 1, "reach": 1 }, { "from": 0, "to": 2, "reach": 2 } ],
  "ramps": [ { "trigger": 18, "target": 31, "travelMs": 900, "path": [[5,4],[5,9]] } ],
  "start": 0,
  "flag": 46,
  "tray": ["standard", "standard", "standard"],
  "par": 2
}
```

The editor writes `links` automatically from the drawn runs, and the solver writes `par` and `difficulty`.

### 5.4 Limits

| Item | Limit |
|---|---|
| Board | 9 × 14 units, portrait |
| Slots | Up to 150 |
| Gaps | 4 to 12 |
| Tray | 3 pieces. Always three; from the pack onwards one may be a tall domino. |

## 6. Chain calculation

### 6.1 Rules

The chain is worked out as a list of timed events, in whole milliseconds.

```
calculate(puzzle, placement):
    standing = every slot holding a piece (pre-placed, or placed by the player)
    events   = [ (time 0, start slot) ]
    fallen   = []
    while events is not empty:
        take the earliest event (time t, slot s)             ties broken by lower slot id
        if s is not standing:  continue
        mark s fallen at time t;  remove from standing;  depth[s] = steps from the start
        for each reach-1 link from s to b:
            if b holds a piece:
                add event (t + delay(depth[s]), b)
            else if the piece in s is tall, and a reach-2 link exists past b to c, and c holds a piece:
                add event (t + delay(depth[s]) + 40, c)
        if s is a ramp's trigger:
            add event (t + ramp.travelMs, ramp.target)
    return fallen (with times),  won = flag is in fallen
```

`delay(depth) = max(55, 100 − 1.5 × depth)` milliseconds, so the clacks quicken as the chain runs.

Because the result depends only on the puzzle and the placement, it is identical on every device.

### 6.2 Where the chain stopped

When the chain does not reach the flag, the **stopping points** are the fallen slots that struck nothing: every link from them led to an empty slot or to nothing at all. These are what the camera lingers on and what is circled on screen. A stopping point directly before a gap is the "near miss" that tells the player where the chain broke.

### 6.3 Solver

The number of ways to place three pieces among at most twelve gaps is small (under 2,000), so the solver simply tries all of them.

For each puzzle it reports:

| Measure | Meaning |
|---|---|
| **Solvable** | At least one placement wins. |
| **Par** | The fewest pieces in any winning placement. |
| **Winning placements** | How many distinct placements win, and how many of those use par pieces. |
| **Decoy gaps** | Gaps that appear in no par solution. |
| **Essential gaps** | Gaps that appear in every winning placement. |
| **Needs tall / needs ball** | Whether every solution depends on the tall domino or the ramp. |
| **Solution share** | Winning placements ÷ all placements. Lower is harder. |

**A puzzle is accepted only if:**

1. It is solvable with the tray.
2. It cannot be won with no pieces placed.
3. It has at least one decoy gap.
4. Its par solution is unique, so there is one "best" answer to find.
5. No piece in the tray is useless: each kind of piece supplied appears in at least one winning placement.

### 6.4 Difficulty

Each puzzle receives a difficulty from 1 to 7 from its measures: more gaps, more decoys, more branches, a lower solution share, and timing between a ball and a branch all raise it. The exact weighting is a tuning table in the report tool, adjusted once real solve rates are known. The designer may override the number.

## 7. Par (player setting)

Setting name: **"Show par before solving"**. Default: **Off**.

| | Off (default) | On |
|---|---|---|
| While solving | Par is not shown anywhere. | "Par: 2 dominoes" appears beside the tray from the start. |
| After solving | Par is revealed on the result screen, with whether the player matched it. | The same. |

Rules:

- The setting applies to the Daily Topple, the Archive and packs alike.
- It can be changed from Settings or the pause menu and takes effect immediately, including on the puzzle in progress.
- It has **no effect on results, streaks, tokens or the gold mark**. It changes only what the player is told in advance.
- The shared result (section 8.4) always states par, because it is sent after solving.
- Until the puzzle is solved, par is also kept out of the hint text and the failure screen, so that it cannot be learned by accident with the setting off.

Off is the default because discovering that a puzzle could be done with fewer dominoes is part of the reward, and a reason to replay it from the Archive.

## 8. Play

### 8.1 Flow of a puzzle

1. **Planning.** The whole run is shown from a fixed camera. Gaps are faint outlines. The tray holds three pieces.
2. **Placing.** Drag a piece from the tray to a gap; it snaps in when released within 0.6 units of the gap. Tap a placed piece to return it to the tray. Pieces may be left in the tray.
3. **Toppling.** Tap the start domino, which pulses gently once at least one piece is placed. This counts as one **topple**.
4. **Outcome.**
   - *Won:* the flag falls, the flourish plays, and the result screen appears.
   - *Not won:* the camera holds on the stopping points for 1.5 seconds, the run stands itself back up over 0.6 seconds with the player's pieces still in place, and planning resumes.

Attempts are unlimited. There is no timer.

### 8.2 Result

| Recorded | Meaning |
|---|---|
| **Topples** | How many times the start domino was tapped, including the winning one. |
| **Dominoes used** | Pieces placed in the winning attempt. |
| **Gold mark** | Dominoes used equals par. (It may be earned on any topple, and later from the Archive.) |
| **Hint used** | Yes or no. |

### 8.3 Hint

- One hint per puzzle, costing 20 tokens.
- It marks one gap, chosen by the solver, as either **essential** (glows gold) or a **decoy** (crossed out), whichever the player asks for.
- Using a hint does not break a streak. It is recorded and shown in the shared result.

### 8.4 Shared result

Plain text, sent through the phone's share sheet or copied:

```
Topple #142
Solved on the 2nd topple with 2 dominoes (par 2) ★
```

The star appears only with the gold mark. "with a hint" is added when one was used. The text never reveals which gaps were filled.

## 9. Modes and schedule

### 9.1 Daily Topple

- **Puzzle number** = days since the launch date + 1, using the device's local date. Everyone gets the same puzzle on the same date.
- **Difficulty by weekday:** Monday uses difficulty 1, rising to 7 on Sunday. The 120 bundled puzzles are arranged in that order when the app is built.
- **Monthly special:** the puzzle on the last day of each month is a large run of 120 to 150 dominoes with a long payoff. It is scheduled regardless of weekday.
- Known limitation: a player can change the device date to see a future puzzle. This is accepted in v1.

### 9.2 Streaks

- The streak counts consecutive days on which the daily puzzle was solved on its own date.
- **Streak protection:** one missed day in each calendar month is forgiven automatically. The calendar shows it with a small shield.
- Solving an old puzzle from the Archive does not repair a streak.

### 9.3 Archive

- Every daily puzzle from number 1 to today, in a calendar view.
- Each day is coloured by result: gold (matched par), green (first topple), amber (second or third), grey (four or more), blank (unplayed).
- Any puzzle can be replayed. Replays can earn the gold mark but do not change the day's original record of topples.

### 9.4 Pack 1: "First Tricks"

| Puzzles | Introduces | Tray |
|---|---|---|
| 1–6 | Gaps, decoys, forks | 3 standard |
| 7–16 | Tall domino | 2 standard, 1 tall |
| 17–24 | Ramp and ball | 3 standard |
| 25–30 | Everything together | 2 standard, 1 tall |

Each new element first appears in a puzzle with one obvious use for it. Pack puzzles unlock in order.

### 9.5 Tokens and styles

| Earned by | Tokens |
|---|---|
| Solving the daily puzzle | 10 |
| Gold mark on the daily puzzle | +5 |
| Solving a pack puzzle (first time) | 5 |
| Each 7-day streak milestone | 20 |

Domino styles (wood, ivory, neon, sweets) cost 100 to 300 tokens; the second table surface costs 150. Styles are cosmetic and never change the puzzle.

## 10. Drawing and camera

| Aspect | Specification |
|---|---|
| **Dominoes** | Chunky, slightly rounded, bold primary colours. The start domino carries an arrow; the flag domino carries a small flag. The player's pieces are a distinct colour so they are easy to find. |
| **Gaps** | A faint outline of a domino on the table. When a piece is dragged near, the outline brightens. |
| **Falling** | Each domino rotates about its base edge over 180 milliseconds and comes to rest leaning on the next, or flat if nothing is there. The motion is animation driven by the event times from section 6. |
| **Planning camera** | Fixed, about 55 degrees above the table, showing the whole board. |
| **Topple camera** | Glides to follow the leading edge of the chain. When the chain forks, it follows the branch nearest the flag, widening to keep other active branches in view where possible. |
| **Ending** | On a win, the camera pulls back to show the whole fallen run, then the flourish plays (a flag raised and confetti). |
| **Stopping points** | Circled softly; the last domino wobbles. |
| **Performance** | 60 frames per second with 150 dominoes on the minimum phones. |

With "Reduce motion" on, the camera stays in the planning position during the topple.

## 11. Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Piece picked up | Lifts, casts a shadow | Soft wooden lift | Light tick |
| Piece snaps into a gap | Settles with a small bounce | Click | Light pulse |
| Each domino falls | Falls | Clack; pitch varied slightly per domino | Light tick per clack, merging into a ripple as they quicken |
| Tall domino bridges | Longer fall | Deeper clack | Slightly stronger tick |
| Ball released / strikes | Ball rolls down the ramp | Rolling, then a knock | Pulse on the strike |
| Chain stops short | Stopping points circled | Clacks stop; a held silence | Single soft pulse |
| Flag falls | Flourish | Final clack, then a short fanfare | Firm pulse |

There is no music during the topple. Quiet music plays while planning. Because the ripple of vibration follows the clacks exactly, the payoff still lands with the sound off.

## 12. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on a short straight run with one gap and one domino in the tray. Then a second puzzle with two gaps and one domino, where one gap is on a dead-end branch. Then today's Daily Topple. No menu until these are done. |
| **Home** | Today's puzzle (number, weekday, solved or not), Archive, Pack, Styles, Statistics, Settings. Shows current streak and tokens. |
| **Puzzle** | Board fills the screen. Tray at the bottom centre. Top: puzzle number, topple count, pause. Hint button bottom left. Par beside the tray only if the setting is on. |
| **Result** | Topples, dominoes used, par (now revealed), gold mark, tokens, streak. Buttons: Share, Replay, Home. |
| **Archive** | Calendar by month. |
| **Statistics** | Played, solved, current and longest streak, bar chart of solves by topple number, gold marks. |
| **Settings / Pause** | See section 13. |

Layout rules: the tray pieces are at least 56 points wide and sit within easy thumb reach; a dragged piece is drawn above the finger so the thumb does not hide the gap; safe areas are respected.

## 13. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Show par before solving | On / Off | Off |
| Music, sound effects, vibration | On / Off each | On |
| Daily reminder notification | On / Off, with time | Off |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document after every topple: settings; tokens; styles owned and selected; for each daily puzzle played, the date solved, topples, dominoes used, gold mark and hint used; pack progress; streak, longest streak and protection used this month; and the puzzle in progress with its current placement and topple count. A `version` number allows later builds to convert older saves. No personal data is collected and nothing leaves the device.

## 14. Development tools

### 14.1 Puzzle editor

A browser page, for the developer only, that:

- draws runs as lines and curves on the board, placing slots automatically at standard spacing
- joins runs into forks and adds ramps
- marks slots as gaps, start and flag, and sets the tray
- runs the solver continuously, showing par, decoys and whether the puzzle is acceptable
- plays the puzzle with the same chain calculation as the game
- saves and loads puzzle files

### 14.2 Report

A script that runs the solver over every puzzle and writes a table of all measures, flags any puzzle that fails section 6.3, and arranges the daily puzzles into weekday order. Its output is committed with the puzzles, and the app build fails if any puzzle is unacceptable.

## 15. Testing

**Chain calculation and solver (automated)**

- A straight run with no gaps falls completely; with one gap it stops at the gap.
- A tall domino bridges exactly one empty slot, and not two.
- A fork starts both branches.
- A ball strikes its target at the stated time, and has no effect if the target has already fallen.
- The same puzzle and placement always give the same events in the same order.
- Stopping points are reported correctly for a chain that ends at a gap, at a dead end and at both.
- The solver's par agrees with hand-worked examples.
- Every bundled puzzle passes section 6.3.

**Rules (automated)**

- With "Show par" off, par appears in no text or screen before the puzzle is solved.
- The setting does not change topples, the gold mark, tokens or streak.
- The streak survives one missed day per calendar month and breaks on the second.
- Puzzle number and weekday difficulty follow from the date.
- A save written mid-puzzle loads back to an identical state.

**Acceptance criteria for v1**

1. A new player topples their first chain within 15 seconds of launch.
2. The same puzzle falls identically on every test phone.
3. Changing the par setting takes effect at once on the puzzle in progress.
4. The game is fully playable with sound and vibration off.
5. The game works in aeroplane mode.
6. Closing the app mid-puzzle loses nothing.
7. 60 frames per second during a 150-domino topple on the minimum phones.

## 16. Build order

| Stage | Deliverable | Purpose |
|---|---|---|
| 1 | Puzzle model, chain calculation, solver; tests | Proves the rules with no graphics. |
| 2 | Puzzle editor with live solver | Needed before real puzzles can be made. |
| 3 | Playable prototype in a browser with simple blocks: place, topple, fail, retry | **Proves the puzzle is fun** and that the fall reads clearly. |
| 4 | Three.js dominoes, fall animation, camera, sound and haptic ripple | Proves the payoff. |
| 5 | Tall domino, forks, ramp and ball | |
| 6 | Daily schedule, streaks, Archive, results, sharing, par setting, hint | |
| 7 | 120 daily puzzles and the 30-puzzle pack | The largest task. |
| 8 | Styles, statistics, polish | |
| 9 | Android and iOS packaging | |

## 17. Risks

| Risk | Mitigation |
|---|---|
| **150 hand-made puzzles.** Daily puzzles are the game, and each must be good. | The editor and live solver make each puzzle quick to build and prove. Stage 7 can run alongside stages 4 to 6. A generator that proposes candidate puzzles for a person to choose from is a sensible later addition. |
| **Puzzles too easy.** With three pieces and few gaps, some may be solved at a glance. | The solver's solution share and decoy count are checked for every puzzle; weekday difficulty sets expectations. |
| **Running out of daily puzzles.** | 120 are bundled; the app warns the developer at build time how many days remain, and replays early puzzles as a fallback. |
| **Only one puzzle a day for a keen new player.** | The Archive and the pack are available from day one. |
| **The fall looks mechanical because it is animated, not simulated.** | Slight variation in each domino's timing and resting angle, drawn from the puzzle's seed, with good sound. The result is unchanged; only the look varies. |

## 18. Open questions

1. Are the remaining assumptions acceptable, in particular fixed-facing pieces (A4)? (A3, bundled daily puzzles, is confirmed.)
2. What is the app identifier (reverse domain)?
3. What is the launch date, from which puzzles are numbered?
4. Should a hint be recorded in the shared result, as specified?
5. Should the Archive be entirely free, as specified?
