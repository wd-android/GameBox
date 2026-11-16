/**
 * Every piece of text the player sees or a screen reader speaks, in one place
 * (spec §4). The game's name is separate: it is DISPLAY_NAME in `app.ts`.
 * To translate the game, replace this object.
 */
const size = (n: number): string => `${n}×${n}`;

export const STRINGS = {
  size,

  balls: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' },
  materials: { violet: 'Amethyst', neon: 'Neon Grid' },
  stages: [
    { name: 'First Rolls', introduces: 'Rolling and gates' },
    { name: 'Dead Ends', introduces: 'Dead ends · silver ball' },
    { name: 'Holes', introduces: 'Holes · gold ball' },
    { name: 'Long Routes', introduces: 'Longer routes' },
  ],

  common: {
    home: 'Home',
    journey: 'Journey',
    dailyCube: 'Daily Cube',
    explore: 'Explore',
    settings: 'Settings',
    back: 'Back',
  },

  home: {
    tagline: 'Roll the ball across all six faces',
    coinsLabel: (coins: number) => `${coins} coins`,
    starsLabel: 'Stars',
    streakLabel: 'Streak',
    continueLevel: (id: number) => `Continue level ${id}`,
    journeyComplete: 'Journey complete',
    playLevel: (id: number) => `Play · Level ${id}`,
    dailyBest: (time: string, n: number) => `Best ${time} · ${size(n)}`,
    dailyToday: (n: number) => `Today: ${size(n)} · new every day`,
    journeyProgress: (done: number, total: number) => `${done} of ${total} levels done`,
    exploreSub: 'Unlocked sizes · no timer · no holes',
    ballTile: 'Ball',
    cubeTile: 'Cube',
  },

  ballSheet: {
    title: 'Choose a ball',
    intro: 'Faster balls score more and have shorter par times. Every ball earns its own medal.',
    ballName: (name: string) => `${name} ball`,
    stats: (speed: number, score: number) => `Speed ×${speed} · score ×${score}`,
    unlocksAt: (level: number) => `Unlocks at level ${level}`,
  },

  materialSheet: {
    title: 'Cube material',
    inUse: 'In use',
    owned: 'Owned',
    price: (coins: number) => `${coins} coins`,
    needCoins: (coins: number) => `Need ${coins} more coins`,
  },

  explore: {
    intro: 'A random cube in any unlocked size. No timer, no holes.',
    codePlaceholder: (example: string) => `e.g. ${example}`,
    codeLabel: 'Cube code',
    playCode: 'Play code',
    notACode: 'That is not a cube code',
    sizeNotInVersion: (n: number) => `${size(n)} cubes are not in this version`,
    sizeLocked: (n: number) => `Unlock ${size(n)} in the Journey first`,
    shareHint: (example: string) => `Every cube has a code like ${example} to share.`,
  },

  journey: {
    levelLabel: (id: number, open: boolean) => `Level ${id}${open ? '' : ', locked'}`,
    stageTitle: (stage: number, name: string) => `${stage}. ${name}`,
    stageProgress: (n: number, done: number, total: number) => `${size(n)} · ${done}/${total}`,
  },

  play: {
    levelTitle: (id: number, n: number) => `Level ${id} · ${size(n)}`,
    dailyTitle: (n: number) => `Daily Cube · ${size(n)}`,
    exploreTitle: (code: string) => `Explore · ${code}`,
    pause: 'Pause',
    hintTilt: 'Touch anywhere and drag to tilt the cube',
    hintStep: 'Swipe to roll the ball from cell to cell',
    hintGoal: 'Roll into the glowing gates · reach the gold cup',
    falls: (count: number) => `⤓ ${count}`,
  },

  result: {
    solved: 'Cube solved!',
    levelTitle: (id: number) => `Level ${id}`,
    stepMedal: 'Step medal earned',
    ballMedal: (name: string) => `${name} medal earned`,
    newBest: 'New best time',
    dailyNote: (best: boolean, streak: number) => `${best ? 'Best time today · ' : ''}Streak ${streak} 🔥`,
    cubeCode: (code: string) => `Cube code ${code}`,
    stepMode: 'Step mode',
    par: 'Par',
    score: 'Score',
    falls: 'Falls',
    coins: 'Coins',
    coinsEarned: (coins: number) => `+${coins}`,
    next: 'Next',
    retry: 'Retry',
    tryAgain: 'Try again',
    newCube: 'New cube',
  },

  pause: {
    title: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    tiltRadius: 'Tilt radius',
    tiltRadiusSub: 'Smaller is more sensitive',
    minimapSub: 'Applies from the next cube',
  },

  settings: {
    done: 'Done',
    control: 'Control',
    controlSub: 'Step mode earns its own medal',
    thumbTilt: 'Thumb tilt',
    step: 'Step',
    sensitivity: 'Tilt sensitivity',
    sensitivityValue: (points: number) => `${points} points for full tilt`,
    minimap: 'Mini-map',
    trail: 'Ball trail',
    music: 'Music',
    sfx: 'Sound effects',
    vibration: 'Vibration',
    reduceMotion: 'Reduce motion',
    reduceMotionSub: 'Turns become a short cross-fade',
    reset: 'Reset progress',
    resetConfirm: 'Tap again to erase everything',
    footer: (name: string, version: string) => `${name} · v${version} · saved on this device only`,
  },
} as const;
