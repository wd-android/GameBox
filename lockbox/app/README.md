# Lockbox – v1

A puzzle game for iOS and Android about opening locked chests. It is built from
[`../build-specification.md`](../build-specification.md) and the guidance in
[`../../mobile-game-report.md`](../../mobile-game-report.md). The screens follow
the supplied *Battle Game Apps UI Kit* Figma file: deep violet cards with a soft
glow, glowing cyan pill buttons, and Readex Pro type. The locks themselves are
drawn in brass, wood and glass so they stand out against the violet.

Open chests by opening their locks:

- **Digit padlock.** Drag a wheel up or down, then tap the shackle or Try.
- **Coloured bottles.** Drag one bottle onto another to swap them, then pull the lever.
- **Concentric rings.** Drag a ring round the centre until the picture is whole.
- **Sliding bolts.** Drag bolts along their length until the brass latch can slide out to the right.

Each lock comes in up to three information levels:

- **Shown:** the answer is written on the chest.
- **Clued:** a set of clue cards that leads to exactly one answer.
- **By feel:** feedback after each try.

Chests hold coins and trinkets. Trinkets fill the Vault and complete sets.

## Running it

```bash
npm install
```

```bash
npm run dev          # play in a browser at http://localhost:5173
```

```bash
npm test             # generators, solvers, fairness and rules (27 tests)
```

```bash
npm run build        # type-check and build to dist/
```

Content tools (both deterministic):

```bash
npm run calibrate    # plays 1,000 puzzles per lock, size and feedback option; writes src/locks/par.json
```

```bash
npm run chests       # writes the fixed chest list for both chapters to src/chest/chapters.json
```

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
currently the placeholder `com.example.lockbox` (spec §18, question 2).

Icons and splash screens come from `assets/icon.svg`. They were generated with
`npx @capacitor/assets generate`.

## Layout (as §4)

```
src/
  config/   app.ts (name, id, save key), tuning.ts (every tuning constant)
  locks/    the framework (types.ts, rng.ts, par.ts, reference.ts) and one folder per lock type:
            padlock/ bottles/ rings/ bolts/ – generator, solver, rules. No UI code.
  chest/    chests, rewards, the Daily Safe, trinket sets, chapters.json
  game/     rules.ts (modes, limits, stars, ranks), session.ts (a chest being opened), progress.ts
  state/    save.ts – one JSON document, versioned
  audio/    sound.ts (synthesised, no audio files), haptics.ts
  ui/       store, flow, screens/, locks/ (one view per lock type), styles
tools/      calibrate.ts, chapters.ts
tests/      locks.test.ts, rules.test.ts
```

## How the spec is met

**Fairness (§5.2)**

- Every puzzle is generated from a seed with mulberry32 and checked by a solver before it is shown.
- Clued padlocks and clued bottles must have exactly one answer.
- They must also be solvable by a deduction solver within the chapter's depth limit. The limit is `DEDUCTION_DEPTH`: chapter 1 allows no "suppose" steps, chapter 2 allows one.
- Every clue must be needed, and none may give the answer away on its own.
- For rings and bolts, a breadth-first search records the true shortest solution.
- The tests check all of this over many seeds, for every lock, size and level.

**Par (§8.3)**

- Par comes from `tools/calibrate.ts`. A reference solver always tries a random code that is still possible.
- Par is the median number of tries plus one, over 1,000 puzzles.
- The results are committed in `src/locks/par.json` and `tools/calibration.txt`.
- "Which" gives par of 6 for a 4-wheel padlock, against 7 for "How many". The setting never makes three stars automatic.

**Modes, limits and stars (§8)**

- Relaxed mode uses the player's feedback setting.
- Locksmith mode and the Daily Safe always use "How many". This is tested.
- In Locksmith mode, going over the limit jams the lock. "Try a fresh chest" then generates new puzzles of the same difficulty, from the next retry seed.
- A chest's stars are its lowest lock's stars.
- Relaxed stars are silver and Locksmith stars are gold. Only gold stars count towards rank.

**Chests (§9)**

- `tools/chapters.ts` writes both chapters from the §9.3 progression tables, with fixed seeds.
- Every new lock type and information level first appears alone, on a single-lock chest.
- Rewards come from the chest's seed. Replays pay one fifth of the coins.
- The Daily Safe takes its seed from the date and has two locks of different types.

**Hints (§10)**

- Nudge costs 30 coins and Clue costs 20.
- Each lock allows two hints, and using one caps that lock at two stars.
- Hints are not available in the Daily Safe.
- A Clue always narrows the remaining possibilities by at least a quarter. This is tested.

**Screens (§12)**

- On first launch the game opens straight onto chest 1, a 3-wheel padlock with the code chalked on it. There is no menu, so the first wheel turn comes within seconds.
- The Home screen appears after three chests.
- On the lock screen, the lock takes the upper part and a fixed lower third holds Try, the hints, tries left and the history. The lock never shifts while it is being worked.
- Touch targets are at least 56 points, and clue text is at least 16 points.
- Tapping a clue card enlarges it.

**Accessibility (§13, acceptance 4)**

- Every sound has a visual equivalent.
- Correct parts show a tick as well as a green glow.
- Bottles differ in shape and carry a suit symbol as well as a colour. The Settings toggle turns the symbols off.
- With "Reduce motion" on, rattles and rises become fades.

**Saving (§14)**

- The whole state is written after every move, including the chest in progress with each lock's state and try history.
- Reopening the app resumes exactly where it stopped. This was checked in a browser by reloading mid-chest.
- Nothing leaves the device, and the game needs no network.

## Checked in a browser

These checks used Playwright against `vite preview` at 390 × 844. The `?debug`
URL flag exposes the store for automation and has no effect in the apps.

- First launch: set the chalked code with the wheels, tap the shackle, see the opening.
- A three-lock chapter 2 chest (bolts, rings, bottles), opened lock by lock. The test reloads the page mid-chest and confirms the state is unchanged.
- Locksmith: three wrong tries jam a clued padlock, and "Try a fresh chest" gives a new puzzle.
- Locksmith feedback is "How many" while the setting is "Which".
- Daily Safe: opened, the share text reads "Lockbox Daily 15 Nov – opened in 4 tries.", and Home then shows the result.
- Drag to swap bottles, drag rings round the centre, and the Nudge highlight on bolts.

## Decisions and deviations

- **Strings.** §4 lists `config/strings.ts`. The UI text is short and lives next to each screen instead. It can be moved out when the game is localised.
- **Ring and bolt "tries" in the Daily Safe.** The daily result counts padlock and bottle tries plus ring turns and bolt slides, so a single number can be shared.
- **Two-dimensional artwork (A1).** Locks, chests, trinkets and the icon are drawn in SVG and CSS. There are no bitmap assets apart from the generated icons.
- **Music** is a quiet synthesised music-box loop. Sound effects are synthesised with Web Audio, so there are no audio files.
- **Ring linkages** in Clued mode appear as small gears on the dial and as clue cards that name the rings. Rings are numbered from the centre on a fixed scale.
- **Frame-rate and generation-time targets** on the minimum phone could not be measured here, because there is no device and no GPU. On this machine, generation averages well under 200 ms per lock, and the slowest case (a 5-wheel clued padlock) takes about 54 ms.
- **Open questions (§18)** are left as specified: the default feedback is "Which", only Locksmith stars count towards rank, and the chapters are the Attic and the Ship's Hold.
