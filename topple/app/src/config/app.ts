/**
 * App identity. "Topple" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Topple',
  /** Reverse-domain identifier (spec §18, question 2). Also set in the native projects. */
  APP_ID: 'com.promethica.topple',
  /** Shown in Settings. Keep in step with package.json and the native projects. */
  VERSION: '0.1.0',
  /** Puzzle #1's date (spec §18, question 3 – placeholder until a launch date is chosen). */
  LAUNCH_DATE: '2026-11-15',
  SAVE_KEY: 'topple.save',
  SAVE_VERSION: 1,
} as const;
