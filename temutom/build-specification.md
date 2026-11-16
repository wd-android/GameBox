# Temutom: Staff Management – Build Specification

*16 November 2026 · Version 0.1 · Based on the [concept design](../concepts/10-temutom.md)*

This document specifies the first playable release (v1) in enough detail to build from. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting. This game depends on feel more than the puzzle games do, so expect more tuning than usual.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Temutom: Staff Management" is a **working title**. `temutom` is used for the package name and all internal identifiers. The display name is read from one configuration value. |
| Platform | Mobile, portrait, one thumb, as for the other concepts. |
| Technology | Same as Oddness, Cubyrinth and Lockbox: TypeScript, Vite, React and Capacitor, for iOS and Android from one codebase. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **Two-dimensional artwork**, drawn on a single canvas for the room, with React for menus and gauges. No game engine. | A room holds one cat, up to three people and about a dozen objects. A canvas handles that easily. |
| A2 | **Movement is between fixed spots,** not free roaming. Each room has 8 to 12 named spots (bowl, door, armchair, shelf). | Tap-a-spot suits one thumb, removes path-finding, and makes every position meaningful to the rules. |
| A3 | **v1 contains Weeks 1 and 2** (70 shifts). | Enough to prove every system and one new human. Weeks 3 to 7 each add content, not systems. |
| A4 | **Shifts are written by hand** as data, from a small set of templates. | Seventy short shifts is manageable, and the teaching order matters too much to generate. |
| A5 | **No server, adverts or purchases in v1.** The Daily Grievance is derived from the date on the device. | As for the other games. |
| A6 | **No currency in v1.** Progress is stars, compliance, thrones and the cabinet. | The game has four gauges already. |

## 3. Scope of v1

**Included**

- Five verbs, the Attention Band, Irritation and Outbursts
- Demands (food, door, lap, play), Compliance and Staff Morale
- The Brain Cell, lapses and three Schemes
- Five rooms, each with a throne
- The Soft One, the Busy One and the Houseguest
- Weeks 1 (The Hoover) and 2 (The Houseguest), 35 shifts each
- Stars, ranks, the house map, staff files, the cabinet, reviews
- The Daily Grievance
- Local save, sound, haptics, settings

**Not included (planned for later)**

- Weeks 3 to 7 and seasonal weeks
- Further demands, Schemes and rooms
- Leaderboards, adverts, purchases

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `temutom` |
| App identifier | `<your reverse domain>.temutom` (to be supplied) |
| Display name | `Temutom: Staff Management`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

```
temutom/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      sim/        the whole game simulation                          (no UI code)
        attention.ts  irritation.ts  brainCell.ts  demands.ts
        verbs.ts  staff.ts  morale.ts  thrones.ts  threats/  shift.ts
      content/    rooms, shifts, weeks, review and narrator lines     (data only)
      game/       scoring, stars, ranks, daily grievance
      state/      save data, settings
      ui/         screens, gauges, room canvas
      audio/      sound, music, haptics
    tools/        balance simulation script
    tests/
```

`sim/` must contain no user-interface code and must not read the clock or the system random function, so that a whole shift can be run and tested without a screen.

## 5. Simulation model

### 5.1 Time and randomness

- The simulation advances in fixed steps of 1/30 second. The screen draws as often as the device allows and reads the latest state.
- All randomness comes from one seeded generator (`mulberry32`). The same shift seed and the same player inputs always produce the same result.
- When the app goes to the background, the shift pauses.

### 5.2 State of a shift

```
ShiftState {
  time                      seconds elapsed
  cat {
    spot                    where he is, or where he is heading
    action                  idle | moving | screaming | staring | sitting | lapse | outburst | scheme | stunned
    attention               0..100
    irritation              0..100
    brainCell               away | arriving | present, with time remaining
    demand                  the current demand and its patience remaining, or none
  }
  band { centre, halfWidth, target }
  staff[]                   each: spot, state, task, compliance per demand
  morale                    0..100, shared by the household
  objects[]                 each: spot, kind, knocked off or not
  throne { progress, claimed }
  threat                    the week's threat, if present in this shift
  tally                     demands issued and met, seconds in band, outbursts, lapses
}
```

### 5.3 Rooms and spots

A room is a background, a list of spots and a list of objects.

```
Spot { id, position, kind, adjacentTo[] }
kind = floor | bowl | door | lap | perch | ledge | hide | throne | scheme | socket
```

- Temutom moves from spot to spot in a straight line at 4 spot-widths per second (tuning).
- A **hide** spot (under the bed, behind the sofa) blocks all attention from staff and halves the effect of a threat.
- A **ledge** holds objects that can be knocked off.

| Room | Throne | Notable spots | Used from |
|---|---|---|---|
| Kitchen | The clean worktop | Bowl, back door, treat cupboard (Scheme) | Week 1, Day 1 |
| Living room | The armchair | Sofa lap, ornament shelf, toy basket, behind the sofa | Week 1, Day 2 |
| Study | The laptop keyboard | Desk, windowsill, door, socket | Week 1, Day 3 |
| Bedroom | The pillow | Bed lap, under the bed, wardrobe top, door (Scheme) | Week 2, Day 1 |
| Hallway | The top stair | Front door, shoe rack, hoover cupboard | Week 2, Day 3 |

## 6. Attention and Irritation

### 6.1 Attention

Attention changes every step by the sum of what the staff in the room are doing (tuning, per second):

| Situation | Change |
|---|---|
| No staff in the room, or Temutom in a hide spot | −4 |
| Staff present but busy | −2 each |
| Staff looking at him | +3 each |
| Staff talking to him | +6 each |
| Being stroked | +12 |
| Being picked up or held | +20 |

Attention is kept between 0 and 100.

### 6.2 The band

| Parameter | Value |
|---|---|
| Half-width | 14 in Week 1, 11 in Week 2 (set per shift) |
| Centre | Between 25 and 75 |
| Drift | Every 8 to 14 seconds a new target centre is chosen; the centre moves towards it at 5 per second |

The first two days of Week 1 use a half-width of 22 and no drift.

### 6.3 Irritation

| Situation | Change per second |
|---|---|
| Attention inside the band | −8 |
| Attention outside the band | +4, plus 0.3 for each point outside |
| A threat active in the room | As the threat specifies (section 11) |

| Event | Change |
|---|---|
| A demand runs out of patience | +20 |
| Sprayed with the spray bottle | +25 |

### 6.4 The Outburst

When Irritation reaches 100, an Outburst begins automatically. The player can also trigger one by tapping the Irritation gauge when it is at 50 or more.

The target is chosen in this order:

| Target | Condition | Morale |
|---|---|---|
| **Bite** the nearest staff member | One is at an adjacent spot or touching him | −12 |
| **Swipe** the nearest object | One is on an adjacent ledge | −6 |
| **Zoomies** | Otherwise | −2 |

Effects: a 1.5-second animation during which no input is taken; Irritation returns to 0 (or falls by 50 for a deliberate Outburst); Attention is set to the band centre; a bitten staff member recoils for 8 seconds and gains 2 Compliance in every demand.

## 7. Demands and verbs

### 7.1 Demands

| Demand | Fulfilled when | Matching spot |
|---|---|---|
| **Food** | A staff member fills the bowl | Bowl |
| **Door** | A staff member opens (or closes) the named door | That door |
| **Lap** | He is sitting on a staff member who does not remove him for 4 seconds | Sofa or bed |
| **Play** | A staff member fetches the toy | Toy basket |

- Each shift lists its demands with the times they appear, or gives an interval (12 to 20 seconds) for them to be drawn at random.
- One demand is active at a time in Week 1; two may be active from Week 2.
- Each demand has 25 seconds of patience, shown as a shrinking ring round the thought bubble.
- A Door demand that has been met is followed, later in the shift, by a demand for the same door to be put back as it was.

### 7.2 Verbs

| Verb | Target | Time | Staff notice | Understand (base) | Morale |
|---|---|---|---|---|---|
| **Scream** | None; reaches the room and adjoining rooms | While held, at least 1 s | 90% | 30% | −1 for each scream after the third within 20 s |
| **Stare** | One staff member | 2 s, uninterrupted | 50%, or 80% if they are idle | 55% | 0 |
| **Smack** | Adjacent staff member or object | Instant | 100% | Not a signal | −3 |
| **Sit On** | A lap, an object or a throne | Until he moves | 100% if it blocks their task | 40% | −1 if it blocks their task |
| **Knock Off** | An object on an adjacent ledge | 0.5 s | 100%, including adjoining rooms | 20% | −4, or −8 if breakable |

Other effects:

- **Smack** ends stroking or holding at once, and the staff member recoils for 6 seconds.
- **Smack** within 4 seconds of a wrong response counts as a punishment (section 8.2).
- **Sit On** a staff member within 6 seconds of a correct response counts as a reward (section 8.2).
- **Knock Off** adds the object to the cabinet the first time each kind is knocked off.

### 7.3 Controls

| Input | Result |
|---|---|
| Tap a spot | He goes there |
| Tap a staff member or object | He goes to the nearest spot from which he can act, and a small arc of the verbs valid for that target appears above the Scream button. Tap one. |
| Hold the Scream button | He screams until released |
| Tap a glowing Scheme prompt | Performs the next step of the Scheme |
| Tap the Irritation gauge (at 50 or more) | Deliberate Outburst |

Where only one verb is valid for a target, it is performed on the first tap with no arc shown.

## 8. Staff

### 8.1 Behaviour

Each staff member is in one of these states:

| State | Behaviour | Leaves when |
|---|---|---|
| **Routine** | Carrying out the tasks the shift lists for them (cooking, working, watching television), at given spots | They notice a signal, or decide to give attention |
| **Attending** | Looking at him, then walking over | They arrive |
| **Responding** | Carrying out what they think he wants | The action is complete (2 to 4 s) |
| **Stroking** | Stroking him, unasked or as a wrong response | 5 to 9 s pass, he moves, or he is smacked |
| **Holding** | Has picked him up | 4 s pass, or he is smacked |
| **Recoiling** | Stepping back after a smack or bite | 6 or 8 s pass |
| **Evicting** | Lifting him off a throne or their work | Complete (1.5 s) |
| **Spraying** | Using the spray bottle | Complete (1 s) |

### 8.2 Understanding and Compliance

When a staff member notices a signal while a demand is active, they respond correctly with probability:

```
p = base for the verb (7.2)
  + 0.25  if Temutom is at the demand's matching spot
  + 0.5 × compliance for this demand ÷ 100
  + the staff member's own modifier (8.4)
capped at 0.95
```

A wrong response is one of: stroking him, picking him up, offering the wrong thing, or standing and asking what he wants (which counts as looking and talking).

Compliance is held per staff member, per demand, from 0 to 100:

| Event | Change |
|---|---|
| Correct response | +6 |
| Correct response, then rewarded | +5 more |
| Wrong response, then punished | +3 |
| Bitten | +2 in every demand |

**Anticipation.** When a demand appears and a staff member in Routine has Compliance of 60 or more for it, they respond unprompted within 5 seconds, with a probability rising evenly from 25% at 60 to 100% at 90.

Compliance is saved at the end of every completed shift and carried forward.

### 8.3 Morale

One value for the household, 0 to 100, starting at 70.

| Event | Change |
|---|---|
| Verbs and Outbursts | As sections 6.4 and 7.2 |
| A lapse seen by a staff member (section 9) | +3 |
| Temutom on a lap with attention inside the band | +1 per second |
| Between shifts | +10 |
| Start of a new day | Raised to 60 if below |

| Morale | Staff behaviour |
|---|---|
| Below 50 | **Boundaries.** They evict him from thrones and their work, and close doors behind them. |
| Below 25 | **The spray bottle.** A Scream or Knock Off is answered with a spray: he is stunned for 2 seconds and gains 25 Irritation. |
| 0 | **The Carrier.** The shift is failed. One tap restarts it. |

Each staff member scales morale losses they cause by their own multiplier (8.4).

### 8.4 The three humans

| | The Soft One | The Busy One | The Houseguest |
|---|---|---|---|
| Unprompted stroking | Every 10 to 16 s when in Routine | Never | Never |
| Notice modifier | None | −20% while working | −30% |
| Understanding modifier | −0.10 | +0.10 | −0.20 |
| Morale loss multiplier | × 0.5 | × 1.5 | × 2 |
| Compliance | Starts at 0, no cap | Starts at 0, no cap | Starts at 0, capped at 40 |
| Evicts him | Only below 50 morale | Whenever he blocks work and their Lap compliance is under 30 | Always, until Week 2's final shift |

## 9. The Brain Cell

| Parameter | Value |
|---|---|
| Away | 14 to 22 s |
| Arriving (warning) | The last 5 s of Away |
| Present | 8 to 12 s |

A shift always starts with the Brain Cell away, so a 90-second shift has about three windows.

### 9.1 Lapses

While the Brain Cell is away, each tap that tells him to move has a 12% chance of a lapse instead:

| Lapse | Effect | Length |
|---|---|---|
| Wrong spot | He goes to a different adjacent spot | The walk |
| Wall | He stops and stares at the wall | 1.5 to 2.5 s |
| Box | If the room has a box, he gets into it | 2.5 s |

Rules:

- No lapse within 6 seconds of the previous one.
- No lapse in the last 10 seconds of a shift, or during a Scheme.
- Verbs are never subject to lapses, only movement.
- A lapse does not raise Irritation. He does not notice it.
- Each staff member in the room who is not Recoiling sees it, and morale rises (8.3).
- The setting "Fewer lapses" (section 15) halves the chance.

### 9.2 Schemes

A Scheme is available only while the Brain Cell is present. Its spot glows. It consists of three prompts, tapped in turn, each taking about a second. If the Brain Cell leaves before the third, he forgets what he was doing and the Scheme resets.

| Scheme | Where | Result |
|---|---|---|
| **The treat cupboard** | Kitchen | Meets a Food demand without staff, and scores it as met twice |
| **The door handle** | Bedroom, study | Meets a Door demand without staff |
| **The plug** | Any room with the Hoover | Stops the Hoover (section 11.1) |

## 10. Thrones

- Sitting on the room's throne with attention inside the band adds to throne progress. He needs 12 seconds in total; they need not be consecutive.
- Being evicted removes 4 seconds of progress.
- A claimed throne is saved permanently and marked on the house map.
- In later shifts in the same room, sitting on a claimed throne with attention inside the band lowers Irritation at twice the usual rate.

## 11. Threats

A threat is a module with the same shape, so later weeks add one module each.

```
Threat {
  id
  start(shiftState)             when and where it appears in this shift
  step(shiftState, dt)          its effect each step
  respond(verb, target)         how the cat's verbs affect it
  isDefeated(shiftState)
}
```

### 11.1 Week 1: The Hoover

- The Busy One fetches the Hoover and cleans the room. A progress bar fills over 80 seconds of running time.
- While it runs: Irritation +6 per second, or +3 in a hide spot. The Attention Band still applies.
- **Sit On** the spot in front of it: the Hoover stops for 4 seconds, then he is moved aside. Morale −1.
- **Bite** (Outburst on the Busy One): stops for 8 seconds.
- **The plug** (Scheme): stops for 12 seconds, after which the Busy One plugs it back in, unless Temutom is sitting on the plug, in which case it stays off until he is evicted or leaves.
- **Final shift of Week 1:** the Hoover runs from the fifth second. He wins if the bar has not reached 100% when the shift's 90 seconds end.

### 11.2 Week 2: The Houseguest

- The Houseguest sits in the room and gives no attention unprompted, so attention sits low whenever the household staff are out of the room.
- The Houseguest evicts him from their lap and from the armchair, which they have taken.
- Each correct response from the Houseguest raises their Compliance as usual, up to the cap of 40.
- **Final shift of Week 2:** the cap is removed for Lap only. He wins by meeting a Lap demand on the Houseguest: 4 seconds on their lap without eviction, which requires their Lap compliance to reach 60 during the shift. Morale losses are doubled throughout.

## 12. Shifts, scoring and progress

### 12.1 Shift definition

```
Shift {
  id, week, day, slot             slot = dawn | morning | afternoon | evening | night
  room, seed, length              length defaults to 90 s
  staff[]                         who is present, with their routine
  objective
  band { halfWidth, drifts }
  demands                         a timed list, or an interval for random ones
  systems                         which gauges and verbs are switched on
  threat                          optional
  modifiers                       optional, for the Daily Grievance
}

objective = serve(n)              n demands met
          | claim                 claim this room's throne
          | train(staff, demand, level)
          | endure                threat present; finish with morale above 0
          | boss                  the threat's own win condition
```

A shift ends when its time runs out, or at once when a `claim`, `train` or `serve` objective is met and the player taps "End shift". It is failed if morale reaches 0, or if time runs out with the objective unmet. A failed shift can be restarted with one tap and costs nothing.

### 12.2 Score and stars

```
score = 40 × demands met ÷ demands issued        (40 if none were issued)
      + 30 × seconds in band ÷ shift length
      + 20 × final morale ÷ 100
      + 10 if he is on a throne when the shift ends
```

| Stars | Requirement |
|---|---|
| 1 | Objective met |
| 2 | Objective met and score of 60 or more |
| 3 | Objective met and score of 80 or more |

Thresholds can be set per shift. The balance script (section 16) checks that three stars are achievable on every shift.

### 12.3 Week 1 teaching order

Each new system first appears alone. Gauges and verbs that are not yet switched on are not drawn.

| Day | Room | Introduces | Band |
|---|---|---|---|
| 1 | Kitchen | Scream, Food, moving between spots; then Smack and unprompted stroking | Wide, still |
| 2 | Living room | Stare, Door, the matching-spot bonus; Irritation and the Outburst | Wide, still |
| 3 | Study | The Busy One; Sit On, Lap, reward and punishment; Compliance shown for the first time | Normal, drifting |
| 4 | Living room | Knock Off, Morale, thrones | Normal |
| 5 | Kitchen | The Brain Cell, lapses, the treat cupboard | Normal |
| 6 | Study, living room | Both staff together; the Hoover's first visits; hide spots | Normal |
| 7 | All three | Mixed objectives; final shift is the Hoover | Normal |

Week 2 opens the bedroom and hallway, allows two demands at once, narrows the band and introduces the Houseguest on Day 2.

### 12.4 Ranks

From total stars, of a possible 210 in v1:

| Rank | Stars |
|---|---|
| Nuisance | 0 |
| Menace | 40 |
| Despot | 90 |
| Tyrant | 140 |
| Emperor | 190 |

### 12.5 The Daily Grievance

- One shift a day, built from the date: a room, a staff routine, a demand interval and one modifier, at late Week 2 difficulty.
- Uses a fixed "daily" Compliance of 40 for all staff, so that every player faces the same shift whatever their progress.
- One scored attempt per day; further attempts are for practice.
- The result can be copied as text: *"Temutom's Daily Grievance, 16 Nov: 84. 'Door service remains poor.'"*
- A streak counts consecutive days attempted.

v1 modifiers: the bowl is half empty (Food must be met twice), bath night (the Soft One tries to pick him up every 15 seconds), the box (a box in the room; lapse chance doubled), closed doors (every door starts shut), visitors (a second Soft One).

## 13. Narrator and reviews

### 13.1 Narrator

- Lines are held in `content/` as lists keyed by event (fed, fed late, stroked too long, lapse ended, outburst, throne claimed, evicted, sprayed, and so on), with at least six lines per event.
- One line is on screen at a time, for 2.5 seconds, as a caption above the gauges. At least 6 seconds pass between lines.
- A line is not repeated until the others for that event have been used.
- No line admits fault, and no line mentions the Brain Cell.

### 13.2 Performance reviews

After each shift, one line per staff member present, chosen by their most notable figure in that shift:

| Condition | Example |
|---|---|
| Slowest response over 10 s | "Breakfast was fourteen seconds late. I have noted this." |
| Wrong responses of 2 or more | "Was asked for the door. Offered a cuddle. Unacceptable." |
| Stroked him above the band for over 8 s | "Overfamiliar." |
| Anticipated a demand | "Showed initiative. Do not let it go to your head." |
| Evicted him | "Laid hands on management." |
| Was bitten | "Was corrected. Took it poorly." |
| None of the above | "Present." |

After each day, a review card combines the five shifts: one paragraph per staff member built from the day's most frequent conditions, and a verdict from the day's average score (**Dismissed**, **Must improve**, **Adequate**, **Retained, for now**). The card is saved to the archive and can be shared as an image or as text.

## 14. Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on the kitchen at 4:50am with the Scream button pulsing. No menu. The Home screen appears after the first three shifts. |
| **Home** | Continue, Daily Grievance, House, Staff, Cabinet, Settings. Shows rank and daily streak. |
| **Week** | Seven days, each with its five shifts and their stars. |
| **Shift** | The room in the upper two-thirds. Lower third: caption line, Attention Band, Irritation gauge, Brain Cell indicator, Morale, verb arc and Scream button. The demand bubble and its patience ring sit above Temutom in the room. The objective and time remaining run along the top. |
| **Shift result** | Score, stars and the one-line reviews. Next and Retry. |
| **Day review** | The review card, with Share. |
| **House** | The map of rooms and claimed thrones; dominion as a percentage. |
| **Staff** | One file per human: compliance for each demand, and their past reviews. |
| **Cabinet** | Objects knocked off (24 kinds in v1), with those not yet found shown as outlines. |
| **Settings / Pause** | See section 15. |

Layout rules: minimum touch target 56 × 56 points; spots in the room are at least 64 points apart; all controls within the lower two-thirds of the screen, and the Scream button within the lowest quarter; safe areas respected.

### 14.1 Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Attention inside the band | Band glows; he half-closes his eyes | Purr | Continuous soft rumble |
| Attention outside the band | Marker shakes; his tail lashes | Growl rising with Irritation | None |
| Scream | Mouth open; lines radiate; staff turn | The scream, for as long as held | Continuous strong buzz |
| Staff understand | A tick above their head | Soft "oh!" | Light tick |
| Staff misunderstand | A question mark above their head | "Hm?" | None |
| Demand met | Bubble bursts into a tick | Chime | Light pulse |
| Demand expires | Bubble turns red and cracks | Hiss | Double pulse |
| Outburst | Screen edge flashes orange | Yowl, then yelp or crash | Firm pulse |
| Brain Cell arriving / present | Indicator flickers, then lights; his eyes align | Rising "ding" | Light tick |
| Lapse | His eyes drift apart; a small spiral | Hollow "bonk" or slide whistle | Light double tick |
| Throne claimed | A small crown settles on the spot | Short fanfare | Long soft pulse |
| Spray bottle | Droplets; he flattens | Spritz, outraged squeak | Sharp pulse |

Every sound has a visual equivalent, so the game is fully playable in silence. Gauges use position and shape as well as colour.

## 15. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Music, sound effects, vibration | On / Off each | On |
| Fewer lapses | On / Off | Off |
| Longer patience (demands last 35 s) | On / Off | Off |
| Larger captions | On / Off | Off |
| Reduce motion | On / Off | Follows the device |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document at the end of every shift: settings; stars and best score for each shift; Compliance for each staff member and demand; current morale; thrones claimed; cabinet contents; review archive; Daily Grievance history and streak. A shift in progress is not saved: leaving the app pauses it, and if the app is closed the shift starts again. A `version` number allows later builds to convert older saves. No personal data is collected and nothing leaves the device.

## 16. Testing

**Simulation (automated)**

- The same seed and the same inputs always give the same final state.
- Attention, Irritation, Compliance and Morale never leave their ranges.
- The band centre stays within its limits, and never moves faster than its drift speed.
- An Outburst always chooses its target in the order given in 6.4.
- The understanding probability matches 8.2 at each boundary, including the cap.
- Anticipation never happens below 60 Compliance and always happens at 90 or above when the staff member is in Routine.
- Lapses obey all five rules in 9.1.
- A Scheme resets if the Brain Cell leaves, and cannot be started while it is away.
- Each morale threshold changes staff behaviour at exactly the stated value.
- Stars follow 12.2 at each boundary.
- A save loads back to an identical state.

**Balance (script in `tools/`)**

Three scripted players run every shift 200 times each: one that only screams, one that plays sensibly, and one that plays near-perfectly. The script reports objective success rate and star distribution. Targets:

| Player | Objective met | Three stars |
|---|---|---|
| Only screams | Under 30% after Week 1, Day 2 | Never |
| Sensible | 70% to 90% | 10% to 30% |
| Near-perfect | Over 98% | Over 80% |

**Acceptance criteria for v1**

1. A new player has made Temutom scream within 5 seconds of first launch.
2. Each verb and each gauge can be learned from the shift that introduces it, without written instructions.
3. No shift can be failed solely because of lapses (verified by the balance script with lapses forced to their maximum).
4. Every shift can be completed with three stars.
5. The game is fully playable with sound and vibration off, and by a player who cannot distinguish colours.
6. The game works in aeroplane mode.
7. The simulation runs at a steady 30 steps a second, and the room draws at 60 frames a second, on the minimum phone.

## 17. Build order

| Stage | Deliverable |
|---|---|
| 1 | Simulation core with tests: attention, band, irritation, outburst, one staff member, Food demand, Scream and Smack |
| 2 | **Feel prototype** in a browser with plain shapes: the kitchen, the first three shifts. Decide whether the Attention Band is fun before going further. |
| 3 | Remaining verbs and demands, Compliance, Morale, the Busy One, thrones |
| 4 | The Brain Cell, lapses and Schemes |
| 5 | Threat framework, the Hoover, shift definitions for Week 1; balance script |
| 6 | Scoring, stars, save, narrator and reviews; Home, Week, House, Staff and Cabinet screens |
| 7 | Bedroom, hallway, the Houseguest, Week 2; the Daily Grievance; settings |
| 8 | Artwork, animation, sound and haptics |
| 9 | Android and iOS packaging |

Stages 1 to 7 need no final artwork. Stage 2 is the decision point: if keeping attention in the band is not enjoyable with plain shapes, the numbers in section 6 are changed until it is, before anything else is built.

## 18. Risks

| Risk | Mitigation |
|---|---|
| **The core does not feel good.** Unlike the puzzle games, this cannot be judged on paper. | The stage 2 prototype exists to answer this early and cheaply. |
| **Too many gauges for a small screen.** | Systems are switched on one at a time (12.3), and anything not in use is not drawn. |
| **Lapses feel unfair.** | The rules in 9.1, the morale reward, the "Fewer lapses" setting, and acceptance criterion 3. |
| **Screaming is the best answer to everything.** | Its low understanding chance, the nagging penalty, and the balance target for the scream-only player. |
| **Staff behaviour looks random.** | Every response shows a tick or a question mark, and Compliance is visible in the staff files, so the player can see why. |
| **Animation cost.** One cat with many poses, and three humans. | Staff are drawn mostly as hands, laps and legs. Temutom's poses are listed and counted before artwork starts. |
| **Age rating.** | Biting and smacking are slapstick with no injury shown. To be checked against store guidelines before artwork. |

## 19. Open questions

1. Are assumptions A1 to A6 acceptable?
2. What is the app identifier (reverse domain)?
3. Should Temutom's appearance be based on the real cat? If so, reference photographs are needed.
4. Is a 90-second shift the right length, or should shifts be closer to 60 seconds?
5. Should the staff have names, or remain "The Soft One" and "The Busy One"?
6. Is the Houseguest the right second week, or should the Dog come sooner?
