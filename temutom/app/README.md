# Temutom: Staff Management

A portrait, one-thumb mobile game for iOS and Android. You are an orange cat. The humans are underperforming staff.
Built from `../build-specification.md` and `../../concepts/10-temutom.md`, following `../../mobile-game-report.md`.

- **App identifier:** `com.promethica.temutom`
- **Display name:** “Temutom: Staff Management” (working title; one value in `src/config/app.ts`)
- **Stack:** TypeScript, Vite, React, Capacitor 8 (Android min API 26, iOS 15)
- **Style:** UI follows the *Battle Game Apps UI Kit* Figma file (Readex Pro, deep violet, cyan glow, pill buttons); the rooms use warm domestic colours so the cat is always the brightest thing on screen.

## Changes from the specification

| Topic | Decision |
|---|---|
| Staff names | **Wendy** (The Soft One), **Marcus** (The Busy One), **Uncle Clive** (The Houseguest Who “Isn’t a Cat Person”), **Auntie Pat** (the Daily Grievance visitor) |
| The Dog | Brought forward to **Week 2**. **Biscuit** is a dopey, mischievous Doberman with natural floppy ears and a long, undocked tail. He competes for staff attention, eats food put down for management, sprawls on thrones and clears ledges with his tail. Smack him to send him off (staff don’t love it), stare at him to confuse him off the throne, scream to make him bolt. Week 2’s finale is *The Pecking Order*. |
| Houseguest | Moved to **Week 3**, with the spec’s rules (cap of 40, evicts from his lap/seat, final shift requires Lap 60). v1 therefore has **3 weeks / 105 shifts**; ranks are scaled to 315 stars. |
| Temutom’s look | Orange tabby (the reference folder `temutomRef/` contained only an empty text file, so no Bengal photos were available). |

## Commands

```bash
npm install
npm run dev          # browser prototype at http://localhost:5173  (?shift=w2d2dawn jumps to a shift in dev)
npm test             # simulation tests (spec §16)
npm run balance -- 40            # balance script, 40 runs per shift per scripted player
npm run balance -- 20 --lapses=max
npm run build && npx cap sync    # build web assets and copy into the native projects
cd android && ./gradlew assembleDebug   # needs the Android SDK (ANDROID_HOME)
npx cap open ios                 # then build and run from Xcode on a Mac
```

## Layout

```
src/
  config/   app.ts, tuning.ts (every tuning constant)
  sim/      the whole simulation, no UI code, no clock, no Math.random (seeded mulberry32)
            attention, irritation, brainCell, demands, verbs, staff, morale, thrones, threats/{hoover,dog,guest}, shift
  content/  rooms, shifts (3 weeks), staff profiles, narrator and review lines
  game/     scoring, stars, ranks, reviews, daily grievance, progress
  state/    save data (Capacitor Preferences, with localStorage fallback)
  ui/       screens, HUD, canvas renderer and procedural artwork
  audio/    synthesised sound and music (Web Audio), haptics
tools/      balance.ts and scripted players, icon.html (renders the app icon)
tests/      vitest simulation tests
android/ ios/   Capacitor native projects
```

All art is drawn in code and all sound is synthesised, so the app is small (about 5 MB as a debug APK) and works offline.

## Balance status

The balance script runs; its targets (spec §16) are **not yet met**. Latest run, 12 runs per shift:

| Player | Objective met | Three stars |
|---|---|---|
| Only screams | 41% | 1% |
| Sensible | 80% | 5% |
| Near-perfect | 83% | 7% |

The scripted “near-perfect” player is a heuristic and is weak at holding attention inside the band, so three-star rates understate what a person can do, but the scream-only rate is too high and some shifts (listed by the script) are hard. Tuning is expected per the spec; every number is in `src/config/tuning.ts`.
