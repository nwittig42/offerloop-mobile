import { useTheme } from '@/theme/ThemeProvider';

/**
 * Scout's room, in both lights. The Scout tab used to be night-only; it
 * follows the app-wide Light/Dark setting like every other screen now (Rylan
 * 2026-08-17: the app should read as one place, not one dark island).
 *
 * Same keys in both palettes, so a screen reads `room.x` and never asks which
 * mode it is in. Day is the app's light tokens (surface, ink, slate accent);
 * night is the original deep-navy room. Lives here rather than inside the tab
 * so the chat pieces in components/scout can dress themselves.
 */
export const NIGHT = {
  bg: '#0C1526',
  sky: '#12203A',
  deep: '#0A111F',
  ink: '#EAF0FF',
  ink2: '#8FA3CC',
  ink3: '#5A6B8F',
  line: 'rgba(160,190,255,0.25)',
  lineSoft: 'rgba(160,190,255,0.14)',
  accent: '#3B82F6',
  /** The send / mic / stop button. One bright blue in BOTH modes (Rylan
   *  2026-08-17, picked off a reference): it is the only always-on control on
   *  the screen, so it should not dim into the slate accent in light mode. */
  action: '#3B82F6',
  transcript: '#DCE6FF',
  /** Raised card / input fills. On night these are white veils over the sky;
   *  on day they are actual paper, because a white veil over a white sky is
   *  nothing at all. */
  card: 'rgba(255,255,255,0.07)',
  cardSoft: 'rgba(255,255,255,0.04)',
  field: 'rgba(255,255,255,0.06)',
  /** The panel behind the first-run intro, and the scrim under it. */
  panel: '#12203A',
  scrim: 'rgba(10,17,31,0.88)',
  /** Full-screen overlay ground (chat history). */
  overlay: 'rgba(10,13,22,0.97)',
  /** Live-work accents: spinner, stage line, "Scout's waiting on you". */
  live: '#9DB4FF',
  note: '#B9C8EE',
  track: 'rgba(160,190,255,0.18)',
  /** Blue tints shared by chips, variant rows and the user's own chat
   *  bubbles. Kept as tints of the same blue in both modes so Scout's chips
   *  stay Scout's chips. */
  tint: 'rgba(59,130,246,0.18)',
  tintStrong: 'rgba(59,130,246,0.28)',
  tintLine: 'rgba(91,123,255,0.5)',
};

export type ScoutRoom = typeof NIGHT;

export const DAY: ScoutRoom = {
  // Flat in light mode (Rylan 2026-08-17): the blue daylight wash read as a
  // stray tint on a screen that is otherwise the app's plain light ground.
  // Same value in all three gradient stops, so the sky draws as one surface.
  bg: '#F5F6F8',
  sky: '#F5F6F8',
  deep: '#F5F6F8',
  ink: '#111318',
  ink2: '#4A4F5B',
  ink3: '#8A8F9A',
  line: 'rgba(30,45,77,0.20)',
  lineSoft: 'rgba(30,45,77,0.14)',
  accent: '#4A60A8',
  action: '#3B82F6',
  transcript: '#1E2D4D',
  card: '#FFFFFF',
  cardSoft: '#FFFFFF',
  field: '#FFFFFF',
  panel: '#FFFFFF',
  scrim: 'rgba(30,45,77,0.45)',
  overlay: 'rgba(245,246,248,0.98)',
  live: '#4A60A8',
  note: '#4A4F5B',
  track: 'rgba(30,45,77,0.14)',
  tint: 'rgba(74,96,168,0.12)',
  tintStrong: 'rgba(74,96,168,0.18)',
  tintLine: 'rgba(74,96,168,0.45)',
};

/** The palette matching the user's current Light/Dark choice. */
export function useScoutRoom(): ScoutRoom {
  const { scheme } = useTheme();
  return scheme === 'dark' ? NIGHT : DAY;
}
