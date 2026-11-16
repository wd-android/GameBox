/**
 * Field notes (§14.1): 40 entries in the player's own voice, each unlocked the first time
 * the player meets what it describes. The `id` matches the note keys the simulation records.
 */
export interface FieldNote { id: string; group: string; title: string; text: string }

const N = (group: string, id: string, title: string, text: string): FieldNote => ({ id, group, title, text });

export const FIELD_NOTES: FieldNote[] = [
  // Moods (8)
  N('Moods', 'mood-seeking', 'Wide eyes, tail up and hooked', 'Wants attention. Following my thumb with his eyes. Acknowledge him.'),
  N('Moods', 'mood-content', 'Purring, eyes half closed', 'Just right. Carry on exactly as I am. Do not get ambitious.'),
  N('Moods', 'mood-tolerating', 'Tail tip flicking, ears sideways', 'Stop soon. The purr has stopped. That is the first sign.'),
  N('Moods', 'mood-warning', 'Tail lashing, ears flat, pupils huge', 'Take my thumb away. Now. Not in a second. Now.'),
  N('Moods', 'mood-swipe', 'The swipe', 'If my thumb was under the paw, it costs a plaster. The marks fade.'),
  N('Moods', 'mood-bite', 'The bite', 'Everything goes red. Only if my thumb was still on him.'),
  N('Moods', 'love-blink', 'The slow blink', 'He closed his eyes at me, slowly. Resting my thumb still on an empty bit of screen answers it.'),
  N('Moods', 'love-blinkAnswered', 'Blinking back', 'I answered. He calmed down. Neither of us mentioned it.'),
  // Touch map (6)
  N('Touch map', 'zone-head', 'Head, cheeks and chin', 'Safe. The best place.'),
  N('Touch map', 'zone-back', 'Back', 'Acceptable for a while. Builds up quickly.'),
  N('Touch map', 'zone-tail', 'Tail', 'Not for me. Irritates him fast.'),
  N('Touch map', 'zone-paws', 'Paws', 'Absolutely not.'),
  N('Touch map', 'zone-belly', 'The belly', 'Displayed invitingly. Gives no warning of its own.'),
  N('Touch map', 'zone-bellyTrap', 'The belly, again', 'It is a trap. It is always a trap.'),
  // Demands and tells (10)
  N('Demands', 'tell-food', 'Standing by the bowl', 'Looks from the bowl to me and back. Food: drag the pouch to the bowl.'),
  N('Demands', 'tell-door', 'Sitting facing the door', 'The door. Having gone through the door: the door.'),
  N('Demands', 'tell-lap', 'Kneading my knees', 'Lap. Stop working, hold my thumb still on my lap.'),
  N('Demands', 'tell-play', 'Crouched, rear wiggling', 'Looking at the toy drawer. Drag the wand for him.'),
  N('Demands', 'tell-nothing', 'Staring at nothing', 'Wants nothing. Is merely screaming. Tap him.'),
  N('Demands', 'met-food', 'Fed', '“Adequate.” High praise.'),
  N('Demands', 'met-door', 'Door opened', 'He may go through it. He may sit in it. He may walk away.'),
  N('Demands', 'met-lap', 'Lap provided', 'Now I work around him. The bottom of the screen is his.'),
  N('Demands', 'met-play', 'Played', 'He hunted the feather. He enjoyed none of it, apparently.'),
  N('Demands', 'met-nothing', 'Acknowledged', 'That was all he wanted. A tap.'),
  // The ladder (6)
  N('The ladder', 'ladder-stareNear', 'He comes closer', 'Unanswered, he stares. Then comes within reach.'),
  N('The ladder', 'ladder-scream', 'The scream', 'The screen shakes. Everything reads NOW. My work on that step is lost.'),
  N('The ladder', 'ladder-knockOff', 'Knocked off', 'An ornament. Then the mug. Then the score itself. Tap where it fell.'),
  N('The ladder', 'ladder-sitOn', 'Sat on', 'He sits on the thing I need. A treat moves him. So does lifting, if I want to suffer.'),
  N('The ladder', 'ladder-closeStare', 'The close stare', 'His face fills the screen. Tap him. Do not hold his gaze.'),
  N('The ladder', 'ladder-smack', 'The smack', 'Ignored for half a minute, he swipes and sulks.'),
  // Lapses (4)
  N('Lapses', 'lapse-prey', 'The thumb is prey', 'Believes the thumb to be a beetle. Harmless.'),
  N('Lapses', 'lapse-jump', 'The jump', 'Misjudged the jump. The worktop moved. I moved it, apparently.'),
  N('Lapses', 'lapse-box', 'The box', 'Got into a box. Could not work out how to leave.'),
  N('Lapses', 'lapse-forgot', 'Forgot', 'Stopped mid-scream. Looked about. Forgot what he wanted.'),
  // Schemes (3)
  N('Schemes', 'scheme-treats', 'The treat cupboard', 'Can open the cupboard. Has always been able to.'),
  N('Schemes', 'scheme-doorHandle', 'The door handle', 'Works the handle when his eyes line up. Hangs off it.'),
  N('Schemes', 'scheme-keyboard', 'The keyboard walk', 'Walks across the keyboard and undoes my last step. Deliberately.'),
  // Affection (3)
  N('Affection', 'love-headbutt', 'The head-butt', 'Bumped the screen with his forehead. Nothing was said about it.'),
  N('Affection', 'love-pile', 'The clean pile', 'Fell asleep on the washing I had just folded.'),
  N('Affection', 'love-sleep', 'Asleep on me', 'At the end of the day he slept on me. I did not move for an hour.'),
];

export const NOTE_GROUPS = ['Moods', 'Touch map', 'Demands', 'The ladder', 'Lapses', 'Schemes', 'Affection'];
