import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The region picker's download-state glyphs. Same pictogram spec as `ItemIcons.tsx` and the
 * warning triangle in `ErrorToast.tsx` — 24px grid, single-weight 1.8 stroke, round caps, no
 * fill — so a control icon doesn't read as a different family from the item art.
 *
 * The three states the cloud/stop/check trio expresses are download-state ONLY: cloud (not
 * downloaded) → stop (downloading, tap to cancel) → check (downloaded). Which region is
 * *selected* is carried by the row's accent border and its ACTIVE label, not by an icon,
 * because the check now means "on disk" rather than "in use". `ExternalLinkIcon` and
 * `HeartIcon` sit beside that slot and are separate axes: where the rules came from, and
 * whether the user has pinned the row — neither is a download state.
 */

type IconProps = { size: number; color: string };

const STROKE = 1.8;

function Glyph({
  size,
  color,
  filled,
  children,
}: IconProps & { filled?: boolean; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      // Outline is the house style; `filled` exists for the one glyph that carries an on/off
      // state in its own shape rather than in a neighbouring label (the heart).
      fill={filled ? color : "none"}
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
 * Opens the region's own waste page in the browser. A chain-link (🔗): two interlocking
 * rounded links on the 24px grid, reading straightforwardly as "this is a URL to follow".
 */
export function ExternalLinkIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <Path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L11.5 17" />
    </Glyph>
  );
}

/**
 * Favourite — pins a region to the top of the picker. A third axis alongside the two above:
 * not where the rules came from (link), not what state they're in (cloud/stop/check), just
 * where the user wants this row to sit. Hollow when off, filled when on, because it's the
 * only glyph here whose own shape has to carry an on/off state.
 */
export function HeartIcon(p: IconProps & { filled?: boolean }) {
  return (
    <Glyph {...p}>
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
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
