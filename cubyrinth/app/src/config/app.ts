/**
 * App identity. "Cubyrinth" is a working title (spec §1): change DISPLAY_NAME
 * here and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Cubyrinth',
  /** Placeholder – replace with the real reverse domain (spec §14, question 2). */
  APP_ID: 'com.example.cubyrinth',
  SAVE_KEY: 'cubyrinth.save',
  SAVE_VERSION: 1,
} as const;
