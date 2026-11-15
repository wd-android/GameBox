/** Every tuning constant in one file (spec: "expected to change after playtesting"). */

export type BoatKind = 'fishing' | 'dinghy' | 'trawler';

export const TUNING = {
  // ── World (§5) ─────────────────────────────────────────────
  SEA_W: 12,
  SEA_H: 16,
  STRIP_H: 2,
  TICK: 1 / 60,
  /** The lighthouse lamp, bottom centre. */
  LIGHTHOUSE: { x: 6, y: 16.9 },

  // ── Beam (§6.1) ────────────────────────────────────────────
  BEAM_HALF_WIDTH: [9, 11, 13],
  BEAM_REACH: [13, 15, 17],
  BEAM_TURN: [140, 180, 230],
  BEAM_LIMIT: 80,
  /** Fog: a boat inside fog is lit only within this share of the reach (§6.2). */
  FOG_REACH_SHARE: 0.6,
  /** A boat stays alert this long after the beam leaves it (A2). */
  ALERT_SECONDS: 1,

  // ── Safe routes (§6.3) ─────────────────────────────────────
  GRID_PER_TILE: 4,
  UNSAFE_MARGIN: 0.6,
  /** Lit boats steer for a point this far ahead along the safe route. */
  ROUTE_LOOKAHEAD: 1.4,
  /** Routes keep sea room: squares closer than this to a rock cost more to cross. */
  ROUTE_ROOM: 1.6,
  ROUTE_ROOM_COST: 1.5,

  // ── Boats (§6.4) ───────────────────────────────────────────
  BOATS: {
    fishing: { speed: 1.0, turn: 90, drift: 1.0, catch: 10, firstNight: 1, name: 'Fishing boat' },
    dinghy: { speed: 1.6, turn: 140, drift: 2.0, catch: 15, firstNight: 4, name: 'Dinghy' },
    trawler: { speed: 0.7, turn: 35, drift: 0.6, catch: 35, firstNight: 8, name: 'Trawler' },
  } as Record<BoatKind, { speed: number; turn: number; drift: number; catch: number; firstNight: number; name: string }>,
  WRECK_DISTANCE: 0.35,
  CLOSE_CALL_DISTANCE: 0.8,
  CLOSE_CALL_COINS: 5,
  /** A dark boat with harm ahead within this many seconds shows the danger marker. */
  DANGER_SECONDS: 3,
  /** The edge lantern shows this long before a boat appears. */
  ARRIVAL_WARNING: 1.5,
  /** Starting headings are aimed loosely at the harbour, off by up to this much. */
  HEADING_SPREAD: 25,
  /** Seconds a boat spends within the starting beam's reach before it could come to harm in the dark. */
  FAIR_WARNING: 3.5,

  // ── A night (§6.6) ─────────────────────────────────────────
  STRIKES: 3,
  CLEAN_BONUS: 0.25,
  /** Night catches scale with night number (risk: idle earnings must not make nights pointless). */
  CATCH_PER_NIGHT: 0.02,
  MIN_ARRIVAL_GAP: 1.5,
  MAX_ON_SEA_EARLY: 4,
  MAX_ON_SEA_LATE: 6,
  FOG_DRIFT: 0.12,
  /** Clear water kept between fog and rocks the fogged beam cannot reach. */
  FOG_ROCK_ROOM: 1.2,

  // ── Controls (§7) ──────────────────────────────────────────
  DRAG_SENSITIVITY: { min: 0.3, max: 0.8, default: 0.5 },

  // ── Town (§9) ──────────────────────────────────────────────
  /** Spec: costs and earnings rise by "about 1.8" per level. Tuned against §9.5 (tools/economy.ts). */
  COST_FACTOR: 2.3,
  EARN_FACTOR: 1.5,
  MAX_LEVEL: 5,
  STORE_HOURS: 4,
  /** Fish market starts free at level 1; its later levels are priced from this. */
  FISH_MARKET_BASE_COST: 150,
  CHANDLERY_DISCOUNT: 0.1,
  UPGRADE_COSTS: {
    width: [500, 2000],
    reach: [400, 1600],
    turn: [300, 1200],
  } as Record<'width' | 'reach' | 'turn', number[]>,
} as const;

export type BuildingId = 'market' | 'smokehouse' | 'boatyard' | 'inn' | 'chandlery' | 'pier';

export const BUILDINGS: { id: BuildingId; name: string; unlock: number; cost: number; perHour: number; also: string }[] = [
  { id: 'market', name: 'Fish market', unlock: 1, cost: 0, perHour: 20, also: '' },
  { id: 'smokehouse', name: 'Smokehouse', unlock: 3, cost: 150, perHour: 30, also: '' },
  { id: 'boatyard', name: 'Boatyard', unlock: 7, cost: 400, perHour: 40, also: 'Trawlers begin arriving at night 8' },
  { id: 'inn', name: 'Inn', unlock: 12, cost: 900, perHour: 70, also: "Townspeople's requests" },
  { id: 'chandlery', name: 'Chandlery', unlock: 18, cost: 1800, perHour: 110, also: 'Lighthouse upgrades cost 10% less' },
  { id: 'pier', name: 'Pier', unlock: 25, cost: 3500, perHour: 180, also: '' },
];
