# Living with Temutom

A portrait, one-thumb mobile game for iOS and Android. You live with an orange cat who believes you exist to serve him. Your thumb is the hand; when you get it wrong, he takes it out on your screen.
Built from `../build-specification.md` and `../../concepts/11-living-with-temutom.md`, following `../../mobile-game-report.md`.

- **App identifier:** `com.promethica.temutom2`
- **Display name:** “Living with Temutom” (working title; one value in `src/config/app.ts`)
- **Stack:** TypeScript, Vite, React, Capacitor 8 (Android min API 26, iOS 15), portrait only
- **Style:** menus follow the *Battle Game Apps UI Kit* Figma file (Readex Pro, deep violet, cyan glow, pill buttons); the scenes use warm domestic colours so the cat is always the brightest thing.

## Decisions and changes

| Topic | Decision |
|---|---|
| App identifier | **`com.promethica.temutom2`** (confirmed), as in the spec. It is set in `src/config/app.ts`, `capacitor.config.ts` and the native projects. |
| Temutom’s look | The same round orange cat as *Staff Management*, with the real cat’s features from `temutomRef/`: rosette spots, white chin and whisker pads, dark eye-liner, green eyes, big ears, a ringed tail with a black tip. Built from parts (body pose, head, ears, eyes, tail, paws) as A2 asks. |
| Stroke speed | Spec: 40–400 pt/s. Real finger strokes are often faster, so the upper limit is **600** (`tuning.ts`). |
| Moment length | A moment always runs its full length (60–90 s); a met objective is kept. Only running out of plasters ends it early. |
| First swipe | The scripted swipe of the first moment comes 28 s in, after he has been fed. It goes through the Warning like any other and never costs a plaster. |
| Version | `0.1.0` in `package.json`, `android/app/build.gradle` and the Xcode project. |
| Houseguest | Unchanged: Week 2, as in this spec (unlike *Staff Management*, where the Dog moved forward). |

## Commands

```bash
npm install
npm run dev                 # http://localhost:5173  (dev only: ?m=w1d5evening jumps to a moment, ?m=mood to Today's Mood)
npm test                    # simulation tests (spec §17)
npm run typecheck           # TypeScript only
FAIRNESS_RUNS=10000 npx vitest run -t fairness   # the fairness rule over 10,000 random moments
npm run balance -- 40       # balance script
npm run build && npx cap sync
cd android && ./gradlew assembleDebug   # needs the Android SDK
npx cap open ios            # build from Xcode on a Mac
```

## Layout

```
src/
  config/   app.ts, tuning.ts (every tuning constant)
  sim/      no UI, no clock, no Math.random (seeded mulberry32)
    cat/        the shared mood model: band, attention, irritation, Brain Cell, rng (A6)
    hand.ts     the thumb: stroke / rest / lift / work / taps and drags
    mind.ts     what he decides to do; body-language display (§6.4, §7)
    demands.ts  escalation.ts  strike.ts  schemes.ts  lapses.ts  chores.ts  body.ts (touch zones per pose)
    difficulties/  hoover.ts (Week 1), guest.ts (Week 2)
    moment.ts   create / step / input
  content/  places, 70 moments, field notes (40), his lines and reviews
  game/     scoring, stars, Standing, reviews, Today's Mood, progress
  state/    save (Capacitor Preferences, localStorage fallback)
  ui/       scene/ (first-person scenes, the cat renderer), effects/ (claw marks, red wash), screens/
  audio/    synthesised sound and music, haptics
tools/      balance.ts, bots.ts, icon.html
tests/      vitest
```

## Status

- **Tests:** 17 pass, including the fairness rule checked over 10,000 random-input moments: no strike ever begins without the minimum Warning, and a thumb lifted during a wind-up never costs a plaster. The flash limits (one wash per 3 s), the six-mark cap, the ladder times, his tells and save round-trip are tested. So are the scripted first swipe (a Warning, a mark, never a plaster), a smack cancelled by meeting the demand, and the journal keeping only its 40 real entries.
- **Balance (not yet met).** Latest run, 10 runs per moment:

  | Player | Objective met | Three stars | Spec target |
  |---|---|---|---|
  | Ignores him | 51% | 0% | under 30% after W1 D3 / never |
  | Sensible | 94% | 83% | 70–90% / 10–30% |
  | Near-perfect | 93% | 88% | over 98% / over 80% |

  The scripted players read his body language directly from the display values with a fixed reaction delay, which is exactly the skill the game asks people to learn, so they overstate how easy it is. The spec’s readability tests with real players (§17) are the right next step before tuning `tuning.ts`.
- **Not built:** reminders and later weeks (out of v1 scope).
