# Harbour Lights – Concept Design

*15 November 2026 · Concept 5 of 9 · [Back to concept list](../game-concepts.md)*

All numbers in this document are proposed starting values, to be tuned through playtesting.

## 1. Overview

| | |
|---|---|
| **Pitch** | Sweep a lighthouse beam across a night-time sea to guide fishing boats past the rocks and safely home, then build the harbour town with what they bring. |
| **Genre** | Arcade with an idle town-building layer |
| **Audience** | Broad casual; players who like building and returning to collect |
| **Orientation** | Portrait, one thumb |
| **Session** | About 90 seconds per night; ten-second check-ins to collect |
| **Works offline** | Yes |

## 2. Core gameplay

1. The lighthouse stands at the bottom centre of the screen, beside the harbour mouth. The sea, scattered with rocks, fills the screen above.
2. Boats appear at the top and sides, heading roughly for home.
3. The player drags left or right to rotate the beam.
4. **A boat in the beam** can see: it steers around rocks and makes for the harbour. **A boat in the dark** holds its last course and drifts with the current.
5. The player must share one beam among several boats, lighting each at the moments it most needs it.
6. **A night ends** after a set number of boats, or when three boats are wrecked.

Wrecks are gentle: the crew are always shown rowing safely to shore.

## 3. Boats and hazards

| Element | Behaviour | Introduced |
|---|---|---|
| **Fishing boat** | Slow, steady | Night 1 |
| **Sailing dinghy** | Fast, pushed about by wind | Night 4 |
| **Trawler** | Large, slow to turn, valuable catch | Night 8 |
| **Ferry** | Follows a fixed route; other boats must be steered clear of it | Night 15 |
| **Rocks** | Fixed hazards | Night 1 |
| **Currents** | Carry unlit boats sideways | Night 5 |
| **Fog banks** | Shorten the beam's reach while it passes through them | Night 10 |
| **Squalls** | A period of faster, rougher conditions | Night 20 |
| **Whale** | A moving obstacle that boats must be guided around | Night 30 |

## 4. Progression

- **Nights** are numbered levels with a set mix of boats and conditions.
- **Sea charts:** every 20 nights the player moves to a new stretch of coast with a different rock layout and a new feature.
- **Lighthouse upgrades,** bought with earnings: a wider beam, a longer reach, a faster turn, and eventually a second, smaller harbour light that can be placed and left.

## 5. Scoring and rewards

- **Each boat landed** delivers its catch, valued by boat type.
- **Clean night bonus** for no wrecks.
- **Close-call bonus** for boats that pass very near a rock while lit.
- **Stars** (one to three) per night, based on boats landed.

## 6. Long-term layer: the town

- **Catch becomes coins,** which build and upgrade the town behind the lighthouse: fish market, smokehouse, boatyard, inn, chandlery, school, church, pier.
- **Buildings earn coins over time,** including while the player is away, up to a storage limit of a few hours. This creates a reason for short return visits.
- **Buildings unlock boats and features:** the boatyard adds trawlers; the pier brings the ferry.
- **The town is visible** from the game screen and grows from a few cottages to a busy port, with lit windows at night.
- **Townspeople** set small requests ("Land five trawlers") that act as missions.

## 7. Modes

| Mode | Rules |
|---|---|
| **Nights** | The numbered progression. |
| **Long Watch** | Endless; conditions worsen until three wrecks. |
| **Tonight's Forecast** | A daily night with special weather, the same for everyone. |

## 8. Daily and live features

- **Tonight's Forecast,** with a small-group leaderboard.
- **Storm Season:** a weekly or fortnightly event with rare boats to collect (a tall ship, a lifeboat, a research vessel) and a matching town decoration.
- **Daily reward** delivered by the morning boat.

## 9. Social

- Visit a friend's harbour and send a boat with a small gift.
- Small-group leaderboards for Long Watch.

## 10. Monetisation

- Opt-in rewarded adverts to double a night's catch or collect double idle earnings.
- A single purchase to remove interstitial adverts.
- Optional town decoration packs.
- Building timers are short and can always be waited out.

## 11. Visual direction

- **Contrast:** a deep blue night with a warm yellow beam. The beam is the brightest thing on screen, and everything it touches lights up, which makes the mechanic self-explanatory.
- **Sea:** simple stylised waves with moonlight glints; rocks show as dark shapes with white foam, visible but subdued until lit.
- **Boats:** small, rounded and toy-like, each with its own lantern so they can be found in the dark.
- **Town:** warm lit windows that multiply as the town grows; smoke from chimneys; bunting during events.
- **Feedback:** a boat entering the harbour gives a small flare of light and a coin burst; lit boats show a brief "relieved" bob.

## 12. Audio and haptics

- Calm waves and distant buoy bells as the base layer.
- A warm chime for each boat home, rising with consecutive landings.
- A low foghorn as a warning when a boat nears a rock, always paired with a flashing marker on the boat.
- A soft creak and splash for a wreck, never alarming.
- Gentle, folk-tinged music, with accordion and fiddle in the town view.
- A soft vibration on each safe landing; a slow pulse as the beam passes over a boat.

## 13. The first 60 seconds

1. One boat approaches a single rock. A hand icon shows a sideways drag.
2. The player swings the beam onto the boat, which steers clear and comes home.
3. Two boats arrive from opposite sides, teaching the need to share the beam.
4. The first catch builds the fish market, and the town view is introduced.

## 14. Build scope

**First version:** three boat types, rocks, currents and fog, 40 nights, six buildings, idle earnings, three lighthouse upgrades.

**Later:** remaining boats and hazards, Long Watch, Tonight's Forecast, Storm Season, friends' harbours.

## 15. Risks and open questions

- **Two games in one.** The arcade night and the town must be balanced so that neither feels like a chore. The town should always be optional in the moment.
- **Boat behaviour.** Boats must behave predictably when lit and unlit, or wrecks will feel unfair.
- **Economy tuning.** Idle earnings need careful balance to stay rewarding without making the nights irrelevant.
- **Decided:** dragging to turn the beam or touching to aim it is a player setting. See the [build specification](../harbour-lights/build-specification.md).
- **Decided:** "Harbour Lights" is a working title, also used as the package name. It has not been checked for existing use.
