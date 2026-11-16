# Murmur – Concept Design

*15 November 2026 · Concept 4 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Draw a line across the evening sky and a flock of starlings streams along it, gathering stray birds and slipping past hawks. |
| **Genre** | Endless arcade |
| **Audience** | Broad casual; players who enjoy score-chasing |
| **Orientation** | Portrait, one thumb |
| **Session** | 30 to 90 seconds per run |
| **Works offline** | Yes, apart from leaderboards |

## 2. Core gameplay

1. The sky scrolls gently upwards. The flock starts as a handful of birds.
2. The player keeps a thumb on the screen and moves it; the flock follows the thumb's path with a short delay, stretching into a ribbon.
3. Stray birds join the flock when it passes over them.
4. Hazards must be avoided. Any bird that touches a hazard is lost.
5. **The run ends** when the flock's leading bird is caught by a hawk, or when the flock falls to zero.

**The central trade-off:** a larger flock scores more per second, but it is longer and wider, harder to thread through gaps, and loses birds at its edges. Players choose how greedy to be.

## 3. Hazards and features

| Element | Effect | Appears |
|---|---|---|
| **Hawk** | Dives at the head of the flock; preceded by a shadow and a cry | From the start |
| **Storm cloud** | Scatters any birds that enter it | 15 seconds |
| **Wires and pylons** | Fixed obstacles with gaps | 30 seconds |
| **Wind gusts** | Push the flock sideways | 45 seconds |
| **Roost trees** | Fly a full circle around one to bank the current score safely | Throughout |
| **Thermals** | Speed the flock up briefly | Throughout |
| **Rival flock** | Crossing it swaps some birds, changing the flock's size | Later |

**Roost trees** give the game its rhythm: build the flock, take the risk, then bank the score.

## 4. Flock shapes

When the player draws a tight loop, the flock briefly forms a swirling ball. This "murmuration" pulls in nearby stray birds and earns a bonus. It is the one advanced technique, discovered naturally by most players.

## 5. Progression

The game is endless, so progression comes from unlocks and goals, not levels.

- **Speed and density** of hazards rise steadily through a run.
- **Species** unlock with total birds gathered:

| Species | Flock behaviour |
|---|---|
| **Starlings** | Balanced |
| **Swallows** | Fast and tight; fewer birds per pickup |
| **Geese** | Slow, in a V; very wide, high score per bird |
| **Sparrows** | Loose cloud; forgiving of clipped edges |
| **Swifts** | Very fast; expert play |

- **Skies** unlock with distance: sunset, dawn, moonlit, autumn mist, city dusk.

## 6. Modes

| Mode | Rules |
|---|---|
| **Free Flight** | The endless run described above. |
| **Daily Migration** | A fixed layout each day, the same for everyone. |
| **Calm Skies** | No hawks; gather birds and draw shapes to music. |

## 7. Scoring and rewards

- **Score** accumulates per second in proportion to flock size, and is only kept when banked at a roost tree.
- **Bonuses** for murmurations, near misses and unbroken distance.
- **Feathers** as currency, earned per run.
- **Missions:** three at a time ("Bank 200 birds in one run", "Pass ten hawks"), replaced as completed. These give short-term goals in an endless game.
- **One revive per run,** by choosing to watch an advert.

## 8. Long-term layer

- The species and sky collection.
- A **field journal** recording personal bests per species.
- **Rank** rising through completed missions.

## 9. Daily and live features

- **Daily Migration** with a small-group leaderboard.
- **Seasonal migrations:** limited-time events with a visiting species to unlock.
- **Daily reward** of feathers.

## 10. Social

- Small-group leaderboards, resetting weekly, so that newer players can win.
- A shareable image of the player's largest murmuration.

## 11. Monetisation

- Opt-in rewarded adverts for a revive or doubled feathers.
- A single purchase to remove interstitial adverts.
- Optional species and sky packs (cosmetic variants only).

## 12. Visual direction

- **Silhouette on gradient:** birds are dark shapes against a vivid sky that grades from deep orange to violet. This gives very high contrast with very little detail, and performs well on modest phones.
- **The flock** moves as a real murmuration does, stretching, folding and rippling. This movement is the game's visual identity.
- **Hazards** are distinct in shape and outlined in a warning colour.
- **Stray birds** glow faintly so they are easy to spot.
- **Feedback:** a bright trail where the thumb has drawn; a soft flash as birds join; a scatter of feathers when birds are lost.

## 13. Audio and haptics

- A rush of wings that grows fuller as the flock grows.
- A soft rising note for each bird gathered, forming a scale during a good run.
- A hawk's cry before each dive, always paired with its shadow on screen.
- Spacious, slow music that builds in layers as the flock grows.
- A light tick of vibration for each pickup; a firm pulse when birds are lost.

## 14. The first 60 seconds

1. The game opens with a small flock already flying and a hand icon tracing a curve.
2. The player moves a thumb; the flock follows. Stray birds appear directly ahead.
3. A roost tree appears; circling it banks the score.
4. The first hawk arrives after about 20 seconds, slowly and with a long warning.

## 15. Build scope

**First version:** Free Flight, starlings and two further species, hawks, clouds and wires, roost trees, missions, two skies.

**Later:** Daily Migration, Calm Skies, wind and rival flocks, seasonal events.

## 16. Risks and open questions

- **Feel of the flock.** The follow delay and the flock's movement determine whether the game is satisfying. This must be prototyped first.
- **The thumb hides the screen.** The flock should lead slightly ahead of the thumb, or the control should work from an offset, so the player can see what is coming.
- **Longevity.** Endless arcade games retain players less well than level-based puzzles. Missions, species and daily routes carry the long-term interest.
- **Decided:** following the thumb or following a drawn line is a player setting. See the [build specification](../murmur/build-specification.md).
- **Decided:** "Murmur" is a working title, also used as the package name. It has not been checked for existing use.
