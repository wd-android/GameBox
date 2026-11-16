/** The two cube materials in v1 (§3). Colours follow the Figma style guide. */
export type MaterialId = 'violet' | 'neon';

export interface CubeMaterial {
  id: MaterialId;
  name: string;
  price: number;
  floor: string;
  floorAlt: string;
  floorRoughness: number;
  wall: number;
  wallEmissive: number;
  wallEmissiveIntensity: number;
  swatch: string;
}

export const MATERIALS: Record<MaterialId, CubeMaterial> = {
  violet: {
    id: 'violet',
    name: 'Amethyst',
    price: 0,
    floor: '#5b33a0',
    floorAlt: '#53308f',
    floorRoughness: 0.75,
    wall: 0xf1ecff,
    wallEmissive: 0x000000,
    wallEmissiveIntensity: 0,
    swatch: 'linear-gradient(160deg,#5b33a0,#270951)',
  },
  neon: {
    id: 'neon',
    name: 'Neon Grid',
    price: 300,
    floor: '#160536',
    floorAlt: '#1c0842',
    floorRoughness: 0.35,
    wall: 0x0a3a44,
    wallEmissive: 0x06ffff,
    wallEmissiveIntensity: 0.55,
    swatch: 'linear-gradient(160deg,#160536,#06ffff)',
  },
};

export const MATERIAL_ORDER: MaterialId[] = ['violet', 'neon'];
