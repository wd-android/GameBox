# Stratum – Concept Design

*15 November 2026 · Concept 6 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Hold to pour coloured sand into a glass jar, release to stop, and build up layers to match a picture. |
| **Genre** | "Satisfying" skill puzzle |
| **Audience** | Broad casual; players drawn to calming, tactile games |
| **Orientation** | Portrait, one thumb |
| **Session** | 60 to 90 seconds per jar |
| **Works offline** | Yes, apart from team features |

## 2. Core gameplay

1. An empty jar stands in the centre of the screen. A small target picture is shown above it, and a palette of sand colours sits below.
2. The player taps a colour, then **holds** on the jar to pour and **releases** to stop.
3. Sand falls from a spout above the point where the thumb is held, so moving the thumb sideways moves the stream.
4. Sand piles naturally: pouring in one spot makes a mound; sweeping makes a flat layer.
5. Dragging the jar's rim **tilts** the jar, so the sand settles at an angle. This makes slopes, waves and zigzags.
6. When the jar is full, the result is compared with the target and scored as a percentage.

There is no fail state. Every jar is finished and kept.

## 3. Techniques

| Technique | How | Result | Introduced |
|---|---|---|---|
| **Flat layer** | Sweep steadily from side to side | Stripes | Jar 1 |
| **Mound** | Hold in one place | Hills | Jar 5 |
| **Slope** | Tilt the jar, then pour | Diagonals | Jar 15 |
| **Zigzag** | Alternate the tilt between layers | Chevrons | Jar 30 |
| **Poke** | Push a thin tool down the inside of the glass | Peaks, drips, feather patterns | Jar 50 |
| **Blend** | Pour two colours in quick alternation | Gradients | Jar 70 |

## 4. Jars

- **Shapes:** straight jar, round bottle, tall vase, heart, star, hourglass. The shape changes how sand settles and so changes the puzzle.
- **Size:** from small jars with three layers to large ones with twelve or more.
- **Colour limits:** some jars supply only a measured amount of each colour, adding a planning element.

## 5. Progression

| Stage | Jars | Layers | Techniques |
|---|---|---|---|
| 1 | 1–15 | 3–4 | Flat layers |
| 2 | 16–50 | 4–6 | Mounds and slopes |
| 3 | 51–100 | 6–9 | Zigzags and pokes; shaped jars |
| 4 | 101+ | 9–12 | Pictures: landscapes, sunsets, simple animals |

## 6. Scoring and rewards

- **Accuracy** as a percentage, with thresholds for one, two and three stars (for example 70%, 85%, 95%).
- **Corks** as currency, earned per jar.
- **Undo:** remove the most recent layer, a limited number of times per jar.
- **Guide lines:** faint marks on the glass showing where each layer should end. On by default in early jars, optional later, and worth a small bonus when switched off.

## 7. Modes

| Mode | Rules |
|---|---|
| **Match** | Recreate the target picture. The main mode. |
| **Daily Jar** | One target a day, the same for everyone. |
| **Free Pour** | No target; any colours, any jar. Results can be saved and shared. |
| **Memory** | The target is shown for a few seconds, then hidden. A later mode. |

## 8. Long-term layer: the shelf

- Every finished jar is kept on a display shelf, exactly as the player poured it, imperfections included. This gives a strong sense of ownership.
- **Themed sets:** deserts, flags, sunsets, seasons, animals. Completing a set unlocks a new jar shape or a special sand (glitter, metallic, glow-in-the-dark).
- **Shelf decoration:** backdrops, lighting and labels.
- Any jar can be re-poured to improve its score.

## 9. Daily and live features

- **Daily Jar** with a streak.
- **Weekly theme** with a limited-time set and a special sand as the reward.
- **Daily reward** of corks.

## 10. Social: the shared jar

- Players join a small **team** of up to ten.
- Each week the team has one giant jar with a complex target. Each member may pour a set number of layers a day, and layers are poured in turn.
- Members can **gift** colours to one another.
- The finished team jar is displayed on every member's shelf, with a reward based on accuracy.
- Small-group leaderboards rank Daily Jar accuracy.

This gives the co-operative, low-pressure team play that the report links to stronger retention.

## 11. Monetisation

- Opt-in rewarded adverts for extra undos or doubled corks.
- A single purchase to remove interstitial adverts.
- Optional packs of special sands and jar shapes.

## 12. Visual direction

- **Sand:** intensely saturated colour, with visible grains that tumble and settle convincingly. The quality of this movement is the game's main selling point.
- **Glass:** clear, with soft highlights, on a plain neutral background so the colours dominate.
- **Target picture:** shown small above the jar, and as a faint overlay on the glass when the player taps it.
- **Finish:** a cork pops into the jar, the jar turns once to show the result, and the accuracy percentage counts up.
- **Accessibility:** each colour in the palette also carries a pattern or symbol, shown on the target, for colour-blind players.

## 13. Audio and haptics

- A fine, hissing pour whose pitch falls as the jar fills, in the way a filling glass sounds.
- Each colour has a very slightly different tone.
- A soft tap as the jar tilts and the sand shifts; a cork "pop" on completion.
- Very quiet, slow ambient music, easily left off.
- A continuous, gentle vibration while pouring, stopping the instant the thumb lifts. This touch feedback is central to the "satisfying" quality and carries the experience when sound is off.

## 14. The first 60 seconds

1. An empty jar, a three-stripe target and three colours. The first colour is already selected, and a hand icon shows a hold.
2. The player pours to the first guide line and releases. The next colour is highlighted.
3. The jar is corked, scored and placed on the shelf.
4. The second jar has four layers and no highlighted colour.

## 15. Build scope

**First version:** flat layers, mounds and slopes; three jar shapes; 80 jars; the shelf; Daily Jar; Free Pour; undo.

**Later:** pokes and blends, further shapes, special sands, teams and the shared jar, Memory mode.

## 16. Risks and open questions

- **Sand simulation.** It must look and feel convincing while running smoothly on modest phones. This is the main technical risk and should be prototyped first.
- **Scoring fairness.** Comparing a poured jar with a target must feel fair; near-enough results should score well.
- **Depth.** The game depends on feel more than challenge. Techniques, jar shapes and colour limits must provide enough variety.
- **Existing games.** Sand-art and sorting games exist. The distinguishing features are matching a target picture, the tilt, and the shared team jar.
- **Decided:** a stream that follows the thumb or a fixed central spout is a player setting. See the [build specification](../stratum/build-specification.md).
- **Decided:** "Stratum" is a working title, also used as the package name. It has not been checked for existing use.
