import type { StaffId } from '../sim/types';

export interface StaffProfile {
  id: StaffId;
  name: string;
  title: string;
  /** Unprompted stroking interval, or null for never */
  strokes: boolean;
  /** Notice modifier (added to notice probability); `workingOnly` applies it only while working */
  notice: number;
  noticeWhileWorkingOnly: boolean;
  understand: number;
  moraleMult: number;
  cap: number | null;
  colour: { top: string; legs: string; skin: string; hair: string };
}

/** The household staff, now with names (open question 5). */
export const STAFF: Record<StaffId, StaffProfile> = {
  soft: {
    id: 'soft', name: 'Wendy', title: 'The Soft One', strokes: true,
    notice: 0, noticeWhileWorkingOnly: false, understand: -0.1, moraleMult: 0.5, cap: null,
    colour: { top: '#e86a9a', legs: '#5b6fb0', skin: '#f1c7a5', hair: '#8a4b2a' },
  },
  busy: {
    id: 'busy', name: 'Marcus', title: 'The Busy One', strokes: false,
    notice: -0.2, noticeWhileWorkingOnly: true, understand: 0.1, moraleMult: 1.5, cap: null,
    colour: { top: '#3f8f7a', legs: '#3a3a4a', skin: '#a8714c', hair: '#2b1d16' },
  },
  guest: {
    id: 'guest', name: 'Uncle Clive', title: 'The Houseguest Who “Isn’t a Cat Person”', strokes: false,
    notice: -0.3, noticeWhileWorkingOnly: false, understand: -0.2, moraleMult: 2, cap: 40,
    colour: { top: '#8c8c7a', legs: '#6b5a44', skin: '#e9b896', hair: '#c9c9c9' },
  },
  soft2: {
    id: 'soft2', name: 'Auntie Pat', title: 'A Visitor (Also Soft)', strokes: true,
    notice: 0, noticeWhileWorkingOnly: false, understand: -0.1, moraleMult: 0.5, cap: null,
    colour: { top: '#b884e0', legs: '#4c4c6c', skin: '#f3d0b0', hair: '#e6e6e6' },
  },
};

export const DOG = { name: 'Biscuit', title: 'The Dog' } as const;
