# Living with Temutom – Build Specification

*16 November 2026 · Version 0.1 · Based on the [concept design](../concepts/11-living-with-temutom.md)*

This document specifies the first playable release (v1) in enough detail to build from. Every number marked as a tuning constant lives in one configuration file and is expected to change after playtesting. This game depends on feel, and on how readable the cat is, so expect a good deal of tuning.

It is a companion to [Temutom: Staff Management](../temutom/build-specification.md) and reuses that game's model of the cat's mood. It does not depend on that game being built.

## 1. Decisions recorded

| Decision | Outcome |
|---|---|
| Title | "Living with Temutom" is a **working title**. The display name is read from one configuration value. |
| Package name | `temutom2` (confirmed 16 November 2026), used for the folder and all internal identifiers. |
| App identifier | `com.temutom2.promethica` (confirmed 16 November 2026). See section 4. |
| Separate app | This is its own app, not a mode of *Temutom: Staff Management* (confirmed 16 November 2026). |
| Red wash | The stylised wash in section 9.3 is accepted as specified, with no drips, wound or gore (confirmed 16 November 2026). |
| Claw marks | Marks do not build up over time. They fade within a moment, and those left at the end last only until the next moment starts (confirmed 16 November 2026). |
| Perspective | The player is the human, in first person. The player's thumb is the hand; no hand is drawn. |
| Screen effects | Claw marks and the red bite wash are drawn over the whole screen, including the interface. |
| The cat is never harmed | The player has no action that hurts, punishes or frightens him. |
| Technology | Same as the other games: TypeScript, Vite, React and Capacitor, for iOS and Android from one codebase. |

## 2. Assumptions to confirm

| # | Assumption | Reason |
|---|---|---|
| A1 | **Two-dimensional artwork.** The scene and the cat are drawn on one canvas; a second, transparent canvas above everything carries the screen effects; React provides menus and the small interface. No game engine. | One animated character and a handful of objects. |
| A2 | **Temutom is built from separate parts** (body pose, head, ears, eyes, tail), animated independently. | His tail, ears and eyes are the interface and must change without redrawing every pose. It also cuts the artwork needed. |
| A3 | **v1 contains Weeks 1 and 2** (70 moments). | Enough to prove every system. Later weeks each add one module and its content. |
| A4 | **Moments are written by hand** as data. | The teaching order matters too much to generate. |
| A5 | **No server, adverts, purchases or notifications in v1.** | As for the other games. |
| A6 | **The mood model is a self-contained folder** (`sim/cat/`) with no knowledge of either game, so that it can be shared with `temutom` later. | Both games use the same band, Irritation and Brain Cell. |
| A7 | **The bite is a stylised red wash, with no wound or gore shown** (confirmed 16 November 2026), and follows the flash limits in section 9.3. | Age rating and photosensitivity. |

## 3. Scope of v1

**Included**

- The hidden Attention Band, Irritation, and the full set of body-language cues
- Touch zones, stroking, the warning and the strike
- Claw marks, the bite wash, plasters
- Five demands and the escalation ladder (Stare, Scream, Knock Off, Sit On, Smack)
- Chores, treats and lifting
- The Brain Cell: three Schemes and four lapses
- Five places
- Weeks 1 (The Hoover) and 2 (The Houseguest), 35 moments each
- Stars, Standing, field notes, reviews, the cabinet, the Home screen cat
- Today's Mood
- Local save, sound, haptics, settings

**Not included (planned for later)**

- Weeks 3 to 7 and seasonal weeks
- Reminders, leaderboards, adverts, purchases

## 4. Package and project

| Item | Value |
|---|---|
| Package name | `temutom2` |
| App identifier | `com.temutom2.promethica` (confirmed 16 November 2026) |
| Display name | `Living with Temutom`, from `config/app.ts` |
| Minimum Android / iOS | 8.0 (API 26) / 15 |

**Note on the app identifier.** It is held in one configuration value and used as both the Android application ID and the Apple bundle identifier. It cannot be changed after the app is first published.

```
temutom2/
  app/
    src/
      config/     app.ts, tuning.ts, strings.ts
      sim/
        cat/      attention.ts, band.ts, irritation.ts, brainCell.ts    (shared model, A6)
        mind.ts         what he decides to do                           (section 7)
        demands.ts  escalation.ts  strike.ts  schemes.ts  lapses.ts
        hand.ts         the player's thumb as the simulation sees it
        chores.ts  difficulties/  moment.ts
      content/    places, moments, weeks, field notes, narrator and review lines   (data only)
      game/       scoring, stars, standing, today's mood
      state/      save data, settings
      ui/
        scene/    the scene canvas and the cat renderer
        effects/  the overlay canvas: claw marks, bite wash, shake
        screens/  hud/
      audio/      sound, music, haptics
    tools/        balance simulation script
    tests/
```

`sim/` must contain no user-interface code and must not read the clock or the system random function, so that a whole moment can be run and tested without a screen.

## 5. Simulation model

### 5.1 Time and randomness

- The simulation advances in fixed steps of 1/30 second. The screen draws as often as the device allows.
- All randomness comes from one seeded generator (`mulberry32`). The same seed and the same touch input always produce the same result.
- When the app goes to the background, the moment pauses.

### 5.2 The player's thumb

Each step, the interface gives the simulation one record:

```
Hand {
  down                  is the thumb on the screen
  position              where
  speed                 how fast it is moving
  over                  what is under it: a cat zone, a chore item, an object, a button, or nothing
  heldFor               how long it has been down without lifting
}
```

Only the first touch is used. Further fingers are ignored.

From this the simulation derives what the player is doing:

| Action | Recognised as |
|---|---|
| **Acknowledge** | A tap on him (down and up within 0.25 s) |
| **Stroke** | Thumb down on a cat zone and moving at between 40 and 400 points per second |
| **Rest a hand on him** | Thumb down on a cat zone and still |
| **Lift him** | Thumb held still on his body for 0.6 s, then dragged |
| **Work** | Thumb held on a chore item |
| **Serve** | The drag or swipe that meets a demand (section 8.1) |
| **Answer a slow blink** | Thumb held still on empty scene for 1 s within 3 s of his slow blink |
| **Nothing** | Thumb up |

### 5.3 State of a moment

```
MomentState {
  time
  hand                      as above
  cat {
    place                   where he is in the scene, or off screen
    activity                see section 7
    attention               0..100
    irritation              0..100
    brainCell               away | arriving | present, with time remaining
    demand                  current demand, how long it has waited, and the escalation step reached
    display                 the body-language values derived each step (section 6.4)
  }
  band { centre, halfWidth, target }
  plasters
  chore { steps[], current, progress }
  objects[]                 each: place, kind, knocked off or not
  marks[]                   claw marks currently on the screen (section 9.1)
  difficulty                the week's difficulty, if present
  tally                     seconds content, demands and first-time answers, strikes, lapses seen
}
```

### 5.4 Places

A place is a first-person background, a set of positions Temutom can occupy, the objects in it, and a chore area.

| Place | View | Demand targets | Notable features | Used from |
|---|---|---|---|---|
| Kitchen | The worktop, bowl on the floor | Bowl, back door | Treat cupboard, mug | Week 1, Day 1 |
| Study | The desk and laptop | Door, toy drawer | Keyboard, ornaments, socket | Week 1, Day 3 |
| Sofa | The player's own lap and the coffee table | Lap, toy basket | Ornament shelf, a box | Week 1, Day 4 |
| Bedroom | The bed and washing basket | Lap, door | Clean washing, door handle | Week 2, Day 1 |
| Hallway | Front door and stairs | Front door | The Hoover's cupboard | Week 2, Day 3 |

His positions in each place include **far** (small, across the room), **near** (within reach), **on the work** and **close-up** (face filling the screen).

## 6. The cat's mood

The model is the same as in the first game. The differences are that attention now comes from the player's thumb, and the result is shown only through his body.

### 6.1 Attention

Per second, while he is on screen (tuning):

| What the player is doing | Change |
|---|---|
| Nothing, or working | −3 |
| Resting a hand on him | +5 |
| Stroking the **head, cheeks or chin** | +10 |
| Stroking the **back** | +14 |
| Stroking the **tail or paws** | +20, and Irritation +10 |
| Stroking the **belly** | +25, and Irritation +20 |
| Holding him (lifted) | +20, and Irritation +8 |

| Event | Change |
|---|---|
| Acknowledge | +6 (no more than once every 2 s) |
| Serving a demand correctly | +10 |
| Answering a slow blink | +5, and Irritation −10 |

### 6.2 The band

| Parameter | Value |
|---|---|
| Half-width | 16 in Week 1, 13 in Week 2 (set per moment), plus the Standing bonus (section 13.3) |
| Centre | Between 20 and 80 |
| Drift | Every 7 to 12 seconds a new target centre is chosen; the centre moves towards it at 5 per second |

The band is wider than in the first game because the player cannot see it. The first two days of Week 1 use a half-width of 24 and a centre fixed at 55.

### 6.3 Irritation

| Situation | Change per second |
|---|---|
| Attention inside the band | −8 |
| Attention below the band | +3, plus 0.2 for each point below |
| Attention above the band | +5, plus 0.4 for each point above |
| A difficulty active | As it specifies (section 12) |

| Event | Change |
|---|---|
| A wrong answer to a demand | +15 |
| Lifted off something | +30 |
| A Scheme stopped by the player | +10 |

Too much attention irritates him faster than too little. Neglect is answered by escalation (section 8.2) before it reaches a strike.

### 6.4 Body language

Each step the simulation produces display values from his state. The renderer and the audio draw only from these, never from the hidden numbers.

| State | Condition | Tail | Ears | Eyes | Sound and haptic |
|---|---|---|---|---|---|
| **Seeking** | Attention below the band | Upright, tip hooked | Forward | Wide, following the thumb | Chirps; none |
| **Content** | Inside the band, Irritation under 40 | Still or slowly waving | Forward, relaxed | Half closed; slow blink every 6 to 10 s | Purr; soft continuous rumble |
| **Tolerating** | Above the band, or Irritation 40 to 69 | Tip flicking | Turned sideways | Open, looking at the thumb | Purr stops; rumble stops |
| **Warning** | Irritation 70 or more | Lashing | Flat | Pupils wide | Growl; faint uneven tremor |
| **Striking** | Section 9 | – | – | – | – |

Rules:

- A change of state shows within 0.2 seconds.
- **Warning** lasts at least 0.8 seconds before any strike (the fairness rule), whatever the numbers do. This minimum rises with Standing (section 13.3).
- Every state differs from its neighbours in at least two of tail, ears, eyes and sound.
- With "Mood hints" on (section 16), a small gauge shows attention and the band.

### 6.5 Touch zones

Each body pose carries a set of touch regions: head, cheeks and chin, back, belly, tail, paws. The belly is only reachable in the **belly-up** pose, which he adopts occasionally when Content. It gives no warning of its own.

## 7. The cat's mind

Unlike the first game, Temutom is not controlled by the player. Each step he is in one activity:

| Activity | Behaviour | Leaves when |
|---|---|---|
| **Away** | Off screen | The moment's script or a demand brings him in |
| **Idle** | Sits, loafs, grooms or sleeps at a position | A demand arises; attention falls below the band; the Brain Cell changes |
| **Seeking** | Comes near; walks across the work | Attention returns to the band |
| **Demanding** | Works up the escalation ladder (8.2) | The demand is met, forgotten or abandoned |
| **Accepting** | Being stroked or held | The thumb leaves, or he reaches Warning |
| **Warning** | Section 6.4 | Irritation falls below 60, or he strikes |
| **Striking** | Section 9 | The strike ends |
| **Sulking** | Turns his back, or leaves the scene for 4 to 8 s | Time passes |
| **Scheming** | Section 10.1 | Finished, stopped, or the Brain Cell leaves |
| **Lapsing** | Section 10.2 | The lapse ends |
| **Sitting on** | On the chore or a button | Lured, lifted, or 8 to 14 s pass |

Priority when more than one applies: Striking, Warning, Lapsing, Scheming, Demanding, Seeking, Idle.

## 8. Demands

### 8.1 The five demands

| Demand | Correct answer | His tells |
|---|---|---|
| **Food** | Drag a pouch from the cupboard to the bowl | Stands at the bowl; looks from bowl to player |
| **Door** | Swipe across the door to open it | Sits facing the door |
| **Lap** | Stop working; hold the thumb still on the lap area for 4 s | Stands on the player's knees; kneads |
| **Play** | Take the wand from the drawer or basket and drag it for 3 s | Crouches; rear wiggles; looks at the drawer |
| **Nothing** | Acknowledge him | Sits in the middle of the room, looking at nothing |

- A moment lists its demands with their times, or gives an interval (14 to 22 seconds) for them to be drawn at random from those its place supports.
- One demand at a time in Week 1; from Week 2 a second may be queued and starts as soon as the first is settled.
- **Any** of the five answers can be given at any time. A wrong one costs Irritation (6.3) and is recorded; he says "No."
- His tells are always truthful. In Week 1 they are held for the whole demand. From Week 2 they are shown for the first 3 seconds and then again briefly every 5 seconds.
- A Door demand that is met is followed, 6 to 10 seconds later, by one of: he goes through; he sits in the doorway for 5 seconds and then goes through; he walks away. Whichever he does, the demand counts as met.
- While a Lap demand is met he stays on the lap for 10 to 20 seconds, covering the lower part of the chore area. Chore items under him cannot be reached.

### 8.2 Escalation

An unmet demand climbs this ladder. Times are seconds since the demand began (tuning).

| From | Step | What the player sees | Effect |
|---|---|---|---|
| 0 s | **Stare (far)** | He sits and looks | None |
| 4 s | **Stare (near)** | He comes within reach | None |
| 8 s | **Scream** | Screen shakes; all interface labels read "NOW" for 1 s; repeats every 3 s | Chore progress on the current step is lost at each scream |
| 14 s | **Knock Off** | He pushes an object off a surface. If none is left, he pushes the score counter, then the plaster counter, off the bottom of the screen | A knocked-off interface element is hidden until the player taps where it fell |
| 20 s | **Sit On** | He sits on the current chore item, or on the pause button if there is no chore | The item cannot be worked |
| 26 s | **Close stare** | His face fills the screen | Nothing else can be seen or touched until he is acknowledged; this does not meet the demand |
| 32 s | **Smack** | A swipe at the screen (section 9), then the demand is abandoned and he sulks | Counts as not met |

Meeting the demand at any step ends the ladder. A close stare that is acknowledged returns him to Sit On. Holding the thumb on him during a close stare for more than 2 seconds counts as a challenge: Irritation +25.

## 9. Strikes and screen effects

### 9.1 The swipe and claw marks

A swipe is triggered when Irritation reaches 100 during Warning, or by the last step of the ladder.

```
swipe:
    wind-up 0.5 s         paw raised; unmistakable; input still accepted
    strike  0.15 s        the paw crosses the screen along a curved path
    if the thumb is down within 60 points of the path at the strike:  lose a plaster
    a claw mark is left along the path in every case
    Irritation falls by 60; Attention is set to the band centre
```

The path aims at the thumb if it is down, at where it last was if it lifted during the wind-up, and at the chore area if the thumb has been up for more than 2 seconds.

A **claw mark** is four roughly parallel tapered strokes, 14 points apart, following the path, 180 to 320 points long.

| Phase | Lasts | Appearance |
|---|---|---|
| Fresh | 3 s | Bright, sharp-edged, with a thin red edge |
| Settled | 15 s | Pale scratch with a soft dark shadow, 80% opaque |
| Fading | 4 s | Fades to nothing |

- At most 6 marks are kept; a seventh removes the oldest.
- Marks are drawn on the overlay canvas, above the scene and the interface. They do not block touches.
- The marks present when a moment ends are shown on the result screen and on the Home screen until the next moment starts.

### 9.2 The bite

A bite replaces the swipe when Irritation reaches 100 and the thumb is on his belly, tail or paws, or he is being held.

```
bite:
    wind-up 0.4 s         head turns to the thumb, mouth opens
    if the thumb is still on him at the end of the wind-up:
        lose a plaster
        red wash (9.3); one hard haptic pulse
        input is ignored for 1.5 s
        if held, he is released
    otherwise:
        he snaps at nothing; no wash; no plaster lost
    Irritation falls to 0; Attention is set to the band centre; he sulks
```

### 9.3 The red wash, and limits on flashing

The wash is a single saturated red (`#B00012`, tuning) drawn on the overlay canvas as a circle expanding from the bite point until it covers the screen.

| Stage | Standard | With "Reduce flashing" on |
|---|---|---|
| Spread to full screen | 0.25 s | 0.6 s |
| Peak opacity | 75% | 40% |
| Hold | 0.6 s | 0.4 s |
| Drain away, from the top downward | 1.8 s | 1.8 s |

Limits that apply in every mode and may not be tuned away:

- No more than one wash in any 3-second period. A second bite inside that time uses the haptic and the plaster loss only.
- No effect in the game alternates light and dark, or red and another colour, more than once per second.
- Screen shake is limited to 8 points of movement, and is replaced by a still border flash with "Reduce motion" on.
- "Reduce flashing" follows the device's own accessibility setting where one is available.

### 9.4 Plasters

- Three per moment (five on the first two days of Week 1).
- Shown as a row of plasters in the interface. Each one lost is stuck on with a small animation.
- At zero the moment ends as failed. One tap restarts it.
- The first swipe in the first moment is scripted and never costs a plaster.

### 9.5 Other screen behaviours

| Behaviour | Trigger | Effect |
|---|---|---|
| **Head-butt** | He has been Content for 12 s continuously; Standing rank of Adequate Staff or above; at most once per moment | The whole scene nudges 6 points; soft haptic thump; Irritation −20 |
| **Slow blink** | Every 6 to 10 s while Content | If answered (5.2), the bonus in 6.1 |
| **Belly-up** | 20% chance when he has been Content for 8 s | Exposes the belly zone for 5 s |

## 10. The Brain Cell

| Parameter | Value |
|---|---|
| Away | 14 to 22 s |
| Arriving | The last 3 s of Away: his eyes drift into line |
| Present | 8 to 12 s: eyes aligned, a brief glint |

A moment always starts with the Brain Cell away.

### 10.1 Schemes

When the Brain Cell becomes present and a Scheme is possible in this place, he starts it with 70% probability. A Scheme has three visible steps of about 1.5 seconds each. A tap on the object he is working on stops it. If the Brain Cell leaves first, he stops on his own and looks confused.

| Scheme | Place | If it succeeds | How it is stopped |
|---|---|---|---|
| **The treat cupboard** | Kitchen | He eats. An active Food demand is met. In moments marked "no extra food", the objective is failed. | Tap the cupboard to shut it |
| **The door handle** | Bedroom, study | The door opens. An active Door demand is met. | Tap the door to hold it |
| **The keyboard walk** | Study | The last completed chore step is undone | Tap the laptop to close the lid for 3 s, which also stops the player working |

Stopping a Scheme costs Irritation (6.3). Letting it run is often the better choice.

### 10.2 Lapses

While the Brain Cell is away, and he is Idle or Seeking, a lapse starts on average once every 18 seconds, and never within 8 seconds of the last.

| Lapse | What happens | Length |
|---|---|---|
| **The thumb is prey** | He crouches, then pounces on the thumb and pats it with a soft paw | 2 s; harmless; no mark |
| **The jump** | He misjudges a jump and slides off | 2 s |
| **The box** | If the place has a box, he gets in and cannot work out how to leave | 3 s |
| **Forgot** | During a demand below the Knock Off step, he stops, looks about, and the demand is cancelled without penalty | 1.5 s |

During any lapse, Irritation does not rise and no strike can begin. A tap on him during a lapse counts as "seen": Standing progress +1 (section 13.3) and a line from him.

## 11. Chores

All chores use one mechanism. A chore is a list of steps; each step is an item in the scene that is highlighted in turn.

- Holding the thumb on the highlighted item fills a ring over 1.5 to 3 seconds (set per step). Lifting early keeps the progress, except at a scream (8.2).
- Some steps are a drag along a marked path instead of a hold (the Hoover).
- A step cannot be worked while he is sitting on it or lying across it.

| Chore | Place | Steps |
|---|---|---|
| Make the coffee | Kitchen | Kettle, mug, jar, spoon, pour (5) |
| Write the email | Study | Six groups of keys, then Send (7) |
| Fold the washing | Bedroom | Six garments (6). A folded pile is a place he may sleep. |
| Tidy the table | Sofa | Five objects back on the shelf (5). He may knock them off again. |
| Hoover | Any | Drag the Hoover along a path through three areas (section 12.1) |

**Moving him**

| Method | How | Result |
|---|---|---|
| **Wait** | Do nothing | He leaves in 8 to 14 s |
| **Treat** | Drag one of two treats per moment to another spot | He follows it and stays there for 6 s. Attention +5. |
| **Lift** | Hold still on his body for 0.6 s, then drag him clear and let go | Immediate. Irritation +30, and the holding rates in 6.1 apply while he is carried. |

## 12. Difficulties

Each week's difficulty is a module with the same shape:

```
Difficulty {
  id
  start(momentState)
  step(momentState, dt)
  onPlayerAction(action)
  objectiveMet(momentState)
}
```

### 12.1 Week 1: The Hoover

- The chore is hoovering: drag the Hoover along a marked path. It runs only while the thumb is on it.
- While it runs: Irritation +6 per second, he leaves the Content state, and the usual attention rules are suspended.
- While it is stopped, he recovers as normal, so the player hoovers in bursts and soothes him in between.
- At Warning he attacks the Hoover, not the player: a swipe leaves a claw mark and pushes the Hoover 15% back along its path. No plaster is lost unless the thumb was on the Hoover at the strike.
- **Final moment of Week 1:** three areas in 90 seconds, each a longer path than the last.

### 12.2 Week 2: The Houseguest

- A second hand, drawn in a simple style, reaches in from the side of the screen at intervals and strokes him. It ignores every warning and goes for the belly when it is shown.
- The Houseguest's stroking counts as attention in the usual way.
- The player protects the guest by: dragging the guest's hand away (it returns after 6 to 10 s); luring him out of reach with a treat; or keeping him Content themselves so that his Irritation falls faster than the guest raises it.
- If he strikes the guest, the guest's hand withdraws with a plaster on it. The guest has two plasters.
- **Final moment of Week 2:** the guest is present throughout and reaches in every 5 seconds. The objective is to finish the chore with the guest unbitten.

## 13. Moments, scoring and progress

### 13.1 Moment definition

```
Moment {
  id, week, day, slot             slot = dawn | morning | afternoon | evening | night
  place, seed, length             60 to 90 s
  chore                           optional
  objective
  band { halfWidth, drifts }
  demands                         a timed list, or an interval for random ones
  systems                         which behaviours are switched on
  difficulty                      optional
  script                          optional fixed events, used for teaching moments
  modifiers                       optional, for Today's Mood
}

objective = finishChore
          | serve(n)              n demands met
          | content(seconds)      keep him Content for this long in total
          | survive               reach the end with a plaster left
          | boss                  the difficulty's own condition
```

A moment is failed if plasters reach zero, or if time runs out with the objective unmet. Restarting costs nothing.

### 13.2 Score and stars

```
score = 35 × chore steps done ÷ chore steps        (35 if there is no chore)
      + 25 × seconds Content ÷ seconds he was on screen
      + 20 × demands answered correctly first time ÷ demands issued   (20 if none)
      + 20 × plasters left ÷ plasters at the start
```

| Stars | Requirement |
|---|---|
| 1 | Objective met |
| 2 | Objective met and score of 60 or more |
| 3 | Objective met and score of 80 or more |

### 13.3 Standing

From total stars, of a possible 210 in v1:

| Rank | Stars | Warning lasts at least | Band half-width bonus | Unlocks |
|---|---|---|---|---|
| Intruder | 0 | 0.8 s | 0 | – |
| Staff | 40 | 0.9 s | +1 | He answers a slow blink |
| Adequate Staff | 90 | 1.0 s | +2 | The head-butt |
| Preferred Lap | 140 | 1.2 s | +3 | He sleeps on finished chores |
| "Mine" | 190 | 1.4 s | +4 | He sleeps on the player at the end of the last moment of each day |

Witnessing lapses adds a little: every 10 lapses seen counts as one extra star towards Standing, up to 10 stars.

### 13.4 Week 1 teaching order

Each new behaviour first appears alone. Interface elements not yet in use are not drawn.

| Day | Place | Introduces |
|---|---|---|
| 1 | Kitchen | Screaming and Food; stroking the head; the purr; the first, scripted swipe and claw marks |
| 2 | Kitchen | Tail and ears; the Warning; lifting the thumb in time; plasters; the belly and the bite |
| 3 | Study | Chores; one thumb for two jobs; Sit On; treats and lifting |
| 4 | Sofa | Door, Play and Nothing; reading his tells; wrong answers; Lap |
| 5 | Study, sofa | The full escalation ladder, including interface elements knocked off and the close stare |
| 6 | Kitchen, study | The Brain Cell: lapses first, then Schemes |
| 7 | All three | The Hoover; the final moment is the Hoover across three areas |

Week 2 opens the bedroom and hallway, narrows the band, shortens his tells, queues a second demand and introduces the Houseguest on Day 2.

### 13.5 Today's Mood

- One moment a day, built from the date: a place, a chore, a demand interval and one modifier, at late Week 2 difficulty.
- Uses the Intruder values for Standing, so that every player faces the same cat.
- One scored attempt per day; further attempts are for practice.
- The result can be copied as text: *"Living with Temutom, 16 Nov: 78. 'You touched the stomach.'"*
- A streak counts consecutive days attempted.

v1 modifiers: woke up wrong (band centre never above 40), needy (never below 60), it is raining (Door demands doubled, and never satisfied), the box (lapses twice as often), ravenous (Food demands only, every 10 s).

## 14. Field notes, narrator and reviews

### 14.1 Field notes

A journal of 40 entries in v1, each unlocked the first time the player meets what it describes.

| Group | Entries | Examples |
|---|---|---|
| Moods | 8 | "Tail tip flicking: stop soon." |
| Touch map | 6 | One per zone, filled in on a drawing of him as each is first stroked |
| Demands and tells | 10 | "Facing the door: the door. Having gone through the door: the door." |
| The ladder | 6 | One per escalation step |
| Lapses | 4 | "Believes the thumb to be a beetle." |
| Schemes | 3 | "Can open the cupboard. Has always been able to." |
| Affection | 3 | The slow blink, the head-butt, sleeping on the player |

Entries are written in the player's voice, not his.

### 14.2 Narrator

- His lines are held in `content/` as lists keyed by event, with at least six per event.
- One line shows at a time, for 2.5 seconds, as a caption. At least 5 seconds pass between lines, except that a line always follows a strike.
- No line admits fault, expresses affection outright, or mentions the Brain Cell.

### 14.3 Reviews

After each moment, one line chosen by the most notable thing the player did:

| Condition | Example |
|---|---|
| Bitten after touching the belly | "You touched the stomach. You know what happens when you touch the stomach." |
| Slowest demand over 14 s | "Breakfast was late. I have noted this." |
| Two or more wrong answers | "I asked for the door. I was offered a cuddle." |
| Lifted him | "Laid hands on management." |
| Stopped a Scheme | "Interfered with a private matter." |
| No plasters lost and three stars | "Adequate." |
| Saw a lapse | "You saw nothing." |
| None of the above | "Present." |

After each day, a review card combines the five moments into a paragraph and a verdict from the day's average score (**Dismissed**, **Must improve**, **Adequate**, **Retained, for now**). It is saved to the archive and can be shared as an image or as text.

## 15. Screens and rendering

### 15.1 Screens

| Screen | Contents |
|---|---|
| **First launch** | Opens directly on the dark kitchen at 4:50am with him screaming. No menu. The Home screen appears after the first three moments. |
| **Home** | The sofa, with him somewhere on it. Continue, Today's Mood, Field Notes, Reviews, Cabinet, Settings. Shows Standing and streak. |
| **Week** | Seven days, each with its five moments and their stars. |
| **Moment** | The scene fills the screen. A thin strip at the top holds the objective, time, score and plasters. Treats sit at the bottom edge. His captions appear above the treats. |
| **Moment result** | Score, stars, his one-line review. Next and Retry. Claw marks remain. |
| **Day review** | The review card, with Share. |
| **Field Notes, Reviews, Cabinet** | The collections. |
| **Settings / Pause** | See section 16. |

**The Home screen cat.** On each visit to Home there is a 30% chance that he is sitting on one of the menu buttons. That button cannot be pressed. A tap on him moves him with a 50% chance; otherwise he stays and a caption appears. He always moves after three taps or 10 seconds. He never sits on Continue or Settings.

Layout rules: minimum touch target 56 × 56 points; chore items at least 72 points apart; nothing essential in the top 15% of the screen except the status strip; safe areas respected.

### 15.2 Layers

From back to front:

1. **Scene canvas:** background, objects, Temutom, the Houseguest's hand, chore highlights.
2. **Interface (React):** status strip, treats, captions.
3. **Effects canvas:** claw marks, bite wash. Full screen, ignores touches, always on top, including over the pause button.

Scream shake is applied to layers 1 and 2 together.

### 15.3 The cat renderer

Temutom is assembled each frame from:

| Part | Variants in v1 |
|---|---|
| Body pose | Sit, loaf, stand, walk, crouch, belly-up, on-lap, sit-on-object, sleep, jump, carried, close-up (12) |
| Head | Neutral, scream, bite, eat, groom (5) |
| Ears | Forward, relaxed, sideways, flat (4) |
| Eyes | Half-closed, open, wide, pupils dilated, slow blink, aligned (Brain Cell) (6) |
| Tail | Still, wave, hooked, tip flick, lash (5, each a short loop) |
| Paw actions | Swipe left, swipe right, soft pat, push object, knead (5) |

Each body pose defines where the other parts attach and where its touch zones lie.

### 15.4 Feedback

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Content | Half-closed eyes, kneading | Purr | Soft continuous rumble |
| Leaves Content | Tail tip starts to flick | Purr stops | Rumble stops |
| Warning | Tail lash, flat ears, wide pupils | Growl | Faint uneven tremor |
| Swipe | Paw crosses the screen; claw mark | Rip | Sharp buzz |
| Bite | Red wash | Crunch, then his line | One hard pulse |
| Plaster lost | Plaster stuck onto the counter | Peel | Light tick |
| Scream | Shake; labels read "NOW" | The scream | Strong buzz for its length |
| Demand met | He turns to it at once | Chirp | Light pulse |
| Wrong answer | He looks at the player | Flat "mrrp" | Double tick |
| Interface element knocked off | It tips and falls off the bottom edge | Clatter | Light tick |
| Brain Cell arrives | Eyes align; glint | Soft "ding" | Light tick |
| Lapse | Eyes drift apart | Hollow "bonk" or slide whistle | Light double tick |
| Head-butt | Scene nudges | Soft thud | Soft thump |
| Chore step done | Item settles; tick | Click | Light tick |

Every sound has a visual equivalent, so the game is fully playable in silence.

## 16. Settings and saved data

| Setting | Values | Default |
|---|---|---|
| Music, sound effects, vibration | On / Off each | On |
| Reduce flashing | On / Off | Follows the device, otherwise Off |
| Reduce motion | On / Off | Follows the device |
| Mood hints (shows a small attention gauge) | On / Off | Off |
| Longer warnings (adds 0.4 s) | On / Off | Off |
| Larger captions | On / Off | Off |
| Left-handed layout | On / Off | Off |
| Reset progress | Button, with confirmation | – |

Saved as one JSON document at the end of every moment: settings; stars and best score for each moment; lapses seen; field notes unlocked; cabinet contents; review archive; Today's Mood history and streak; the claw marks from the last moment. A moment in progress is not saved: leaving the app pauses it, and if the app is closed the moment starts again. A `version` number allows later builds to convert older saves. No personal data is collected and nothing leaves the device.

## 17. Testing

**Simulation (automated)**

- The same seed and the same touch input always give the same final state.
- Attention and Irritation never leave their ranges; the band stays within its limits.
- **No strike ever begins without at least the minimum Warning time before it.** This is checked over 10,000 random-input moments.
- A thumb lifted before the end of a wind-up never costs a plaster.
- A swipe always leaves a mark; a missed bite never produces a wash.
- No more than 6 marks exist, and no more than one wash occurs in any 3 seconds.
- His tells always match the active demand.
- The escalation ladder reaches each step at its stated time and stops when the demand is met.
- No strike begins and Irritation does not rise during a lapse.
- A Scheme stops when tapped and when the Brain Cell leaves.
- Stars and Standing follow section 13 at each boundary.
- A save loads back to an identical state.

**Balance (script in `tools/`)**

Three scripted players run every moment 200 times each: one that only works and ignores him, one that reads him sensibly, and one that reads him near-perfectly.

| Player | Objective met | Three stars |
|---|---|---|
| Ignores him | Under 30% after Week 1, Day 3 | Never |
| Sensible | 70% to 90% | 10% to 30% |
| Near-perfect | Over 98% | Over 80% |

**Readability (with people, at stage 2 and again with artwork)**

- Shown each mood state for two seconds with the sound off, at least 8 of 10 new players name it correctly from a list.
- At least 8 of 10 new players lift their thumb in time on their third Warning.

**Acceptance criteria for v1**

1. A new player has fed him within 10 seconds of first launch.
2. Each behaviour can be learned from the moment that introduces it, without written instructions.
3. Every plaster lost can be traced by the player to something they did or failed to do; none is lost during a lapse or without a Warning.
4. Every moment can be completed with three stars.
5. The flash limits in 9.3 hold in every mode.
6. The game is fully playable with sound and vibration off, and by a player who cannot distinguish colours.
7. The game works in aeroplane mode.
8. Touch to visible response takes under 50 milliseconds on the minimum phone, and the effects canvas does not lower the frame rate below 60.

## 18. Build order

| Stage | Deliverable |
|---|---|
| 1 | Mood model (`sim/cat/`) and the thumb model, with tests |
| 2 | **Feel prototype** in a browser on a phone, with plain shapes: one cat built from parts, stroking, the five mood states, the Warning, the swipe with claw marks, the bite with the red wash, plasters. Run the readability test. |
| 3 | Demands, tells and the escalation ladder; the kitchen; Food |
| 4 | Chores, Sit On, treats and lifting; the study |
| 5 | The remaining demands; the sofa; the Brain Cell, lapses and Schemes |
| 6 | Difficulty framework and the Hoover; moment definitions for Week 1; balance script |
| 7 | Scoring, stars, Standing, save; narrator, reviews, field notes; Home and collection screens |
| 8 | Bedroom, hallway, the Houseguest, Week 2; Today's Mood; settings |
| 9 | Artwork, animation, sound and haptics; second readability test |
| 10 | Android and iOS packaging |

Stage 2 is the decision point. If players cannot read him, or do not laugh when he strikes, the cues and timings in sections 6 and 9 are changed until they do, before anything else is built.

## 19. Risks

| Risk | Mitigation |
|---|---|
| **His mood cannot be read.** | Two cues per state; the readability tests; the "Mood hints" setting; teaching one cue at a time. |
| **Losing a plaster feels unfair.** | The minimum Warning, tested automatically; the escape during wind-up; acceptance criterion 3. |
| **Being attacked is irritating, not funny.** | His line after every strike; instant restart; the first swipe is free; tested at stage 2. |
| **Photosensitivity.** | The fixed limits in 9.3; "Reduce flashing" follows the device. To be reviewed against platform accessibility guidance before release. |
| **Claw marks are taken for real damage.** | Cartoon styling; they fade; they appear only with his paw visibly crossing the screen. |
| **Marks and washes hide the game.** | Marks do not block touches; six at most; they fade in about 20 seconds. |
| **Animation cost.** | The cat is built from parts (A2): about 37 pieces in place of several hundred whole poses. |
| **Perceived cruelty to the cat.** | The player has no harmful action (section 1). Lifting is the roughest thing they can do, and he repays it. |
| **Age rating.** | Stylised red with no wound. To be checked against store guidelines before artwork. |

## 20. Open questions

1. Are assumptions A1 to A6 acceptable? (A7, the red wash, is confirmed.)
2. Should Temutom's appearance be based on the real cat? If so, reference photographs are needed, particularly of his tail, ears and eyes in different moods.
