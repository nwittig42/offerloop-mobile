import { Platform, type TextStyle } from 'react-native';

/**
 * Kill the browser's own focus ring on text fields.
 *
 * react-native-web renders TextInput as a real <input>, so Chrome paints its
 * default focus outline on top of ours: a hard blue rounded rectangle, drawn
 * inside our own border, at a radius that matches nothing else on screen. It
 * never ships to a phone, but the browser preview is where this app is
 * designed, so it is the version everyone actually looks at.
 *
 * ACCESSIBILITY: only ever apply this to a field that draws its OWN visible
 * focus state. Removing the ring from a field with no focus styling of its
 * own strands keyboard users with no way to see where they are (WCAG 2.4.7).
 * Both current callers change their border colour on focus.
 */
export const NO_WEB_FOCUS_RING =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
