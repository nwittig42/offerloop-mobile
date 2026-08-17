import Svg, { Path } from 'react-native-svg';

/**
 * Gmail's four-colour envelope, drawn rather than pulled from an icon set.
 * MaterialCommunityIcons ships a single-colour "gmail" glyph, which is not the
 * mark Google's branding guidelines allow next to a "Connect Gmail" action.
 *
 * Official paths, viewBox 512 x 384. Do not recolour them.
 */
export default function GmailLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size * (384 / 512)} viewBox="0 0 512 384">
      <Path
        fill="#4285F4"
        d="M34.91 384h81.45V186.18L0 98.79v250.29C0 368.4 15.6 384 34.91 384z"
      />
      <Path
        fill="#34A853"
        d="M395.64 384h81.45c19.31 0 34.91-15.6 34.91-34.92V98.79l-116.36 87.39z"
      />
      <Path
        fill="#FBBC04"
        d="M395.64 34.91v151.27L512 98.79V52.36c0-43.15-49.25-67.76-83.78-41.89z"
      />
      <Path
        fill="#EA4335"
        d="M116.36 186.18V34.91L256 139.64 395.64 34.91v151.27L256 290.91z"
      />
      <Path
        fill="#C5221F"
        d="M0 52.36v46.43l116.36 87.39V34.91L83.78 10.47C49.25-15.4 0 9.21 0 52.36z"
      />
    </Svg>
  );
}
