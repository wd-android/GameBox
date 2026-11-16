# Tide Pool – Concept Design

*15 November 2026 · Concept 1 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Hold to raise the tide, release to lower it, and float each sea creature into the rock pool where it belongs. |
| **Genre** | Physics puzzle |
| **Audience** | Broad casual; all ages |
| **Orientation** | Portrait, one thumb |
| **Session** | 45 to 90 seconds per level |
| **Works offline** | Yes |

## 2. Core gameplay

1. A cross-section of rocky shore fills the screen, with several pools at different heights and creatures resting at the bottom.
2. **Holding** anywhere on the screen raises the water; **releasing** lets it fall. The water level follows the thumb's hold with a slight, natural lag.
3. Creatures float up with the water and drift with a gentle current that runs across the screen.
4. When the tide falls, each creature settles into whatever lies beneath it.
5. **Win:** every creature rests in a pool marked with its own colour and shape.
6. **Fail:** a creature is left stranded on dry rock for more than a few seconds. One tap restarts.

The skill lies in timing: raising the water just long enough for a creature to drift over the right pool, then dropping it.

## 3. Creatures

| Creature | Behaviour | Introduced |
|---|---|---|
| **Starfish** | Floats and drifts with the current | Level 1 |
| **Crab** | Sinks; walks along the bottom towards deeper water | Level 8 |
| **Limpet** | Clings to rock; released only when fully covered | Level 20 |
| **Jellyfish** | Rises faster than the water and drifts further | Level 35 |
| **Fish** | Swims against the current | Level 50 |
| **Hermit crab** | Must collect a shell on the way to its pool | Level 70 |
| **Urchin** | Must not touch other creatures | Level 90 |

## 4. Shore features

- **Currents** that change direction partway through a level.
- **Seaweed** that holds a creature until the water has risen and fallen once.
- **Channels** linking pools, so one pool fills only when its neighbour overflows.
- **Sluice rocks** that open at high water and close at low.
- **Gulls** that take any creature left exposed for too long, as a visible, gentle time limit.

## 5. Progression

| Stage | Levels | Creatures per level | Emphasis |
|---|---|---|---|
| 1 | 1–20 | 1–2 | Learning the tide |
| 2 | 21–60 | 2–3 | Mixed behaviours |
| 3 | 61–120 | 3–4 | Channels and currents |
| 4 | 121+ | 4–6 | Sequencing: which creature to place first |

Roughly one level in five is a harder "spring tide" level, flagged in advance, with a larger reward.

## 6. Scoring and rewards

- **Stars** (one to three) based on the number of tide cycles used.
- **Shells** as currency, earned per level.
- **Boosters,** used sparingly: *Slack Water* (pauses the current), *Rescue* (returns one stranded creature to the water).

## 7. Long-term layer: the reef

- Every creature rescued for the first time joins the player's reef, a side-on aquarium scene that grows over time.
- Shells buy coral, rocks, plants and ornaments, placed freely.
- Creatures in the reef move about and occasionally leave small gifts of shells to collect on return.
- A **field guide** records each species with a short fact, forming a collection.

## 8. Daily and live features

- **Low Tide:** a daily level revealing a rare creature variant.
- **Coastlines:** a new themed set of levels every week or two (tropical lagoon, northern rock shore, mangrove), with its own creatures and reef decorations.
- **Daily reward** of shells on a seven-day streak.

## 9. Social

- Visit a friend's reef and leave a gift.
- Small-group leaderboard for the Low Tide level.

## 10. Monetisation

- Opt-in rewarded adverts for a booster or doubled shells.
- A single purchase to remove interstitial adverts.
- Optional reef decoration packs.

## 11. Visual direction

- **Creatures:** rounded, toy-like, with large expressive eyes; they look worried when exposed and content when settled.
- **Water:** translucent blue-green with a bright, clearly drawn surface line, so the tide level is always obvious.
- **Rock:** warm, muted browns and greys that sit behind the creatures.
- **Pools:** each ringed with the colour and shape of the creature it accepts.
- **Feedback:** ripples from the thumb, bubbles as creatures rise, a small splash and sparkle on settling.

## 12. Audio and haptics

- A soft swell that rises and falls with the water, tied directly to the thumb.
- A gentle "plop" as each creature settles; rising notes for consecutive correct placements.
- A distant gull call as a warning when a creature is exposed, paired with a visible shadow overhead.
- Calm, light music with marimba and soft guitar.
- A light vibration on each landing and a slow pulse while the tide is held high.

## 13. The first 60 seconds

1. One starfish, one pool, directly above. A hand icon shows a hold.
2. The player holds; the water rises; the starfish floats. They release; it settles. Level complete in ten seconds.
3. Level two places the pool to one side, teaching the current.
4. Level three has two starfish. After it, the reef appears with the first resident.

## 14. Build scope

**First version:** four creature types, 100 levels, the reef, Low Tide, two boosters.

**Later:** remaining creatures, coastlines as events, friends' reefs, the field guide.

## 15. Risks and open questions

- **Feel of the water.** The link between thumb and tide must feel immediate but natural; this needs early prototyping.
- **Level design effort.** Levels are hand-built, so content takes time to produce. A level editor should be built early.
- **Depth.** One input may limit variety; creature behaviours and shore features carry the burden of keeping it fresh.
- **Decided:** the current's direction is fixed by each level, and its flow rate is a player setting. See the [build specification](../tide-pool/build-specification.md).
- **Decided:** "Tide Pool" is a working title, also used as the package name. It has not been checked for existing use.
