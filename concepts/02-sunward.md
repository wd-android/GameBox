# Sunward – Concept Design

*15 November 2026 · Concept 2 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Drag the sun across the sky and watch plants bend and grow towards it, guiding their stems so the flowers open on target. |
| **Genre** | Calm growth puzzle |
| **Audience** | Adult casual players seeking a relaxing game; gardeners and nature lovers |
| **Orientation** | Portrait, one thumb |
| **Session** | 30 to 60 seconds per level |
| **Works offline** | Yes |

## 2. Core gameplay

1. A seed sits in soil at the bottom of the screen. One or more **bloom points** hang in the space above.
2. The player drags the sun along an arc at the top of the screen.
3. The plant grows continuously, its tip always bending towards the sun.
4. Moving the sun curves the stem around obstacles and through gaps.
5. When the tip touches a bloom point, a flower opens there and the stem keeps growing.
6. The level ends when the plant reaches its full length. There is no fail state: the player earns one to three stars for the blooms reached.

Each plant has a fixed length, so every curve uses up growth. The puzzle is finding a route that reaches every bloom point before the plant stops.

## 3. Plants

| Plant | Behaviour | Introduced |
|---|---|---|
| **Sunflower** | Grows straight towards the sun | Level 1 |
| **Vine** | Grows quickly; clings to and follows any surface it touches | Level 10 |
| **Fern** | Shade-loving; grows directly away from the sun | Level 25 |
| **Sweet pea** | Splits into two stems at each bloom | Level 40 |
| **Bamboo** | Grows only in straight segments, turning when the sun crosses overhead | Level 60 |
| **Moonflower** | Grows only while the sun is hidden behind cloud | Level 80 |

## 4. Garden features

- **Walls and trellises** to grow around or along.
- **Clouds** that drift across and block the light, pausing growth.
- **Mirrors** that redirect sunlight, effectively creating a second sun.
- **Water drops** that extend the plant's length when touched.
- **Frost patches** that must be avoided or the tip stops.
- **Two seeds at once,** both responding to the same sun, in later levels.

## 5. Progression

| Stage | Levels | Bloom points | Emphasis |
|---|---|---|---|
| 1 | 1–20 | 1–2 | Steering a single stem |
| 2 | 21–60 | 2–3 | Obstacles and limited length |
| 3 | 61–120 | 3–4 | Mixed plants, clouds and mirrors |
| 4 | 121+ | 4–5 | Two plants sharing one sun |

## 6. Scoring and rewards

- **Stars** for blooms reached; a "perfect" mark for reaching all with growth to spare.
- **Seeds** as currency.
- **Rewind:** drag back along the stem to undo recent growth. Free and unlimited, in keeping with the game's relaxed nature.

## 7. Long-term layer: the greenhouse

- Each plant grown for the first time is added to a greenhouse the player can walk along by swiping.
- Plants are grouped by habitat (meadow, woodland, desert, tropical, alpine); completing a habitat unlocks a new greenhouse wing and backdrop.
- Each plant has a card with its name and a short fact.
- Seeds buy pots, benches and ornaments.
- Plants in the greenhouse need occasional watering, which gives a gentle reason to return and yields a few seeds.

## 8. Daily and live features

- **Plant of the Day:** a special seed with its own level and a place in the collection.
- **Watering streak:** consecutive days unlock rare species.
- **Seasons:** the game follows the calendar, with a seasonal set of levels and plants every few weeks (spring bulbs, autumn colour).

## 9. Social

- Visit a friend's greenhouse and water a plant for them.
- Share a picture of a finished plant; each completed level produces an attractive, unique shape.

## 10. Monetisation

- Opt-in rewarded adverts for extra seeds or a hint showing a ghost of one possible route.
- A single purchase to remove interstitial adverts.
- Optional greenhouse decoration packs.

## 11. Visual direction

- **Light:** the whole scene is lit by the sun's position. Colours warm towards sunrise and sunset and brighten at midday, so dragging the sun changes the mood continuously.
- **Plants:** fluid, elastic growth with leaves unfurling along the stem; soft, painterly but clearly outlined.
- **Bloom points:** softly glowing rings in the colour of the flower to come.
- **Feedback:** a burst of petals at each bloom; a gentle shimmer along the stem when the level is complete.
- **Backdrops:** simple layered landscapes in low saturation, so the plant always stands out.

## 12. Audio and haptics

- Soft plucked notes as the stem grows, their pitch rising with height, so each level produces its own short melody.
- A warm chime and a breath of wind at each bloom.
- Birdsong by day, crickets as the sun nears the horizon.
- Very calm ambient music.
- A gentle pulse on each bloom; a faint continuous texture while growing.
- No sound signals failure, because there is none.

## 13. The first 60 seconds

1. A seed, a sun, and one bloom point up and to the right. A hand icon drags the sun.
2. The player moves the sun; the stem bends; the flower opens.
3. Level two adds a wall. Level three adds a second bloom point.
4. The greenhouse appears with the first sunflower in a pot.

## 14. Build scope

**First version:** three plant types, 100 levels, the greenhouse, Plant of the Day, rewind.

**Later:** remaining plants, mirrors and clouds, seasons, friends' greenhouses.

## 15. Risks and open questions

- **Challenge without failure.** A game with no fail state can feel aimless. Limited stem length and the three-star target must supply the tension.
- **Growth simulation.** Stems must curve smoothly and predictably, never clipping through obstacles. This needs early prototyping.
- **Level design effort.** Levels are hand-built.
- **Decided:** whether growth pauses or continues when the thumb is lifted is a player setting. See the [build specification](../sunward/build-specification.md).
- **Decided:** "Sunward" is a working title, also used as the package name. It has not been checked for existing use.
