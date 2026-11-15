# Oddness – Build Specification

*15 November 2026 · Version 0.1 · Based on the [concept design](../concepts/07-oddness.md)*

This document specifies the first playable release (v1) in enough detail to build from. Where the concept design gave a range, this document fixes a value. Every such value is a tuning constant held in one configuration file, to be adjusted after playtesting.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Oddness" is a **working title**. It is used for the package name and all internal identifiers. The display name is read from one configuration value so it can change without touching code. |
| Wrong-answer reveal | A **player setting** (section 6.4), not a fixed rule. |
| Vanishing mode | Belonging objects vanish one at a time; the odd object never vanishes. |

## 2. Assumptions to confirm

These are my choices where nothing has been decided yet. Each can be changed before work starts; changing them later is costly.

| # | Assumption | Reason |
|---|---|---|
| A1 | **Platform:** Android and iOS phones, portrait only. Tablets supported by scaling, not by a separate layout. | Matches the concept. |
| A2 | **Technology (confirmed 15 November 2026):** TypeScript, built with Vite, user interface in React, packaged for the stores with Capacitor. | One codebase for both iOS and Android, runs in a desktop browser for fast testing, and needs no game engine: the game is taps, grids and short animations. The Android app can be built on Windows. The iOS app must be built and submitted from a Mac running Xcode, or through a cloud build service; this applies to any iOS technology. |
| A3 | **No server in v1.** Everything runs on the device. The Daily Scene is derived from the date, so all players get the same one without a server. | Removes hosting, accounts and privacy work from the first release. Leaderboards wait for v2. |
| A4 | **No adverts or purchases in v1.** Hints are bought with coins earned in play. The code leaves a single interface where rewarded adverts plug in later. | Lets the game be tested for fun before monetisation is tuned. |
| A5 | **Artwork:** objects are shown as images, one per object, 256 × 256 px with transparent background. Until artwork exists, the build shows each object as a labelled tile. | The content database currently holds object names only. Artwork is the largest outstanding cost (section 12). |

## 3. Scope of v1

**Included**

- Classic mode and Vanishing mode
- Daily Scene, with streak
- Three content packs
- Hints (Narrow and Clue)
- Sticker album
- Settings, including wrong-answer reveal
- Local save of all progress
- Sound, music and haptics, each switchable

**Not included (planned for later)**

- Blitz, Two of a Kind, pass and play
- Leaderboards, accounts, sharing beyond a plain text result
- Adverts and purchases
- Weekly events
- Languages other than English (all text is held in one strings file so translation can follow)

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `oddness` |
| App identifier | `<your reverse domain>.oddness` (to be supplied) |
| Display name | `Oddness`, from `config/app.ts` |
| Minimum Android | 8.0 (API 26) |
| Minimum iOS | 15 |
| Install size target | Under 80 MB with three packs |

```
oddness/
  build.py                 existing content builder (extended, section 11)
  oddness.db               content database (source of truth for content)
  data/                    content source text files
  app/
    src/
      config/              app.ts, tuning.ts, strings.ts
      content/             pack loading, types
      game/                round generator, scoring, modes (no UI code)
      state/               save data, settings, progress
      ui/                  screens and components
      audio/               sound, music, haptics
    public/packs/          exported pack files and object images
    tests/
```

The `game/` folder must contain no user-interface code. All rules in sections 6 to 8 live there as pure functions, so they can be tested without a device.

## 5. Content model

### 5.1 Source

The content database `oddness.db` already holds:

| Table | Contents |
|---|---|
| `Category` | 100 categories. **One category is one pack** in the game. |
| `Scene` | 50 scenes per category. |
| `Object` | Each object once, by name. |
| `Fit` | Maps objects to scenes: `Fits = 1` (belongs) or `0` (does not belong). |

### 5.2 Additions needed

| Table | New column | Purpose |
|---|---|---|
| `Object` | `Image` (text) | File name of the object's image. Empty until artwork exists. |
| `Fit` | `Closeness` (1–3, ill-fitting rows only) | 1 = obviously foreign, 2 = plausible, 3 = near miss. Drives difficulty. Defaults to 1. |
| `Fit` | `Reason` (text, ill-fitting rows only) | The caption shown when the odd object is found, e.g. "A microscope is for tiny things; a telescope is for distant ones." |
| `Scene` | `Backdrop` (text) | File name of the backdrop image. Optional. |
| `Category` | `Released` (0 or 1) | Whether the pack ships in the build. |

If `Reason` is empty, the caption falls back to: *"{Object} doesn't belong in: {Scene}."*

### 5.3 How this differs from the concept design

The concept design proposed generating scenes from tagged objects. The content work since then produced something simpler and safer: each scene lists the objects that fit it and the objects that do not. The build uses these lists directly. Because every ill-fitting object has been chosen for that scene specifically, the ambiguity check in the concept design is not needed at run time.

### 5.4 Pack file

`build.py` exports one JSON file per released pack to `app/public/packs/`:

```json
{
  "id": 69,
  "name": "Jobs and Workplaces",
  "note": "Learn the tools and equipment of different jobs.",
  "scenes": [
    {
      "id": 3401,
      "name": "Observatory",
      "backdrop": "",
      "fit": [ { "id": 812, "name": "Telescope", "image": "" } ],
      "ill": [ { "id": 97, "name": "Microscope", "image": "", "closeness": 3, "reason": "" } ]
    }
  ]
}
```

A scene is exported only if it has at least 29 fitting objects and at least 5 ill-fitting objects, the minimum needed for the largest round.

### 5.5 Content required for v1

| Item | Needed | Exists now |
|---|---|---|
| Packs with object lists | 3 | 1 (Jobs and Workplaces) |
| Object images | About 1,900 for the one existing pack | 0 |

See section 12: this is the main risk to the schedule.

## 6. Game rules

### 6.1 Round

A **round** is one scene shown to the player. It consists of:

- one scene from the active pack
- *N* – 1 objects drawn at random from the scene's fitting list
- 1 object drawn from the scene's ill-fitting list (the **odd object**)
- all *N* objects placed in random positions on a grid

### 6.2 Round generation

```
generateRound(pack, stage, recentSceneIds, random):
  1. scene   = random scene from pack, excluding recentSceneIds (last 10 played)
  2. N       = object count for this stage (6.3), chosen at random within its range
  3. odd     = random ill-fitting object whose closeness is allowed at this stage
               (if none qualify, use any ill-fitting object)
  4. others  = N - 1 distinct random fitting objects
  5. layout  = shuffle(others + odd) into the grid for N
  6. return { scene, objects, oddId, layout }
```

`random` is a seeded generator passed in, never the system random function. This makes rounds reproducible for testing and for the Daily Scene.

### 6.3 Stages

A **run** is ten rounds. Completing a run with at least one life left completes a **level**. The level number sets the stage.

| Stage | Levels | Objects (*N*) | Grid (columns × rows) | Closeness allowed |
|---|---|---|---|---|
| 1 | 1–10 | 5 | 3 + 2 (centred) | 1 |
| 2 | 11–30 | 9 or 12 | 3 × 3, 3 × 4 | 1–2 |
| 3 | 31–70 | 16 or 20 | 4 × 4, 4 × 5 | 1–3 |
| 4 | 71+ | 25 or 30 | 5 × 5, 5 × 6 | 2–3 |

In every run, rounds 3 and 8 use the previous stage's object count, to give an easier breather.

### 6.4 Wrong-answer reveal setting

Setting name: **"Show the answer after a wrong tap"**. Default: **On**.

| | On | Off |
|---|---|---|
| Wrong tap | Costs one life. The tapped object shakes and greys out. | Costs one life. The tapped object shakes and greys out. |
| Then | The odd object is highlighted and its caption shown. The round ends with no score. The player taps to continue. | The round continues. The player keeps trying until they find the odd object or run out of lives. |
| Score for the round | 0 | Base score only, halved for each wrong tap. No speed bonus. |
| Streak | Reset | Reset |
| Sticker | Not awarded | Awarded when found |

The setting applies to Classic and the Daily Scene. It has no effect in Vanishing mode, which has no wrong-tap penalty beyond a short lock-out (6.6). The default is On because the caption is where the learning happens.

### 6.5 Classic mode

- Ten rounds, untimed, three lives for the run.
- The run ends after round ten or when the last life is lost.
- **Stars:** three lives left = 3 stars, two = 2, one = 1. Losing all lives fails the run and the level is not completed.
- A failed run can be retried immediately. Scenes are drawn afresh.

### 6.6 Vanishing mode

Unlocked at level 10.

- Ten rounds, no lives.
- Every *T* seconds one belonging object is removed. *T* = 10 at stage 1, 8 at stage 2, 6 at stage 3, 5 at stage 4.
- The object to vanish is chosen at random, wobbles for 1 second, then fades over 0.3 seconds. Remaining objects do not move.
- Vanishing stops when 3 objects remain. The round then waits for the player.
- The odd object never vanishes.
- A wrong tap greys out that object and locks input for 1 second. It also counts as one vanished object for scoring.
- The round's score starts at 100% of base and falls by an equal share per vanished object, to a floor of 20%.

### 6.7 Daily Scene

- One round per calendar day (device local date), at stage 4 size (30 objects), drawn from all released packs.
- The random seed is the date as a number (for example 20261115), so every player sees the same scene, objects and layout.
- One attempt per day. The result records time taken and wrong taps.
- A streak counts consecutive days completed. Missing a day resets it.
- Result text can be copied: *"Oddness Daily 15 Nov – spotted in 6.2 s, no wrong taps."*
- Known limitation: a player can change the device date. This is accepted in v1, as there are no leaderboards.

### 6.8 Hints

| Hint | Effect | Cost |
|---|---|---|
| **Narrow** | Removes half of the remaining belonging objects (rounded down). | 30 coins |
| **Clue** | Shows the scene's pack note, e.g. "Think about the tools of this job." | 15 coins |

Each hint can be used once per round. Hints are not available in the Daily Scene. A round in which a hint was used earns no speed bonus.

### 6.9 Scoring

```
base        = 10 x N
speedBonus  = base x 0.5 x clamp((10 - secondsTaken) / 7, 0, 1)     full bonus within 3 s, none after 10 s
streakMult  = min(1 + 0.1 x streak, 2.0)                             streak = consecutive correct first taps
roundScore  = round((base + speedBonus) x streakMult)
coins       = floor(runScore / 100) + 5 x stars
```

### 6.10 Progress and unlocks

| Level reached | Unlocks |
|---|---|
| 1 | Classic, Daily Scene, first pack |
| 5 | Second pack |
| 10 | Vanishing mode |
| 15 | Third pack |

### 6.11 Sticker album

- Each pack has one album page per scene.
- Finding an odd object for the first time adds it to the page of the scene in which it was found.
- A scene's page is complete when 5 different odd objects have been found there. Completing a page awards 50 coins.

## 7. Screens

| Screen | Contents |
|---|---|
| **First launch** | Goes straight into a five-object round with one line of text: "Tap the odd one out." No menu. After three rounds, the Home screen appears. |
| **Home** | Play (continues Classic at the current level), Daily Scene, Modes, Packs, Album, Settings. Shows coins, level and daily streak. |
| **Round** | Scene name at top. Object grid in the upper two-thirds. Lives (Classic), vanish timer (Vanishing), score, and hint buttons in the lower third. Pause button top right. |
| **Caption overlay** | The odd object enlarged, its name, and the reason. Tap anywhere to continue. |
| **Run summary** | Stars, score, coins earned, new stickers. Buttons: Next, Retry, Home. |
| **Daily result** | Time, wrong taps, streak, Copy result. |
| **Packs** | List of packs with lock state and progress. Selects the active pack. |
| **Album** | Packs, then scenes, then collected stickers. Uncollected stickers shown as silhouettes. |
| **Settings** | See section 9. |
| **Pause** | Resume, Restart run, Home, sound toggles. |

Layout rules:

- Minimum touch target 56 × 56 points; objects are larger wherever the grid allows.
- All controls sit in the lower third of the screen.
- Safe areas (notches, home indicators) are respected.
- The object's name is shown beneath each tile while artwork is missing, and remains available afterwards as an accessibility setting.

## 8. Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Correct tap | Object scales to 130%, confetti burst, caption overlay | Bright ping; pitch rises one step per streak, up to 8 | Single light pulse |
| Wrong tap | Object shakes for 0.3 s, then greys | Soft dull tap | Double pulse |
| About to vanish | Object wobbles for 1 s | Quiet tick | None |
| Vanish | Fades over 0.3 s | Light pop | None |
| Life lost | Heart icon breaks | Low note | None |
| Run complete | Stars fill one by one | Short fanfare | One pulse per star |
| Sticker earned | Sticker flies to album icon | Chime | Light pulse |

All animations run at 60 frames per second on the minimum devices. With "Reduce motion" on, shakes, wobbles and confetti are replaced by simple fades.

## 9. Settings

| Setting | Values | Default |
|---|---|---|
| Show the answer after a wrong tap | On / Off | On |
| Music | On / Off | On |
| Sound effects | On / Off | On |
| Vibration | On / Off | On |
| Show object names | On / Off | On while artwork is missing, then Off |
| Reduce motion | On / Off | Follows the device setting |
| High-contrast outlines | On / Off | Off |
| Reset progress | Button, with confirmation | – |

The app respects the device's silent switch and does not interrupt audio already playing from another app.

## 10. Saved data

One JSON document in device storage, written after every round.

```json
{
  "version": 1,
  "settings": { "revealAnswer": true, "music": true, "sfx": true, "haptics": true,
                "showNames": true, "reduceMotion": null, "highContrast": false },
  "progress": { "level": 12, "coins": 340, "activePackId": 69, "unlockedPackIds": [69, 3] },
  "runInProgress": null,
  "stars": { "12": 3 },
  "daily": { "lastDate": "2026-11-15", "streak": 4, "bestStreak": 9,
             "history": { "2026-11-15": { "seconds": 6.2, "wrongTaps": 0 } } },
  "album": { "3401": [97, 455] },
  "recentSceneIds": [3401, 3388],
  "stats": { "roundsPlayed": 240, "correctFirstTap": 198, "bestStreak": 17 }
}
```

- `version` allows later builds to convert older saves.
- `runInProgress` holds the current run so a closed app resumes where it stopped.
- No personal data is collected and nothing leaves the device.

## 11. Content pipeline

`build.py` is extended to:

1. Add the columns in section 5.2 to the database.
2. Read optional `Reason` and `Closeness` values from the data files.
3. Export one JSON pack file per released category (section 5.4).
4. Check that every exported object with an `Image` value has a matching file, and list objects without one.
5. Fail the build if any released scene has fewer than 29 fitting or 5 ill-fitting objects.

Suggested data-file syntax for an ill-fitting object with a reason and closeness:

```
- Microscope {3: A microscope is for tiny things; a telescope is for distant ones.}
```

## 12. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| **Artwork volume.** The one finished pack alone uses about 1,900 distinct objects. | Artwork dominates cost and time. | Launch packs should reuse a smaller shared object set. Trimming each scene to its 25 most distinctive fitting objects and 8 ill-fitting ones cuts the count by more than half and still supports 25-object rounds. Build and test with labelled tiles first. |
| **Scene ambiguity.** Some scenes can plausibly contain almost anything (a film set, a recycling centre). | Players feel cheated. | Mark such scenes `Released = 0`. Add a "Report this scene" link in the caption overlay in v2. |
| **Missing reasons.** Only fallback captions exist today. | The learning element is weak. | Write reasons for closeness 2 and 3 objects first; closeness 1 can keep the fallback. |
| **Only one pack has objects.** | v1 needs three. | Choose the two further packs before artwork begins. |
| **Repetition.** With few packs, players see scenes repeat. | Early boredom. | The last 10 scenes are excluded; 50 scenes a pack gives 5 runs before any repeat. |

## 13. Testing and acceptance

**Automated tests (game logic)**

- A generated round has exactly *N* distinct objects, exactly one of them ill-fitting.
- The same seed always produces the same round.
- Scoring matches the formulas in 6.9 at the boundary values (0 s, 3 s, 10 s; streak 0, 10, 20).
- With reveal On, a wrong tap ends the round with zero score; with reveal Off, the round continues and the score halves per wrong tap.
- Vanishing never removes the odd object and never leaves fewer than 3 objects.
- The Daily Scene is identical for the same date and different on consecutive dates.
- A save written by the game loads back to an identical state.

**Acceptance criteria for v1**

1. A new player reaches their first round within 5 seconds of launch on a mid-range phone.
2. A full Classic run can be played, closed mid-run and resumed with no loss.
3. Changing the wrong-answer setting takes effect on the next round.
4. The game is fully playable with sound and vibration off.
5. The game works in aeroplane mode.
6. No round ever shows two ill-fitting objects or a repeated object.
7. Touch targets meet the 56-point minimum on a 360-point-wide screen at 30 objects.
8. Steady 60 frames per second during a 30-object Vanishing round on the minimum devices.

## 14. Build order

| Stage | Deliverable | Depends on |
|---|---|---|
| 1 | Game logic and tests: round generator, scoring, Classic rules, settings | Nothing |
| 2 | Pack export from `build.py` | Nothing |
| 3 | Playable Classic in a browser with labelled tiles | 1, 2 |
| 4 | Vanishing mode, hints, save and resume | 3 |
| 5 | Daily Scene, album, packs screen, settings screen | 4 |
| 6 | Sound, haptics, animation polish, accessibility options | 5 |
| 7 | Android and iOS packaging, device testing | 6 |
| 8 | Artwork integration, reasons, final content | Artwork delivery |

Stages 1 to 6 need no artwork, so the game can be played and tuned in full before any is commissioned.

## 15. Open questions

1. Are assumptions A1 to A5 acceptable, in particular the technology (A2) and no adverts in v1 (A4)?
2. What is the app identifier (reverse domain)?
3. Which two further packs should ship with Jobs and Workplaces?
4. Who will produce the object artwork, and in what style?
5. Should the default for "Show the answer after a wrong tap" be On, as specified here?
