import * as Location from "expo-location";

import { fetchJSON } from "@/core/net";
import type { RegionSummary } from "@/features/region/regionSource";

/**
 * GPS → region. React-free, same as `regionSource.ts`.
 *
 * The device only ever gives lat/long — never a region name — so resolving "where am I" into
 * "which rules apply" needs a geocoder. That's Nominatim (OpenStreetMap's), chosen because it
 * costs nothing and needs no key, which is the whole infrastructure budget. It is a courtesy
 * service with a real usage policy: one request per second, and a User-Agent that identifies
 * the app. Both are honored below, and detection is a button rather than something that runs
 * on launch partly for that reason.
 *
 * This is best-effort by design. A miss is not an error state to recover from — the manual
 * picker (Location → Change region) is the primary path and stays the fallback for every failure
 * here, so every one of them throws a `LocationError` the UI can turn into one sentence.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** Nominatim's policy requires a UA that identifies the app, not the default RN one. */
const USER_AGENT = "bin-go/1.0 (waste sorting app; https://sandwitchcraft.github.io/bingoDB/)";

/**
 * Nominatim's zoom is the level of the place it resolves to: 10 is city. It's the most
 * specific level worth asking for — a street address (18) would be more precise about
 * something no sorting rule depends on — and `addressdetails` still returns everything
 * above it (county, state, country), which is what the matcher falls back through.
 */
const ZOOM = 10;

export type LocationFailureReason =
  /** Permission was refused. The only failure the user can fix from Settings.app. */
  | "permission-denied"
  /** Location services off, or no fix (indoors, airplane mode). */
  | "unavailable"
  /** Nominatim unreachable, timed out, or answered with something unparseable. */
  | "geocode-failed"
  /** Geocoding worked; the place it named isn't a region bingoDB publishes rules for. */
  | "no-match";

export class LocationError extends Error {
  constructor(
    readonly reason: LocationFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "LocationError";
  }
}

/** One sentence for the error toast: what happened, and what to do instead. */
export function locationErrorMessage(error: unknown): string {
  const reason = error instanceof LocationError ? error.reason : "unavailable";
  switch (reason) {
    case "permission-denied":
      return "Location access is off. Turn it on in your device settings, or pick a region by hand.";
    case "geocode-failed":
      return "Couldn't look up your location. Check your connection, or pick a region by hand.";
    case "no-match":
      return "No sorting rules yet for your area. Pick the closest region by hand.";
    default:
      return "Couldn't get your location. Make sure location services are on, or pick a region by hand.";
  }
}

// --- Reverse geocoding -----------------------------------------------------

/**
 * The address labels Nominatim returned, most specific first. Deliberately a flat list
 * rather than a typed address: which key holds the useful name varies by country and by
 * how the area is administered (Toronto arrives as `city`, Halton as `county`), and the
 * matcher only cares about the ordering.
 */
export type PlaceLabels = {
  /** Most-specific-first: city/town, then county/district, then state, then country. */
  candidates: string[];
  /** Every label, for verifying a candidate's ancestors. */
  all: string[];
};

/** Address keys in specificity order — the order the matcher tries them in. */
const ADDRESS_KEYS = [
  "city",
  "town",
  "village",
  "municipality",
  "city_district",
  "county",
  "state_district",
  "region",
  "state",
  "province",
  "country",
] as const;

export function parsePlaceLabels(raw: unknown): PlaceLabels {
  const address =
    typeof raw === "object" && raw !== null && "address" in raw
      ? (raw as { address: unknown }).address
      : null;
  if (typeof address !== "object" || address === null) {
    throw new LocationError("geocode-failed", "Reverse geocode returned no address");
  }

  const record = address as Record<string, unknown>;
  const candidates: string[] = [];
  for (const key of ADDRESS_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "" && !candidates.includes(value)) {
      candidates.push(value);
    }
  }
  if (candidates.length === 0) {
    throw new LocationError("geocode-failed", "Reverse geocode returned an empty address");
  }

  const all = Object.values(record).filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  return { candidates, all };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceLabels> {
  const url =
    `${NOMINATIM_URL}?format=jsonv2&zoom=${ZOOM}&addressdetails=1` +
    `&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  try {
    return parsePlaceLabels(await fetchJSON(url, { headers: { "User-Agent": USER_AGENT } }));
  } catch (error) {
    if (error instanceof LocationError) throw error;
    throw new LocationError("geocode-failed", `Reverse geocode failed: ${String(error)}`);
  }
}

// --- Matching a place to a region ------------------------------------------

/**
 * Strips everything that differs between what a geocoder calls a place and what its folder
 * slug calls it: diacritics, punctuation, and the administrative wrapper words. Nominatim
 * says "Regional Municipality of Halton" and "City of Toronto"; bingoDB says "halton" and
 * "toronto".
 */
export function normalizePlace(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(the|of|city|town|village|township|municipality|regional|region|county|district|state|province|prefecture|department)\b/g,
      " ",
    )
    .trim()
    .replace(/\s+/g, " ");
}

/** Every name a catalog entry answers to: its slug and its display name. */
function regionAliases(region: RegionSummary): string[] {
  const leaf = region.path[region.path.length - 1] ?? region.id;
  return [normalizePlace(leaf), normalizePlace(region.displayName)];
}

/**
 * Pick the region the place is in, most specific first.
 *
 * The ancestor check is what stops Toronto, Ohio from selecting Toronto, Ontario: a match on
 * the leaf name only counts if every one of the entry's parents ("Canada", "Ontario") also
 * appears somewhere in the same address. It's a containment test, not a hierarchy walk —
 * the catalog is flat (see the "most specific wins" TODO), so there's no chain to walk yet.
 *
 * Only municipal entries are eligible: auto-detect resolves a place to its residential
 * collection, never to a commercial hauler (those are broad-scoped and picked by hand).
 * Skipping them also keeps the flat "first hit" rule from grabbing a province-wide
 * commercial scope over the municipality the user is actually standing in.
 */
export function matchRegion(catalog: RegionSummary[], place: PlaceLabels): RegionSummary | null {
  const addressNames = new Set(place.all.map(normalizePlace));

  for (const candidate of place.candidates) {
    const needle = normalizePlace(candidate);
    if (needle === "") continue;
    for (const region of catalog) {
      if (region.providerType !== "municipal") continue;
      if (!regionAliases(region).includes(needle)) continue;
      const ancestorsPresent = region.parents.every((parent) =>
        addressNames.has(normalizePlace(parent)),
      );
      if (ancestorsPresent) return region;
    }
  }
  return null;
}

// --- The whole flow --------------------------------------------------------

/**
 * Permission → fix → geocode → match. Throws `LocationError` at every step; run the result
 * through `locationErrorMessage` for something to show.
 */
export async function detectRegion(catalog: RegionSummary[]): Promise<RegionSummary> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new LocationError("permission-denied", `Location permission ${status}`);
  }

  let position: Location.LocationObject;
  try {
    // Balanced, not High: this resolves to a municipality, so metre-level accuracy would
    // cost battery and seconds to buy precision the answer throws away.
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch (error) {
    throw new LocationError("unavailable", `Couldn't read position: ${String(error)}`);
  }

  const place = await reverseGeocode(position.coords.latitude, position.coords.longitude);
  const match = matchRegion(catalog, place);
  if (!match) {
    throw new LocationError("no-match", `No region in the catalog for ${place.candidates.join(", ")}`);
  }
  return match;
}
