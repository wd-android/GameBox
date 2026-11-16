/**
 * Every tuning constant in one place (spec §1). The screen is modelled as a 390 × 800 point
 * portrait canvas; the interface scales it to fit the device.
 */
export const SCREEN = { w: 390, h: 800 } as const;

export const TUNING = {
  dt: 1 / 30,

  hand: {
    tapMax: 0.25,
    strokeMin: 40,
    /** The spec proposes 400; real finger strokes on glass are often faster (tuned) */
    strokeMax: 600,
    stillBelow: 40,
    liftHold: 0.6,
    blinkHold: 1,
    blinkWindow: 3,
    doorSwipe: 70,
    lapHold: 4,
    wandTime: 3,
  },

  attention: {
    nothing: -3,
    rest: 5,
    head: 10,
    back: 14,
    tail: 20, tailIrr: 10,
    belly: 25, bellyIrr: 20,
    held: 20, heldIrr: 8,
    acknowledge: 6, acknowledgeEvery: 2,
    served: 10,
    blinkAnswer: 5, blinkIrr: -10,
    treat: 5,
  },

  band: {
    min: 20, max: 80,
    driftEvery: [7, 12] as [number, number],
    driftSpeed: 5,
    earlyHalfWidth: 24, earlyCentre: 55,
  },

  irritation: {
    inBand: -8,
    belowBase: 3, belowPerPoint: 0.2,
    aboveBase: 5, abovePerPoint: 0.4,
    wrongAnswer: 15,
    lifted: 30,
    schemeStopped: 10,
    challenge: 25,
  },

  mood: {
    tolerateFrom: 40,
    warningFrom: 70,
    warningLeave: 60,
    minWarning: 0.8,
    longerWarnings: 0.4,
    slowBlinkEvery: [6, 10] as [number, number],
  },

  demands: {
    interval: [14, 22] as [number, number],
    tellsFirst: 3, tellsEvery: 5, tellsFlash: 1,
    doorAfter: [6, 10] as [number, number],
    lapStay: [10, 20] as [number, number],
  },

  /** Seconds since a demand began at which each step of the ladder is reached (§8.2) */
  ladder: { near: 4, scream: 8, knockOff: 14, sitOn: 20, closeStare: 26, smack: 32, screamEvery: 3, nowFor: 1, challengeHold: 2 },

  strike: {
    swipeWindup: 0.5, swipeStrike: 0.15, swipeHitRange: 60, swipeIrrDrop: 60,
    biteWindup: 0.4, biteLockout: 1.5,
    thumbUpChore: 2,
  },

  marks: { fresh: 3, settled: 15, fading: 4, max: 6, spacing: 14, length: [180, 320] as [number, number] },

  wash: {
    colour: '#B00012',
    spread: 0.25, peak: 0.75, hold: 0.6, drain: 1.8,
    soft: { spread: 0.6, peak: 0.4, hold: 0.4, drain: 1.8 },
    /** Not tunable below 3 s (§9.3) */
    minGap: 3,
  },
  shakeMax: 8,

  plasters: { normal: 3, early: 5 },

  affection: { headButtAfter: 12, headButtIrr: -20, bellyUpAfter: 8, bellyUpChance: 0.2, bellyUpFor: 5 },

  brainCell: { away: [14, 22] as [number, number], arriving: 3, present: [8, 12] as [number, number] },
  scheme: { startChance: 0.7, stepTime: 1.5, steps: 3, lidClosed: 3 },
  lapse: { meanEvery: 18, gap: 8, prey: 2, jump: 2, box: 3, forgot: 1.5 },

  sulk: [4, 8] as [number, number],
  sitOn: [8, 14] as [number, number],
  treat: { stay: 6, perMoment: 2 },

  hoover: { irritation: 6, pushBack: 0.15 },
  guest: { every: [6, 10] as [number, number], bossEvery: 5, plasters: 2, strokeFor: [3, 6] as [number, number] },

  cat: { speed: 520 },

  scoring: { chore: 35, content: 25, firstTime: 20, plasters: 20, two: 60, three: 80 },
  narrator: { showFor: 2.5, gap: 5 },
} as const;
