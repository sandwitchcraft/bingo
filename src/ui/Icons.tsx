/**
 * The functional glyph set — Lucide shapes at stroke 2.4, round caps, no fill. Only what the
 * interface needs to operate: search, camera, chevrons, close, plus, check, info, external.
 * Anything decorative is out; the lid bar (`Lid.tsx`) is the system's only illustration.
 */
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

import { iconStroke } from "@/ui/theme";

export type IconProps = { size?: number; color: string; strokeWidth?: number };

function Glyph({
  size = 18,
  color,
  strokeWidth = iconStroke,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function SearchGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Circle cx={11} cy={11} r={7} />
      <Line x1={16.5} y1={16.5} x2={21} y2={21} />
    </Glyph>
  );
}

export function CameraGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Circle cx={12} cy={13} r={4} />
      <Path d="M3 8.5h4l2-2.5h6l2 2.5h4v11H3z" />
    </Glyph>
  );
}

export function ChevronDownGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Polyline points="6 10 12 16 18 10" />
    </Glyph>
  );
}

export function ChevronRightGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Polyline points="10 6 16 12 10 18" />
    </Glyph>
  );
}

export function ChevronLeftGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Polyline points="14 6 8 12 14 18" />
    </Glyph>
  );
}

export function CloseGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Line x1={7} y1={7} x2={17} y2={17} />
      <Line x1={17} y1={7} x2={7} y2={17} />
    </Glyph>
  );
}

export function PlusGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Line x1={12} y1={6} x2={12} y2={18} />
      <Line x1={6} y1={12} x2={18} y2={12} />
    </Glyph>
  );
}

export function CheckGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Polyline points="5 13 10 18 19 7" />
    </Glyph>
  );
}

export function InfoGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Circle cx={12} cy={12} r={9} />
      <Line x1={12} y1={11} x2={12} y2={16} />
      <Line x1={12} y1={7.5} x2={12} y2={7.6} />
    </Glyph>
  );
}

/** Arrow out of a box — "opens in the browser". */
export function ExternalGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M14 4h6v6" />
      <Path d="M20 4 11 13" />
      <Path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Glyph>
  );
}

/** Crosshair-style locate glyph for "detect my location". */
export function LocateGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Circle cx={12} cy={12} r={4} />
      <Line x1={12} y1={2.5} x2={12} y2={6} />
      <Line x1={12} y1={18} x2={12} y2={21.5} />
      <Line x1={2.5} y1={12} x2={6} y2={12} />
      <Line x1={18} y1={12} x2={21.5} y2={12} />
    </Glyph>
  );
}

/** Warning triangle — the error banner. */
export function WarningGlyph(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M12 3.6 2.7 19.4a1.4 1.4 0 0 0 1.2 2.1h16.2a1.4 1.4 0 0 0 1.2-2.1z" />
      <Path d="M12 9.4v4.6" />
      <Path d="M12 17.6h.01" />
    </Glyph>
  );
}
