/**
 * Resolves the project's asset paths to `file://` URLs for the preview.
 *
 * The renderer cannot touch the filesystem, so every path referenced by the
 * project has to be converted by the main process. Doing that lazily inside
 * each layer component would mean an async gap on every render and a flash
 * of missing media; instead the whole set is resolved up front and handed to
 * the composition as a map.
 *
 * Resolved URLs are cached across project edits, so moving a layer does not
 * re-resolve its image.
 */

import { useEffect, useRef, useState } from "react";
import type { Project } from "@shared/project.js";
import { bridge } from "@/lib/bridge";

/** Every asset path the project currently references. */
function collectSources(project: Project): string[] {
  const sources = new Set<string>();

  for (const scene of project.scenes) {
    for (const layer of scene.layers) {
      const src = (layer.props as { src?: unknown }).src;
      if (typeof src === "string" && src) sources.add(src);
    }
  }
  for (const clip of project.audio) {
    if (clip.src) sources.add(clip.src);
  }

  return [...sources];
}

export function useAssetUrls(
  dirName: string | null,
  project: Project | null,
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef(new Map<string, string>());

  // A project switch invalidates every cached URL - the same relative path
  // means a different file in a different project.
  useEffect(() => {
    cache.current.clear();
    setUrls({});
  }, [dirName]);

  useEffect(() => {
    if (!dirName || !project) return undefined;

    const sources = collectSources(project);
    const missing = sources.filter((src) => !cache.current.has(src));
    if (!missing.length) return undefined;

    let cancelled = false;

    void Promise.all(
      missing.map(async (src) => {
        try {
          const { url } = await bridge.project.assetUrl(dirName, src);
          return [src, url] as const;
        } catch {
          // A path that cannot be resolved - typo, deleted file - is cached
          // as empty so it is not retried on every keystroke. The layer
          // components render a visible "missing asset" placeholder for it.
          return [src, ""] as const;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      for (const [src, url] of resolved) cache.current.set(src, url);
      setUrls(Object.fromEntries(cache.current));
    });

    return () => {
      cancelled = true;
    };
  }, [dirName, project]);

  return urls;
}
