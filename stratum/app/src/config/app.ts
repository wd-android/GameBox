/**
 * App identity. "Stratum" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Stratum',
  /** Placeholder – replace with the real reverse domain (spec §16, question 2). */
  APP_ID: 'com.example.stratum',
  SAVE_KEY: 'stratum.save',
  SAVE_VERSION: 1,
} as const;
