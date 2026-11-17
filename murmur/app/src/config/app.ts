/**
 * App identity. "Murmur" is a working title (spec §1): change DISPLAY_NAME here
 * and every visible use of the name follows.
 */
export const APP = {
  DISPLAY_NAME: 'Murmur',
  /** Reverse-domain identifier (spec §15, question 2). Also set in the native projects. */
  APP_ID: 'com.promethica.murmur',
  /** Shown in Settings. Keep in step with package.json and the native projects. */
  VERSION: '0.1.0',
  SAVE_KEY: 'murmur.save',
  SAVE_VERSION: 1,
} as const;
