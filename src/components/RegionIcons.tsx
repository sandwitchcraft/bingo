import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The region picker's download-state glyphs. Same pictogram spec as `ItemIcons.tsx` and the
 * warning triangle in `ErrorToast.tsx` — 24px grid, single-weight 1.8 stroke, round caps, no
 * fill — so a control icon doesn't read as a different family from the item art.
 *
 * The three states the cloud/stop/check trio expresses are download-state ONLY: cloud (not
 * downloaded) → stop (downloading, tap to cancel) → check (downloaded). Which region is
 * *selected* is carried by the row's accent border and its ACTIVE label, not by an icon,
 * because the check now means "on disk" rather than "in use". `ExternalLinkIcon` sits beside
 * that slot and is a separate axis: where the rules came from, not what state they're in.
 */

type IconProps = { size: number; color: string };

const STROKE = 1.8;

function Glyph({ size, color, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Not downloaded — tap to fetch this region's rules. */
export function CloudDownloadIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M17.5 18.5a4.2 4.2 0 0 0 .4-8.4 5.6 5.6 0 0 0-10.8-1.4A3.9 3.9 0 0 0 7.5 18.5" />
      <Path d="M12 11.5v7.5" />
      <Path d="m9 16 3 3 3-3" />
    </Glyph>
  );
}

/** Downloading — a square inside a circle, the conventional "stop this transfer" target. */
export function StopCircleIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Circle cx={12} cy={12} r={9} />
      <Rect x={9} y={9} width={6} height={6} rx={1.2} />
    </Glyph>
  );
}

/**
 * Opens the region's own waste page in the browser. Deliberately the conventional
 * arrow-out-of-a-box rather than a chain link: it has to read as "this leaves the app",
 * which is the part worth warning about, not "this is a URL".
 */
export function ExternalLinkIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M14 4.5h5.5V10" />
      <Path d="M19.5 4.5 12 12" />
      <Path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </Glyph>
  );
}

/** Downloaded — the rules are on disk and this region works offline. */
export function CheckIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="m5 12.5 4.5 4.5L19 7.5" />
    </Glyph>
  );
}
