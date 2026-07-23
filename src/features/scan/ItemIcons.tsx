/**
 * Item artwork for the scan result sheet: one glyph per item category, plus the tinted
 * bin-coloured badge they sit in.
 *
 * Icons are looked up by item key with a generic fallback, so an item the region rules name
 * but this file has no drawing for still renders. Same pictogram spec as `TabIcons.tsx` and
 * `RegionIcons.tsx` — 24px grid, single-weight stroke, round caps, no fill.
 */
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { binColor, binTint, type BinType } from "@/core/bins";
import { radii } from "@/ui/theme";

type IconProps = { size: number; color: string };

// Brand pictogram style: single-weight line, ~1.8px stroke on a 24px grid, round
// caps/joins, no fill. Shared here so every item icon stays on the same weight.
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

function BottleIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M10 2.5h4v2h-4z" />
      <Path d="M10 4.5v2.2c0 .8-.4 1.3-1 1.9-1 .9-1.5 1.9-1.5 3.2v8.2a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-8.2c0-1.3-.5-2.3-1.5-3.2-.6-.6-1-1.1-1-1.9V4.5" />
      <Path d="M7.5 13.5h9" />
    </Glyph>
  );
}

function CanIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Rect x={7} y={2.8} width={10} height={18.4} rx={2.6} />
      <Path d="M7 6.8h10" />
      <Path d="M7 17.2h10" />
    </Glyph>
  );
}

function JarIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Rect x={8} y={2.5} width={8} height={3} rx={1} />
      <Path d="M8.6 5.5v2.2c0 .6-.3 1.1-.8 1.5A3 3 0 0 0 6.6 12v7.4a2 2 0 0 0 2 2h6.8a2 2 0 0 0 2-2V12a3 3 0 0 0-1.2-2.8c-.5-.4-.8-.9-.8-1.5V5.5" />
    </Glyph>
  );
}

function WrapperIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Rect x={8} y={6.5} width={8} height={11} rx={1.5} />
      <Path d="M8 9.5 4 6.5v11l4-3" />
      <Path d="M16 9.5l4-3v11l-4-3" />
    </Glyph>
  );
}

function PaperIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" />
      <Path d="M14 2.5v5h5" />
      <Path d="M8.5 12.5h7" />
      <Path d="M8.5 16.5h7" />
    </Glyph>
  );
}

function StyrofoamIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Rect x={4.5} y={3.5} width={15} height={3.4} rx={1} />
      <Path d="M6.6 6.9h10.8l-1.1 12.3a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8z" />
    </Glyph>
  );
}

function FoodWasteIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M12 21.2c-3 0-5.4-3.4-5.4-7.5 0-3.6 2-5.6 4.4-5.6.5 0 1 .1 1 .1s.5-.1 1-.1c2.4 0 4.4 2 4.4 5.6 0 4.1-2.4 7.5-5.4 7.5z" />
      <Path d="M12 8.2V5" />
      <Path d="M12.3 5.4c.5-1.3 1.8-2 3-1.9.1 1.3-.7 2.5-2 2.9" />
    </Glyph>
  );
}

function PlasticBagIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M5.6 8h12.8l-1 12.4a1.5 1.5 0 0 1-1.5 1.4H8.1a1.5 1.5 0 0 1-1.5-1.4z" />
      <Path d="M9 8V5.6a3 3 0 0 1 6 0V8" />
    </Glyph>
  );
}

function DiaperIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M4.5 6.5h15V10c0 4.4-3.4 8-7.5 8s-7.5-3.6-7.5-8z" />
      <Path d="M9 15.2c2-1 4-1 6 0" />
    </Glyph>
  );
}

function BatteryIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Rect x={2.8} y={7.4} width={15.4} height={9.6} rx={2.4} />
      <Path d="M21.2 11v3" />
      <Path d="M11.9 9.7 9.7 13.3h3.2l-2.2 3.4" />
    </Glyph>
  );
}

function GenericIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <Path d="M20.5 7.6 12 3 3.5 7.6v8.8L12 21l8.5-4.6z" />
      <Path d="M3.5 7.6 12 12.2l8.5-4.6" />
      <Path d="M12 21v-8.8" />
    </Glyph>
  );
}

// Covers the current Toronto item set; anything unmapped falls back to a generic box.
// Keyed by bingoDB item key (kebab-case), which is also what the classifier's classes
// resolve to — so the keys below are the ones a live scan and a region rule both produce.
// Several categories share a glyph on purpose: the pictogram names the material, and a
// styrofoam cup and a styrofoam takeout container are the same material story.
const ITEM_ICON: Record<string, (p: IconProps) => React.ReactElement> = {
  "aluminum-can": CanIcon,
  "apple-core": FoodWasteIcon,
  "cardboard-box": PaperIcon,
  "cardboard-takeout-container": PaperIcon,
  "disposable-batteries": BatteryIcon,
  "glass-bottle": JarIcon,
  "paper-cup": PaperIcon,
  "paper-printer": PaperIcon,
  "plastic-bottle": BottleIcon,
  "styrofoam-cup": StyrofoamIcon,
  "styrofoam-takeout-container": StyrofoamIcon,

  // Legacy snake_case keys. History rows written before bingoDB's 2026-07-22 kebab-case
  // switch still carry these, and the History screen looks up icons by the stored key.
  plastic_bottle: BottleIcon,
  aluminum_can: CanIcon,
  glass_jar: JarIcon,
  wrapper: WrapperIcon,
  printer_paper: PaperIcon,
  styrofoam: StyrofoamIcon,
  food_waste: FoodWasteIcon,
  plastic_bag: PlasticBagIcon,
  diapers: DiaperIcon,
  battery: BatteryIcon,
};

export function getItemIcon(itemKey: string) {
  return ITEM_ICON[itemKey] ?? GenericIcon;
}

/**
 * An item pictogram on its circular badge. The badge tint and the icon stroke both
 * come from the item's bin OUTCOME — not from the item's material — so the badge
 * teaches the sort result at a glance.
 */
export function ItemBadge({
  itemKey,
  bin,
  size = 56,
}: {
  itemKey: string;
  bin: BinType;
  size?: number;
}) {
  const Icon = getItemIcon(itemKey);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.iconBadge,
        backgroundColor: binTint(bin, "badge"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={size * 0.55} color={binColor(bin)} />
    </View>
  );
}

/** Bin-outcome pictograms, used where the bin itself is the subject. */
export function BinGlyph({ bin, size = 24 }: { bin: BinType; size?: number }) {
  const color = binColor(bin);

  if (bin === "recycling") {
    // Mobius arrows from Lucide (`recycle`), ISC licensed:
    //   Copyright (c) 2026 Lucide Icons and Contributors — https://lucide.dev
    // Drawn on the same 24px grid with round caps, so it sits at our STROKE weight
    // unchanged. The hand-drawn version this replaced had arrowheads that didn't
    // align with their arrows.
    return (
      <Glyph size={size} color={color}>
        <Path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
        <Path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
        <Path d="m14 16-3 3 3 3" />
        <Path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
        <Path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
        <Path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
      </Glyph>
    );
  }

  if (bin === "compost") {
    return (
      <Glyph size={size} color={color}>
        <Path d="M12 20.5v-7" />
        <Path d="M12 13.5c0-3.6 2.6-6.6 6-7-.2 3.9-2.7 6.7-6 7z" />
        <Path d="M12 16.5c-3.1-.3-5.6-2.7-6-6 3.3.3 5.8 2.7 6 6z" />
      </Glyph>
    );
  }

  if (bin === "garbage") {
    return (
      <Glyph size={size} color={color}>
        <Path d="M4.5 6.5h15" />
        <Path d="M9.5 6.5V4.8a1.8 1.8 0 0 1 1.8-1.8h1.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
        <Path d="M6.4 6.5l.9 13a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7l.9-13" />
        <Path d="M10.4 10.5v6.5M13.6 10.5v6.5" />
      </Glyph>
    );
  }

  // consult-local-guide
  return (
    <Glyph size={size} color={color}>
      <Path d="M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4z" />
      <Path d="M12 16.5v-5" />
      <Path d="M12 7.8h.01" />
    </Glyph>
  );
}
