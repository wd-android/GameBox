/**
 * App identity. "Cubyrinth" is a working title (spec §1): change DISPLAY_NAME
 * here and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Cubyrinth',
  /** Placeholder – replace with the real reverse domain (spec §14, question 2). */
  APP_ID: 'com.example.cubyrinth',
  /** Shown in Settings. Keep in step with package.json and the native projects. */
  VERSION: '0.1.0',
  SAVE_KEY: 'cubyrinth.save',
  SAVE_VERSION: 1,
} as const;
