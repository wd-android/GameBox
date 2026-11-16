# Lockbox – Concept Design

*15 November 2026 · Concept 9 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Every level is a locked chest. Work out its locks, open it, and keep what is inside. |
| **Genre** | Logic puzzle collection |
| **Audience** | Adult puzzle players; fans of escape rooms, codes and brain-teasers |
| **Orientation** | Portrait, one thumb |
| **Session** | One to two minutes per lock; multi-lock chests save after each lock |
| **Works offline** | Yes, apart from the daily safe leaderboard |

## 2. Core gameplay

1. A chest appears with one or more locks on it.
2. The player taps a lock to bring it full-screen.
3. They turn, slide or rearrange its parts, using clues on the chest or feedback from each attempt.
4. When every lock is solved, the chest opens and reveals a reward.

Every lock must be solvable by reasoning. No lock should require blind guessing, and each generated puzzle must have exactly one solution.

## 3. Lock types

| Type | How it is solved | Skill |
|---|---|---|
| **Digit padlock** | Three to five wheels. Clues such as "one digit is right and in the right place". | Deduction |
| **Coloured bottles** | Arrange bottles in a hidden order; after each try, the game says how many are in the right place. | Deduction from feedback |
| **Concentric rings** | Rotate rings until a broken picture lines up; turning one ring may drag another. | Spatial |
| **Sliding bolts** | Slide interlocking bars in the right sequence to free the latch. | Planning |
| **Directional lock** | Enter a sequence of up, down, left and right read from a pattern on the chest. | Observation |
| **Switches** | Each switch flips several lights; turn them all on. | Logic |
| **Safe dial** | Turn left and right to numbers deduced from clues. | Deduction |
| **Word lock** | Letter rings spell a word answering a riddle or picture clue. | Vocabulary |
| **Key matching** | Choose or assemble the key whose teeth fit the lock's outline. | Observation |
| **Pin tumblers** | Raise each pin to the right height, guided by sound, vibration and a visual cue. | Touch and timing |
| **Weights and scales** | Place weights so the scales balance. | Arithmetic |
| **Sliding tiles and swaps** | Rearrange tiles, books, gems or jars into a pattern or order. | Planning |

The first six are recommended for launch. They cover deduction, spatial reasoning, planning and observation, and none needs written language, which keeps translation simple.

## 4. Difficulty

Difficulty is set by two controls.

**Observable information**

| Level | Meaning | Example (digit padlock) |
|---|---|---|
| **Full** | The answer is visible somewhere on the chest. | The code is scratched on the lid. |
| **Clued** | Hints must be combined. | Three clue lines, each about a different guess. |
| **Feedback only** | The player learns only from the result of each attempt. | After each try: "one right, one misplaced". |

**Number of parts:** from three wheels, bottles, rings or bolts up to eight or more.

**Example ladder for the bottle lock:**

| Chest | Bottles | Information | Attempts allowed (Locksmith mode) |
|---|---|---|---|
| Early | 3 | Full – order shown on a shelf label | Unlimited |
| Mid | 4 | Clued – "Blue is not at either end" | 6 |
| Late | 5–6 | Feedback only – number correctly placed | 8 |
| Expert | 7–8 | Feedback only, with two bottles of the same colour | 10 |

**Chest structure also escalates:**

- **Single lock** – early chests.
- **Several independent locks** – solved in any order.
- **Chained locks** – solving one reveals the clue for the next. This is where the game feels most like an escape room.

## 5. Modes

| Mode | Rules |
|---|---|
| **Relaxed** | Unlimited attempts, no timer. The default. |
| **Locksmith** | Limited attempts; more stars for using fewer. |
| **Heist** | A run of five chests against the clock. Unlocks later. |
| **Daily Safe** | One chest a day, the same for everyone. |
| **Workshop** | Practise any lock type at any difficulty. |

## 6. Scoring and rewards

- **Stars** (one to three) per chest, based on attempts used.
- **Chest contents**, revealed with a flourish on opening: coins, a key design, a trinket for the collection, or occasionally a rare item. The contents are a surprise, so the theme itself supplies the variable reward described in the report.
- **Chest tiers** – wooden, iron, silver, gold – with better contents for harder chests.

**Hints** (cost coins, or earned by choosing to watch an advert):

- *Nudge* – confirms one part as correct.
- *Clue* – adds one more clue line.
- *Skip* – solves one lock of a multi-lock chest.

## 7. Long-term layer

- **The vault:** a room that fills with opened chests and collected trinkets, arranged by the player.
- **Locksmith ranks:** Apprentice, Journeyman, Locksmith, Safecracker, Master, earned through stars.
- **Trinket sets:** themed collections (coins of the world, old keys, gemstones); completing a set grants a reward.
- **Chapters:** 30 to 40 chests each, with a setting such as an attic, a ship's hold, a bank or a tomb. Each chapter introduces one new lock type.

## 8. Daily and live features

- **Daily Safe** with a streak and a shareable result ("Opened in four attempts").
- **Weekly event:** a themed hoard, for example a pirate's hoard, with its own chest style and trinket set.
- **Daily reward:** a small free chest.

## 9. Social

- Small-group leaderboards for the Daily Safe and Heist.
- **Send a locked chest:** a player sets a code on a simple lock, writes a clue and sends it to a friend. This is a later feature, but it is cheap to build and spreads the game.

## 10. Monetisation

- Opt-in rewarded adverts for hints or a second chest reward.
- A single purchase to remove interstitial adverts.
- Optional cosmetic packs (chest styles, vault decorations) and extra chapters.

## 11. Visual direction

- **Materials:** brass, dark wood, leather and coloured glass in a bright, slightly stylised 3D look. Objects should look as though they could be picked up.
- **Framing:** one lock at a time fills the screen, with large moving parts well inside the thumb's reach. The chest is shown whole between locks.
- **Motion:** dials turn with weight and settle into notches; bolts slide and stop firmly; the lid opens slowly with light spilling out.
- **Clues** are part of the scene (engraved, painted, stitched), not text boxes laid over it.
- **Accessibility:** bottles, gems and lights carry a shape or symbol as well as a colour. Clue text can be enlarged.

## 12. Audio and haptics

This concept gains more from sound and touch than any other.

- A crisp tick and a light vibration on every notch of a dial or wheel.
- A deeper, warmer click when a part is correct (in modes that give that feedback).
- Glass clinks for bottles, a wooden slide and stop for bolts, a metallic snap for switches.
- A heavy "thunk", a creak and a soft shimmer as the chest opens.
- Quiet, slightly mysterious background music, changing by chapter.
- Every sound cue is doubled by a visual cue, so the game is fully playable in silence. The pin-tumbler lock in particular must show a visible sign when a pin is set.

## 13. The first 60 seconds

1. The game opens on a small wooden chest with a three-digit padlock. The code is scratched plainly on the lid.
2. The player turns the wheels; each one ticks. The chest opens and gives coins and a first trinket.
3. The second chest has three bottles and a label showing their order.
4. The third chest has a padlock with two simple clues, the first real deduction.
5. The vault appears, with the first trinket in place.

Each new lock type is introduced the same way: first with full information, so that it explains itself.

## 14. Content system

Each lock type has its own puzzle generator that takes the two difficulty controls as inputs and produces a puzzle with a verified single solution. A chest is then assembled from one or more generated locks plus a setting. This allows a very large number of chests from a modest amount of artwork. Chapter-opening chests and the Daily Safe should be chosen by a person.

## 15. Build scope

**First version:** four lock types (digit padlock, coloured bottles, concentric rings, sliding bolts), Relaxed and Locksmith modes, two chapters, the vault, the Daily Safe, hints.

**Later:** the remaining lock types (one per update), Heist, Workshop, chained chests, events, sending chests to friends.

## 16. Risks and open questions

- **Learning load.** Each lock type has its own rules, which works against "no tutorial". Introducing one type at a time with full information is the remedy.
- **Uneven appeal.** Some players will dislike particular lock types. Multi-lock chests could let the player skip one lock without penalty.
- **Build cost.** Each lock type is in effect a small game with its own generator. Launching with four keeps this manageable.
- **Existing games.** Bottle-ordering, tile-sliding and code-deduction games exist separately. The distinguishing features are the lock theme, the chest reward and the variety in one place.
- **Decided:** Relaxed mode offers both as a player setting: show how many parts are correct, or which. See the [build specification](../lockbox/build-specification.md).
- **Decided:** "Lockbox" is a working title, also used as the package name. It has not been checked for existing use.
