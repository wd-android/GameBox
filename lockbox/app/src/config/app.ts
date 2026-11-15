/**
 * App identity. "Lockbox" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Lockbox',
  /** Placeholder – replace with the real reverse domain (spec §18, question 2). */
  APP_ID: 'com.example.lockbox',
  SAVE_KEY: 'lockbox.save',
  SAVE_VERSION: 1,
} as const;
