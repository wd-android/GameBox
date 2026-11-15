/**
 * App identity. "Topple" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Topple',
  /** Placeholder – replace with the real reverse domain (spec §18, question 2). */
  APP_ID: 'com.example.topple',
  /** Puzzle #1's date (spec §18, question 3 – placeholder until a launch date is chosen). */
  LAUNCH_DATE: '2026-11-15',
  SAVE_KEY: 'topple.save',
  SAVE_VERSION: 1,
} as const;
