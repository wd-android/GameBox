import type { ShiftState, StaffState, TargetRef, ThreatSpec, ThreatState, Verb } from '../types';
import { hoover } from './hoover';
import { dog } from './dog';
import { guest } from './guest';

/**
 * Every threat has the same shape (spec §11), so later weeks add one module each.
 */
export interface ThreatModule {
  id: ThreatSpec['id'];
  start(s: ShiftState, t: ThreatState): void;
  /** Effect each step. Returns the Irritation added per second. */
  step(s: ShiftState, t: ThreatState, dt: number): number;
  /** How the cat's verbs (and other events) affect it */
  respond(s: ShiftState, t: ThreatState, verb: Verb | 'bite' | 'dogPos' | 'scheme', target: TargetRef): unknown;
  isDefeated(s: ShiftState, t: ThreatState): boolean;
  hook?(s: ShiftState, t: ThreatState, name: string, m: StaffState, dt?: number): unknown;
  blocksSpot?(s: ShiftState, t: ThreatState, spotId: string): boolean;
  noticeAllowed?(s: ShiftState, t: ThreatState, m: StaffState, verb: Verb): boolean;
}

export const THREATS: Record<ThreatSpec['id'], ThreatModule> = { hoover, dog, guest };

export function threatStart(s: ShiftState) {
  if (s.threat) THREATS[s.threat.id].start(s, s.threat);
}

export function threatStep(s: ShiftState, dt: number): number {
  if (!s.threat) return 0;
  return THREATS[s.threat.id].step(s, s.threat, dt);
}

export function threatRespond(s: ShiftState, verb: Verb | 'bite' | 'dogPos' | 'scheme', target: TargetRef): unknown {
  if (!s.threat) return null;
  return THREATS[s.threat.id].respond(s, s.threat, verb, target);
}

export function threatHook(s: ShiftState, name: string, m: StaffState, dt?: number): unknown {
  if (!s.threat) return null;
  return THREATS[s.threat.id].hook?.(s, s.threat, name, m, dt) ?? null;
}

export function threatBlocksSpot(s: ShiftState, spotId: string): boolean {
  if (!s.threat) return false;
  return THREATS[s.threat.id].blocksSpot?.(s, s.threat, spotId) ?? false;
}

export function threatStaffNotice(s: ShiftState, m: StaffState, verb: Verb): boolean {
  if (!s.threat) return true;
  return THREATS[s.threat.id].noticeAllowed?.(s, s.threat, m, verb) ?? true;
}

export function threatDefeated(s: ShiftState): boolean {
  if (!s.threat) return false;
  return THREATS[s.threat.id].isDefeated(s, s.threat);
}
