/**
 * Every tuning constant in one place (spec §1). Expect these to change after playtesting.
 * Room space is 100 units wide and 130 units tall. One "spot-width" is SPOT_WIDTH units.
 */
export const SPOT_WIDTH = 14;

export const TUNING = {
  dt: 1 / 30,
  shiftLength: 90,

  cat: {
    speed: 4 * SPOT_WIDTH, // units per second
    adjacent: 26, // distance at which he can smack / bite
  },
  staffSpeed: 42,

  attention: {
    empty: -4,
    busy: -1.5,
    /** He is sitting on their lap: they look at him and give the odd absent-minded pat */
    lap: 4,
    looking: 3,
    talking: 6,
    stroking: 12,
    holding: 20,
  },

  band: {
    min: 25,
    max: 75,
    driftEvery: [8, 14] as [number, number],
    driftSpeed: 5,
  },

  irritation: {
    inBand: -8,
    outBase: 4,
    outPerPoint: 0.15,
    demandExpired: 20,
    sprayed: 25,
    deliberateMin: 50,
    deliberateDrop: 50,
  },

  outburst: {
    duration: 1.5,
    bite: -12,
    swipe: -6,
    zoomies: -2,
    biteRecoil: 8,
    biteCompliance: 2,
  },

  demands: {
    patience: 25,
    longPatience: 35,
    interval: [12, 20] as [number, number],
    putBackDelay: [10, 16] as [number, number],
  },

  verbs: {
    scream: { minHold: 1, notice: 0.9, understand: 0.3, nagWindow: 20, nagFree: 3, nagMorale: -1 },
    stare: { time: 2, notice: 0.5, noticeIdle: 0.8, understand: 0.55 },
    smack: { morale: -3, recoil: 6 },
    sitOn: { understand: 0.4, morale: -1 },
    knockOff: { time: 0.5, understand: 0.2, morale: -4, moraleBreakable: -8 },
    matchingSpotBonus: 0.25,
    complianceWeight: 0.5,
    understandCap: 0.95,
    punishWindow: 4,
    rewardWindow: 6,
  },

  staff: {
    respondAct: [2, 4] as [number, number],
    strokeTime: [5, 9] as [number, number],
    holdTime: 4,
    askTime: 3,
    evictTime: 1.5,
    sprayTime: 1,
    evictCooldown: 8,
    softStrokeEvery: [10, 16] as [number, number],
    lapSitTime: 14,
    lapHold: 4,
    adjoiningNotice: 0.7,
  },

  compliance: {
    correct: 6,
    rewarded: 5,
    punished: 3,
    anticipateMin: 60,
    anticipateFull: 90,
    anticipateWithin: 5,
    busyEvictLapBelow: 30,
    guestCap: 40,
  },

  morale: {
    start: 70,
    lapsePerWitness: 3,
    lapInBandPerSecond: 1,
    betweenShifts: 10,
    newDayFloor: 60,
    boundaries: 50,
    spray: 25,
    sprayStun: 2,
    doorCloseEvery: 10,
  },

  brainCell: {
    away: [14, 22] as [number, number],
    arrivingWarning: 5,
    present: [8, 12] as [number, number],
  },

  lapse: {
    chance: 0.12,
    gap: 6,
    noneInLast: 10,
    wall: [1.5, 2.5] as [number, number],
    box: 2.5,
  },

  scheme: { steps: 3, stepTime: 1 },

  throne: { need: 12, evictLoss: 4, claimedIrritationFactor: 2 },

  hoover: {
    runToFinish: 80,
    irritation: 6,
    irritationHidden: 3,
    sitStop: 4,
    biteStop: 8,
    plugStop: 12,
    sitMorale: -1,
  },

  dog: {
    wanderEvery: [3, 6] as [number, number],
    sprawlChance: 0.3,
    sprawlTime: [8, 12] as [number, number],
    fussFavourPerSecond: 4,
    ateFavour: 12,
    smackFavour: -10,
    smackMorale: -2,
    smackDaze: 6,
    stareTilt: 6,
    screamFlee: 4,
    tailEvery: [6, 10] as [number, number],
    tailChance: 0.35,
    tailMorale: -2,
    sniffIrritation: 3,
    sniffRange: 22,
    distractChance: 0.4,
    softGoesToDog: 0.5,
    speed: 50,
  },

  scoring: { demands: 40, band: 30, morale: 20, throne: 10, twoStars: 60, threeStars: 80 },

  narrator: { showFor: 2.5, gap: 6 },
} as const;

export type Range = readonly [number, number];
