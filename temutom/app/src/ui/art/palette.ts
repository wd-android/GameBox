/** Warm domestic colours for the room; the orange cat must always be the brightest thing (concept §15). */
export const INK = '#2a1a12';
export const LINE = 0.9;

export const CAT = {
  base: '#ff8a1f',
  light: '#ffb25a',
  stripe: '#d4600e',
  belly: '#ffe2b8',
  nose: '#e96d7c',
  eye: '#c9e85a',
  pupil: '#1d1209',
};

export const DOG = {
  coat: '#22201f',
  sheen: '#3a3634',
  tan: '#b86a2e',
  tongue: '#ef7a8a',
  collar: '#2bb3c9',
};

export const ROOMCOL = {
  kitchen: { wall: '#e9d8b6', wall2: '#dcc7a0', floor: '#b98b5e', floor2: '#a97b50', trim: '#8b5e3c' },
  living: { wall: '#c9b7d6', wall2: '#b9a5c9', floor: '#9c7b5a', floor2: '#8c6b4a', trim: '#6e4f37' },
  study: { wall: '#b8cdb4', wall2: '#a7bea2', floor: '#8f7258', floor2: '#7f6248', trim: '#5f4632' },
  bedroom: { wall: '#d8c2b0', wall2: '#cbb39f', floor: '#a88a6f', floor2: '#987a5f', trim: '#715640' },
  hallway: { wall: '#d6c9a5', wall2: '#c8b994', floor: '#8f6a48', floor2: '#7f5a38', trim: '#5e4129' },
} as const;

export const UI = {
  bg: '#180038',
  bg2: '#2a0c5c',
  panel: '#2d1266',
  panel2: '#3f1d85',
  accent: '#00f5f5',
  accent2: '#7c4dff',
  magenta: '#e040fb',
  text: '#ffffff',
  dim: '#b8a9da',
  good: '#00f5a0',
  warn: '#ffb300',
  bad: '#ff4d6d',
};
