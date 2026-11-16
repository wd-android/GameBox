# Oddness – Concept Design

*15 November 2026 · Concept 7 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | A scene full of objects appears. One does not belong. Tap it. |
| **Genre** | Observation and general-knowledge puzzle |
| **Audience** | All ages; strongest with adults 25+ and families playing together |
| **Orientation** | Portrait, one thumb |
| **Session** | 5 to 30 seconds per scene; about two minutes per run of ten |
| **Works offline** | Yes, apart from the Daily Scene leaderboard |

## 2. Core gameplay

1. A scene appears with a set of objects on a themed backdrop.
2. All but one share a hidden common property. The rule is never stated.
3. The player taps the object they believe is odd.
4. **Correct:** the object pops forward with a one-line caption explaining why ("Not invented until 2007"), and the next scene loads.
5. **Wrong:** the tapped object shakes and greys out, and the player loses one of three lives for the run.

The caption matters. It settles any doubt about fairness, and it gives the player something small to learn and repeat to others.

## 3. Kinds of oddness

| Kind | Example | Introduced |
|---|---|---|
| **Category** | One vegetable among fruit | Stage 1 |
| **Location** | A snorkel in a kitchen | Stage 1 |
| **Context** | A sun lounger in a snow scene | Stage 2 |
| **Function** | The one item that does not need electricity | Stage 2 |
| **Generational** | A smartphone in a 1970s living room | Stage 3 |
| **Material or origin** | The one item not made of wood | Stage 3 |
| **Detail** | One clock showing a different time | Stage 4 |

## 4. Progression

| Stage | Levels | Objects | Layout | Decoys |
|---|---|---|---|---|
| 1 | 1–10 | 5 | Loose cluster | None |
| 2 | 11–30 | 9–12 | 3 × 3, 3 × 4 | Objects that look unusual but belong |
| 3 | 31–70 | 16–20 | 4 × 4, 4 × 5 | Objects close to the odd item in appearance |
| 4 | 71+ | 25–30 | 5 × 5, 5 × 6 | Near-miss decoys from a neighbouring era or place |

Difficulty rises on three axes at once: more objects, subtler kinds of oddness, and closer decoys. A 5 × 6 layout gives touch targets of roughly 60 points on a typical phone, which is the comfortable minimum. Tablets could show more.

Within each stage, one scene in five should be noticeably easier than its neighbours, to give the confidence-then-tension rhythm described in the report.

## 5. Modes

| Mode | Rules | Unlocks |
|---|---|---|
| **Classic** | Ten scenes, untimed, three lives. | From the start |
| **Vanishing** | One belonging object disappears at a fixed interval, so the scene thins out. Score falls with each object lost. | Level 10 |
| **Blitz** | As many scenes as possible in 60 seconds; a wrong tap costs three seconds. | Level 20 |
| **Daily Scene** | One large hand-picked scene, the same for everyone. | From the start |
| **Two of a Kind** | Two odd items, each odd for a different reason. | Level 50 |

### Vanishing mode in detail

- The interval starts at 10 seconds in early stages and shortens to 5 seconds in later ones.
- Objects that vanish are chosen at random from the belonging set. The odd item never vanishes.
- Vanishing stops when three objects remain, so the round always ends with a choice.
- An object about to vanish wobbles for one second first, so the change is never missed.
- Score starts at 100% of the scene's value and drops by an equal share for each object lost, down to a floor of 20%.
- Because the scene gets easier over time, this mode has no lives. It suits players who dislike failing.

## 6. Scoring and rewards

- **Base score** per scene scales with object count.
- **Speed bonus** for answering within the first few seconds.
- **Streak multiplier** rising with each consecutive correct answer, reset by a wrong tap.
- **Stars** (one to three) per run, based on lives remaining.
- **Coins** earned per run, spent on hints and scene packs.

**Hints** (each costs coins, or can be earned by choosing to watch an advert):

- *Narrow* – removes half the belonging objects.
- *Clue* – names the kind of oddness ("Think about when these were invented").

## 7. Long-term layer

- **Scene packs:** Decades (1950s to 2020s), Around the World, At Work, Seasons, Nature, Sport, Kitchen and Home. Each pack has 30 to 50 scenes and its own backdrop style.
- **Sticker album:** every odd item found becomes a sticker. Completing a page grants coins and a profile badge.
- **Player level:** rises with total score and unlocks modes, giving a steady stream of new things early on.
- **Statistics:** best streak, fastest answer, accuracy by kind of oddness.

## 8. Daily and live features

- **Daily Scene** with a streak counter and a spoiler-free shareable result ("Spotted in 6.2 seconds").
- **Weekly themed pack** as an event, for example a decade or a festival, with a limited-time sticker page.
- **Daily reward** of coins, increasing over a seven-day streak.

## 9. Social

- Small-group leaderboards for the Daily Scene and Blitz.
- **Pass and play:** two players on one phone taking alternate scenes. This suits the family and cross-generation appeal and needs no network.
- Shareable results.

## 10. Monetisation

- Opt-in rewarded adverts for hints, an extra life or doubled coins.
- A single purchase to remove any interstitial adverts.
- Optional premium scene packs.
- No timers that stop the player from playing.

## 11. Visual direction

- **Objects:** flat, boldly outlined, bright, and recognisable at 60 points. Each drawn once and reused across scenes.
- **Backdrops:** soft, lower-saturation illustrations that set the place or era without competing with the objects.
- **Layout:** the scene in the upper two-thirds; lives, score and hint buttons in the lower third within thumb reach.
- **Feedback:** the correct object scales up, with a burst of confetti and the caption beneath; a wrong object shakes and fades.
- **Accessibility:** oddness never depends on colour alone. Text captions use a large, clear typeface. A high-contrast outline option is available.

## 12. Audio and haptics

- A bright "ping" on a correct answer, rising in pitch through a streak.
- A soft, dull tap on a wrong answer, never harsh.
- A gentle tick and a light "pop" as each object vanishes in Vanishing mode.
- A quiet ticking that speeds up in the last ten seconds of Blitz, matched by a visual countdown.
- Light, cheerful background music that varies by pack (a hint of period style for each decade).
- A short vibration on correct, a double pulse on wrong.
- Separate controls for music, effects and vibration. The game is fully playable in silence.

## 13. The first 60 seconds

1. The game opens directly on a five-object scene: four fruits and a hammer. No menu, no sign-up.
2. A single line of text reads "Tap the odd one out".
3. The next two scenes use different kinds of oddness, with no further text.
4. After the third scene, the player sees their first sticker and the Daily Scene button.

## 14. Content system

Hand-drawing every scene would be slow and expensive. Scenes are instead assembled from a library of individually drawn objects.

**Each object carries tags, for example:**

| Object | Category | Location | Era | Power | Material | Season |
|---|---|---|---|---|---|---|
| Cassette tape | Media | Home | 1970s–1990s | None | Plastic | Any |
| Snorkel | Sport | Beach | Any | None | Plastic | Summer |
| Toaster | Appliance | Kitchen | 1920s onwards | Electric | Metal | Any |

**To build a scene, the generator:**

1. Picks a tag value, such as *Location = Kitchen*.
2. Selects the required number of objects that share it.
3. Adds one object that does not.
4. **Runs an ambiguity check:** no other single tag may pick out a different lone object. If the scene is all fruit plus one vegetable, but only one item is red, some players will tap the red one and feel cheated. Any scene that fails is discarded.
5. Writes the caption from a template for that tag.

A library of about 300 objects with six to eight tags each yields thousands of distinct scenes. The Daily Scene and the first 30 levels should still be chosen and checked by a person.

## 15. Build scope

**First version:** Classic and Vanishing modes, the Daily Scene, about 150 objects, three packs, the sticker album, hints.

**Later:** Blitz, Two of a Kind, pass and play, leaderboards, weekly events, further packs.

## 16. Risks and open questions

- **Ambiguity** is the largest risk. A scene with two defensible answers damages trust quickly. The ambiguity check and the caption are the safeguards, and a "Report this scene" button would catch what they miss.
- **Cultural and regional knowledge.** Objects and eras differ by country. Packs may need regional versions, and generational facts (invention dates) must be verified before use.
- **Repetition.** Players will learn the object library. New objects need adding regularly.
- **Decided:** whether a wrong answer reveals the right one is a player setting. See the [build specification](../oddness/build-specification.md).
- **Decided:** "Oddness" is a working title, also used as the package name. It has not been checked for existing use.
