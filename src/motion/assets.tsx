/**
 * Resolving project-relative asset paths to loadable URLs.
 *
 * The same composition runs in two environments that disagree about what a
 * URL is, and this context is what hides the difference:
 *
 *  - **Preview**, inside the Electron renderer. The renderer has no
 *    filesystem access, so the main process converts each project-relative
 *    path into a `file://` URL over IPC and the editor passes the resulting
 *    map down.
 *  - **Final render**, inside the Remotion bundle. The bundler is pointed at
 *    the project's `assets/` directory as its public directory, so paths
 *    resolve through Remotion's `staticFile`.
 *
 * Without this indirection every layer component would need to know which
 * environment it is in, and the composition would stop being one thing.
 */

import React, { createContext, useContext, useMemo } from "react";
import { staticFile } from "remotion";

export type AssetResolver = (src: string) => string;

/**
 * Default resolver: pass the path through untouched.
 *
 * Used when a composition is mounted with no provider - a Storybook-style
 * preview, or a scene that references no media. Returning the raw path means
 * an absolute URL in a project file still works.
 */
const AssetContext = createContext<AssetResolver>((src) => src);

export const useAssetUrl = (): AssetResolver => useContext(AssetContext);

/**
 * Resolve a single asset path, tolerating the cases a hand-edited project
 * file will contain.
 */
function normalize(src: string): string {
  if (!src) return "";
  // Already a URL - remote image, data URI, or a path the caller resolved.
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src;
  return src.replace(/^\.?\//, "");
}

export const AssetProvider: React.FC<{
  resolve: AssetResolver;
  children: React.ReactNode;
}> = ({ resolve, children }) => {
  const value = useMemo<AssetResolver>(
    () => (src) => {
      const cleaned = normalize(src);
      if (!cleaned) return "";
      if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return cleaned;
      return resolve(cleaned);
    },
    [resolve],
  );
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};

/**
 * Resolver for the render bundle.
 *
 * `bundle()` is given the project's `assets/` folder as its public dir, so a
 * model path of `assets/images/hero.png` is served at `images/hero.png` -
 * hence stripping the leading segment here rather than in the model, which
 * must stay environment-agnostic.
 */
export const staticAssetResolver: AssetResolver = (src) =>
  staticFile(src.replace(/^assets\//, ""));

/**
 * Resolver backed by a precomputed map, used by the preview.
 *
 * An unresolved path returns the empty string rather than the raw path: a
 * bare relative path in the Electron renderer would resolve against the dev
 * server and produce a confusing 404 in the console instead of the empty
 * frame the layer components already handle.
 */
export function mapAssetResolver(urls: Record<string, string>): AssetResolver {
  return (src) => urls[src] ?? "";
}
