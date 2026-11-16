# Topple – Concept Design

*15 November 2026 · Concept 3 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | A half-built domino run and only three dominoes to place. Fill the right gaps, tap once, and see whether the whole chain falls. |
| **Genre** | Daily chain-reaction puzzle |
| **Audience** | Daily-puzzle players; adults who like a single shared challenge each day |
| **Orientation** | Portrait, one thumb |
| **Session** | One to two minutes of thought, a ten-second payoff |
| **Works offline** | Level packs yes; the daily puzzle needs a connection once a day |

## 2. Core gameplay

1. A table-top course appears, viewed from above at a slight angle. Most dominoes are in place, but there are more gaps than the player has pieces to fill.
2. The player drags up to three dominoes into gaps. Pieces snap to valid positions and can be turned by a twist or a tap.
3. The player taps the first domino to start the chain.
4. **Win:** the final domino, marked with a flag, falls.
5. **Lose:** the chain stops. The camera lingers on the point of failure, and the player can adjust and try again.

The puzzle is working out which gaps matter. Some are decoys on branches that lead nowhere; others can be bridged by a trick piece instead of a domino.

## 3. Pieces and course features

| Element | Effect | Introduced |
|---|---|---|
| **Standard domino** | Knocks over the next one | Day 1 |
| **Tall domino** | Bridges a double gap | Pack 1 |
| **Ramp and ball** | A falling domino releases a ball that rolls to strike a distant one | Pack 1 |
| **Splitter** | One chain becomes two | Pack 2 |
| **Bell** | Must be rung by the chain for the solution to count | Pack 2 |
| **Seesaw** | Flips direction, or lifts a blocker elsewhere | Pack 3 |
| **Switch and gate** | A falling domino opens a gate on another branch, so timing matters | Pack 3 |
| **Stairs** | Carries the chain up or down a level | Pack 4 |
| **Fan or magnet** | Slows or pulls a falling domino | Pack 5 |

## 4. Difficulty

- **Monday to Sunday ramp:** the daily puzzle is easiest on Monday and hardest on Sunday, a pattern familiar from crosswords.
- **Controls on difficulty:** the number of gaps relative to pieces, the number of branches, and whether timing between branches matters.
- **Attempts are unlimited,** but the result records how many topples it took.

## 5. Modes

| Mode | Rules |
|---|---|
| **Daily Topple** | One puzzle a day, the same for everyone. |
| **Archive** | Every past daily puzzle, playable at any time. |
| **Packs** | Themed sets of 30 puzzles, each introducing a new element. |
| **Free Build** | Build a run of any shape from unlocked pieces and watch it fall. A later feature. |

## 6. Scoring and rewards

- **Result:** solved on the first, second or third topple, or later.
- **Par:** many puzzles can be solved with fewer than three dominoes. Solving under par earns a gold mark.
- **Tokens** are earned daily and spent on domino styles.
- **Hint:** highlights one gap as essential or as a decoy.

## 7. Long-term layer

- **Streaks:** current and longest, displayed prominently.
- **Calendar:** each day coloured by result, building a picture over the month.
- **Statistics:** the distribution of first-, second- and third-topple solves.
- **Domino styles:** wood, ivory, neon, sweets, stone; and table surfaces.
- **Trick gallery:** each new element encountered is added to a gallery, with a slow-motion replay.

## 8. Daily and live features

- The **Daily Topple** is the game.
- **Streak protection:** one missed day a month is forgiven automatically.
- **Monthly special:** a very large run on the last day of the month, with a long, spectacular payoff.

## 9. Social

- **Shareable result,** spoiler-free, for example: "Topple #142 – solved on the 1st topple, 2 dominoes".
- A short shareable video of the winning chain.
- Small-group leaderboards among friends.
- With Free Build, players can send their own runs to friends.

## 10. Monetisation

- Opt-in rewarded adverts for a hint or extra tokens.
- A single purchase to remove interstitial adverts and unlock the full archive.
- Optional puzzle packs and domino styles.

## 11. Visual direction

- **Dominoes:** bold primary colours, chunky and slightly rounded, on a clean wooden or felt table.
- **Gaps:** shown as faint outlines, so every possible position is visible at once.
- **Camera:** static while planning. During the topple it follows the leading domino closely, then pulls back at the end to show the whole fallen run.
- **Payoff:** the final domino triggers a flourish, such as a flag raised or confetti released.
- **Failure:** the chain's stopping point is circled gently; the stopped domino wobbles, emphasising the near miss.

## 12. Audio and haptics

- Crisp clacks, each slightly different in pitch, quickening with the chain. This run of sound is the central reward.
- Each trick piece has its own sound: a rolling ball, a bell, a creaking seesaw.
- A held breath of silence when the chain stops short.
- No music during the topple; light, unobtrusive music while planning.
- A ripple of vibration matching the clacks, which carries the payoff when sound is off.

## 13. The first 60 seconds

1. The game opens on a short straight run with one obvious gap and one domino in the player's tray.
2. The player drags it in and taps the first domino. The chain falls.
3. The second puzzle has two gaps and one domino: a branch teaches that not every gap matters.
4. The player is taken to today's Daily Topple.

## 14. Build scope

**First version:** the Daily Topple, the archive, one pack, standard and tall dominoes, the ramp and ball, streaks and sharing.

**Later:** further elements and packs, the shareable video, Free Build.

## 15. Risks and open questions

- **One puzzle a day** means little to do for an eager new player. The archive and packs fill this gap.
- **Puzzle quality.** Every daily puzzle must be designed and tested by a person. A stock of several months should exist before launch.
- **Physics consistency.** The chain must fall identically on every device, or shared results lose meaning. The topple should be calculated by fixed rules, not free physics.
- **Decided:** showing par before solving is a player setting, off by default. See the [build specification](../topple/build-specification.md).
- **Decided:** "Topple" is a working title, also used as the package name. It has not been checked for existing use.
