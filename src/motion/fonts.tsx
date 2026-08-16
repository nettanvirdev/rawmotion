/**
 * Runtime font loading.
 *
 * Families come from the shared catalogue (`src/shared/fonts.js`) and are
 * fetched from Google Fonts through `@remotion/google-fonts`, which wraps
 * the download in Remotion's `delayRender` - a rendered frame can never
 * show fallback glyphs, because the render waits for the face. The same
 * loader runs in the editor's Player, so preview and export use identical
 * files.
 *
 * Loading is lazy and cached: a film pays only for the families it uses,
 * and asking for the same family twice is free. An unknown family (or no
 * network) falls back to the system stack rather than failing the frame -
 * type in the wrong face beats no frame at all.
 */

import * as Inter from "@remotion/google-fonts/Inter";
import * as Roboto from "@remotion/google-fonts/Roboto";
import * as OpenSans from "@remotion/google-fonts/OpenSans";
import * as Poppins from "@remotion/google-fonts/Poppins";
import * as Montserrat from "@remotion/google-fonts/Montserrat";
import * as Lato from "@remotion/google-fonts/Lato";
import * as Manrope from "@remotion/google-fonts/Manrope";
import * as DMSans from "@remotion/google-fonts/DMSans";
import * as SpaceGrotesk from "@remotion/google-fonts/SpaceGrotesk";
import * as Sora from "@remotion/google-fonts/Sora";
import * as Outfit from "@remotion/google-fonts/Outfit";
import * as PlusJakartaSans from "@remotion/google-fonts/PlusJakartaSans";
import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as Lora from "@remotion/google-fonts/Lora";
import * as Merriweather from "@remotion/google-fonts/Merriweather";
import * as EBGaramond from "@remotion/google-fonts/EBGaramond";
import * as Fraunces from "@remotion/google-fonts/Fraunces";
import * as BebasNeue from "@remotion/google-fonts/BebasNeue";
import * as Oswald from "@remotion/google-fonts/Oswald";
import * as Anton from "@remotion/google-fonts/Anton";
import * as Righteous from "@remotion/google-fonts/Righteous";
import * as ArchivoBlack from "@remotion/google-fonts/ArchivoBlack";
import * as JetBrainsMono from "@remotion/google-fonts/JetBrainsMono";
import * as FiraCode from "@remotion/google-fonts/FiraCode";
import * as IBMPlexMono from "@remotion/google-fonts/IBMPlexMono";
import * as SpaceMono from "@remotion/google-fonts/SpaceMono";
import * as Caveat from "@remotion/google-fonts/Caveat";
import * as Pacifico from "@remotion/google-fonts/Pacifico";
import * as DancingScript from "@remotion/google-fonts/DancingScript";
import * as PermanentMarker from "@remotion/google-fonts/PermanentMarker";

/** The stack used when no family is chosen - the app's own look. */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';

type Loader = { loadFont: () => { fontFamily: string } };

type LooseLoadFont = (
  style?: string,
  options?: { subsets?: string[]; ignoreTooManyRequestsWarning?: boolean },
) => { fontFamily: string };

/** Family name (as in the shared catalogue) to its loader module. */
const LOADERS: Record<string, Loader> = {
  Inter,
  Roboto,
  "Open Sans": OpenSans,
  Poppins,
  Montserrat,
  Lato,
  Manrope,
  "DM Sans": DMSans,
  "Space Grotesk": SpaceGrotesk,
  Sora,
  Outfit,
  "Plus Jakarta Sans": PlusJakartaSans,
  "Playfair Display": PlayfairDisplay,
  Lora,
  Merriweather,
  "EB Garamond": EBGaramond,
  Fraunces,
  "Bebas Neue": BebasNeue,
  Oswald,
  Anton,
  Righteous,
  "Archivo Black": ArchivoBlack,
  "JetBrains Mono": JetBrainsMono,
  "Fira Code": FiraCode,
  "IBM Plex Mono": IBMPlexMono,
  "Space Mono": SpaceMono,
  Caveat,
  Pacifico,
  "Dancing Script": DancingScript,
  "Permanent Marker": PermanentMarker,
};

/** Exported for the test that keeps this map and the shared list in sync. */
export const LOADABLE_FAMILIES = Object.keys(LOADERS);

const loaded = new Map<string, string>();

/**
 * Resolve a catalogue family to a CSS `font-family` value, loading it on
 * first use. Empty or unknown input returns the system stack.
 */
export function resolveFontStack(family?: string): string {
  if (!family) return SYSTEM_FONT_STACK;

  const cached = loaded.get(family);
  if (cached) return cached;

  const loader = LOADERS[family];
  if (!loader) return SYSTEM_FONT_STACK;

  try {
    // Upright latin only. Every catalogue family has both; skipping the
    // italic and non-latin files cuts a family from ~48 fetches to a few.
    // The cast widens the per-font literal types, which is safe because
    // "normal" and "latin" exist on every family - the sync test guards
    // the catalogue, and a runtime failure falls through to the catch.
    const { fontFamily } = (loader.loadFont as LooseLoadFont)("normal", {
      subsets: ["latin"],
      ignoreTooManyRequestsWarning: true,
    });
    const stack = `"${fontFamily}", ${SYSTEM_FONT_STACK}`;
    loaded.set(family, stack);
    return stack;
  } catch {
    // Offline, or the fetch failed - fall back rather than break the frame.
    return SYSTEM_FONT_STACK;
  }
}
