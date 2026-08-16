/**
 * The font catalogue.
 *
 * A curated set of Google Fonts families, fetched at runtime by
 * `src/motion/fonts.tsx` - nothing has to be installed on the user's
 * machine, and the preview and the export load the identical files, so a
 * font can never render differently in the two.
 *
 * Plain data in shared/ because three consumers need the list and only one
 * of them can import React code: the motion package (to load), the
 * inspector (to offer), and the MCP server (to advertise to agents through
 * `describe_capabilities`).
 *
 * Curated rather than the full 1,500-family Google catalogue: a motion
 * designer's shortlist. Every entry here must also have a loader registered
 * in `src/motion/fonts.tsx` - a test keeps the two in sync.
 */

export const FONTS = [
  // Sans - workhorses for product films and UI-adjacent motion.
  { family: "Inter", category: "Sans" },
  { family: "Roboto", category: "Sans" },
  { family: "Open Sans", category: "Sans" },
  { family: "Poppins", category: "Sans" },
  { family: "Montserrat", category: "Sans" },
  { family: "Lato", category: "Sans" },
  { family: "Manrope", category: "Sans" },
  { family: "DM Sans", category: "Sans" },
  { family: "Space Grotesk", category: "Sans" },
  { family: "Sora", category: "Sans" },
  { family: "Outfit", category: "Sans" },
  { family: "Plus Jakarta Sans", category: "Sans" },

  // Serif - editorial and premium.
  { family: "Playfair Display", category: "Serif" },
  { family: "Lora", category: "Serif" },
  { family: "Merriweather", category: "Serif" },
  { family: "EB Garamond", category: "Serif" },
  { family: "Fraunces", category: "Serif" },

  // Display - loud headlines.
  { family: "Bebas Neue", category: "Display" },
  { family: "Oswald", category: "Display" },
  { family: "Anton", category: "Display" },
  { family: "Righteous", category: "Display" },
  { family: "Archivo Black", category: "Display" },

  // Mono - code and technical framing.
  { family: "JetBrains Mono", category: "Mono" },
  { family: "Fira Code", category: "Mono" },
  { family: "IBM Plex Mono", category: "Mono" },
  { family: "Space Mono", category: "Mono" },

  // Script - handwritten accents. Use sparingly.
  { family: "Caveat", category: "Script" },
  { family: "Pacifico", category: "Script" },
  { family: "Dancing Script", category: "Script" },
  { family: "Permanent Marker", category: "Script" },
];

/** @param {string} family */
export function isKnownFont(family) {
  return FONTS.some((f) => f.family === family);
}
