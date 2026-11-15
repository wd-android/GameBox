/**
 * Domino styles and table surfaces (§9.5). Cosmetic only. The default style
 * uses bold primary colours (§10); the UI chrome follows the Figma kit.
 */
export interface DominoStyle {
  id: string;
  name: string;
  price: number;
  colours: number[];
  player: number;
  tall: number;
  roughness: number;
  metalness: number;
  emissive: boolean;
  swatch: string;
}

export interface TableStyle {
  id: string;
  name: string;
  price: number;
  base: string;
  grain: string;
  swatch: string;
}

export const DOMINO_STYLES: DominoStyle[] = [
  { id: 'classic', name: 'Classic', price: 0, colours: [0xff4b4b, 0xffc93c, 0x3d7bff, 0x34c759], player: 0x06ffff, tall: 0x9259fe, roughness: 0.45, metalness: 0, emissive: false, swatch: 'linear-gradient(90deg,#ff4b4b,#ffc93c,#3d7bff,#34c759)' },
  { id: 'wood', name: 'Wood', price: 100, colours: [0xc58b52, 0xa86d3a, 0xd9a066], player: 0x06ffff, tall: 0x7a4a24, roughness: 0.7, metalness: 0, emissive: false, swatch: 'linear-gradient(90deg,#c58b52,#a86d3a,#d9a066)' },
  { id: 'ivory', name: 'Ivory', price: 150, colours: [0xf6f0e2, 0xece3cf], player: 0x06c8ff, tall: 0x2b2b33, roughness: 0.25, metalness: 0.05, emissive: false, swatch: 'linear-gradient(90deg,#f6f0e2,#ece3cf,#2b2b33)' },
  { id: 'neon', name: 'Neon', price: 200, colours: [0xff2fd6, 0x9259fe, 0x2f6bff], player: 0x06ffff, tall: 0xfff04d, roughness: 0.3, metalness: 0.2, emissive: true, swatch: 'linear-gradient(90deg,#ff2fd6,#9259fe,#06ffff)' },
  { id: 'sweets', name: 'Sweets', price: 300, colours: [0xff9ec7, 0xa8e6ff, 0xfff0a8, 0xc3f7b0], player: 0xff6b9a, tall: 0xb07cff, roughness: 0.35, metalness: 0, emissive: false, swatch: 'linear-gradient(90deg,#ff9ec7,#a8e6ff,#fff0a8,#c3f7b0)' },
];

export const TABLE_STYLES: TableStyle[] = [
  { id: 'oak', name: 'Violet felt', price: 0, base: '#3b1878', grain: '#4a2390', swatch: 'linear-gradient(160deg,#5b33a0,#270951)' },
  { id: 'walnut', name: 'Walnut', price: 150, base: '#5a3a24', grain: '#6b4630', swatch: 'linear-gradient(160deg,#7a5134,#3e2616)' },
];

export function dominoStyle(id: string): DominoStyle {
  return DOMINO_STYLES.find((s) => s.id === id) ?? DOMINO_STYLES[0];
}

export function tableStyle(id: string): TableStyle {
  return TABLE_STYLES.find((s) => s.id === id) ?? TABLE_STYLES[0];
}
