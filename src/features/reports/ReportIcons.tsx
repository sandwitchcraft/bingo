/**
 * Glyphs for the report flow — the two "what's incorrect?" options and the success check.
 * Same pictogram spec as `src/features/scan/ItemIcons.tsx`: 24px grid, single-weight ~1.8px
 * stroke, round caps/joins, no fill. Kept here so the reports feature is self-contained.
 */
import Svg, { Circle, Path, Rect } from "react-native-svg";

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

/** A kerbside recycling box: lidded bin body with a handle and rib lines. */
export function RecyclingBoxIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      {/* lid */}
      <Path d="M4 7.5h16" />
      {/* handle */}
      <Path d="M9.5 5h5v2.5" />
      {/* bin body — tapered */}
      <Path d="M5.5 7.5 7 20.5h10l1.5-13" />
      {/* ribs */}
      <Path d="M9.2 10.5l.5 7" />
      <Path d="M12 10.5v7" />
      <Path d="M14.8 10.5l-.5 7" />
    </Glyph>
  );
}

/** A camera: body with a centered top bump and a lens centered in the body. */
export function CameraIcon(p: IconProps) {
  // Body spans x∈[3,21], y∈[8,19.5] → centre (12, 13.75); the lens and bump are centred on it.
  return (
    <Glyph {...p}>
      <Rect x={3} y={8} width={18} height={11.5} rx={2.4} />
      <Path d="M8.8 8l1.2-2.2h4l1.2 2.2" />
      <Circle cx={12} cy={13.75} r={3.4} />
    </Glyph>
  );
}

/** A bare check stroke — the caller wraps it in the coloured success disc. */
export function CheckIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M5 12.5l4.5 4.5L19 7" />
    </Glyph>
  );
}
