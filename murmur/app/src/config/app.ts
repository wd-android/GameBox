/**
 * App identity. "Murmur" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Murmur',
  /** Placeholder – replace with the real reverse domain (spec §15, question 2). */
  APP_ID: 'com.example.murmur',
  SAVE_KEY: 'murmur.save',
  SAVE_VERSION: 1,
} as const;
