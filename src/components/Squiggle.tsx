import Svg, { Path } from 'react-native-svg';

/**
 * A small hand-drawn squiggle accent, one of the character marks from the
 * Offerloop design system. Used as a brand flourish (for example under a
 * title on the share card).
 */
export function Squiggle({
  width = 64,
  height = 8,
  color = '#3B82F6',
  strokeWidth = 3,
}: {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 8" fill="none">
      <Path
        d="M2 5 C 9 1, 14 1, 20 5 S 31 9, 38 5 S 49 1, 62 5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export default Squiggle;
