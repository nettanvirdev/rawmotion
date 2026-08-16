/**
 * Pure transformations of the project model.
 *
 * Every edit the UI can make - dragging a clip, typing in the inspector,
 * reordering a scene - is expressed here as `Project -> Project`. Keeping
 * them pure and outside the store buys three things: they are unit-testable
 * without React, undo/redo works by simply keeping old values alive, and the
 * eventual MCP tool layer can reuse the exact same functions rather than
 * reimplementing "duplicate a scene" a second time.
 *
 * Nothing here mutates its input.
 */

import {
  createId,
  uniqueName,
} from "@shared/ids.js";
import {
  createLayer,
  createScene,
  type AudioClip,
  type Composition,
  type Layer,
  type Project,
  type Scene,
} from "@shared/project.js";

type Patch<T> = Partial<T>;

/* ------------------------------------------------------------------ *
 * Composition
 * ------------------------------------------------------------------ */

export function updateComposition(project: Project, patch: Patch<Composition>): Project {
  return { ...project, composition: { ...project.composition, ...patch } };
}

export function renameProject(project: Project, name: string): Project {
  return { ...project, name };
}

/* ------------------------------------------------------------------ *
 * Scenes
 * ------------------------------------------------------------------ */

function mapScenes(project: Project, fn: (scene: Scene) => Scene): Project {
  return { ...project, scenes: project.scenes.map(fn) };
}

export function updateScene(project: Project, sceneId: string, patch: Patch<Scene>): Project {
  return mapScenes(project, (scene) =>
    scene.id === sceneId ? { ...scene, ...patch } : scene,
  );
}

export function updateSceneCamera(
  project: Project,
  sceneId: string,
  patch: Patch<Scene["camera"]>,
): Project {
  return mapScenes(project, (scene) =>
    scene.id === sceneId ? { ...scene, camera: { ...scene.camera, ...patch } } : scene,
  );
}

export function updateSceneTransition(
  project: Project,
  sceneId: string,
  patch: Patch<Scene["transition"]>,
): Project {
  return mapScenes(project, (scene) =>
    scene.id === sceneId
      ? { ...scene, transition: { ...scene.transition, ...patch } }
      : scene,
  );
}

export function addScene(project: Project, init?: Partial<Scene>, atIndex?: number): Project {
  const scene = createScene({
    name: uniqueName(init?.name ?? `Scene ${project.scenes.length + 1}`, project.scenes.map((s) => s.name)),
    ...init,
  });
  const scenes = [...project.scenes];
  scenes.splice(atIndex ?? scenes.length, 0, scene);
  return { ...project, scenes };
}

export function duplicateScene(project: Project, sceneId: string): Project {
  const index = project.scenes.findIndex((s) => s.id === sceneId);
  if (index === -1) return project;

  const source = project.scenes[index];
  const copy: Scene = {
    ...source,
    id: createId("scn"),
    name: uniqueName(`${source.name} copy`, project.scenes.map((s) => s.name)),
    // Every nested id must be fresh, or selection and keying collide between
    // the original and the copy.
    layers: source.layers.map((layer) => ({ ...layer, id: createId("lyr") })),
  };

  const scenes = [...project.scenes];
  scenes.splice(index + 1, 0, copy);
  return { ...project, scenes };
}

/**
 * Remove a scene, unless it is the last one.
 *
 * A project with zero scenes cannot be previewed or rendered, so the final
 * scene is not deletable - clearing its layers is the equivalent gesture.
 */
export function removeScene(project: Project, sceneId: string): Project {
  if (project.scenes.length <= 1) return project;
  return { ...project, scenes: project.scenes.filter((s) => s.id !== sceneId) };
}

export function moveScene(project: Project, sceneId: string, toIndex: number): Project {
  const from = project.scenes.findIndex((s) => s.id === sceneId);
  if (from === -1) return project;

  const scenes = [...project.scenes];
  const [scene] = scenes.splice(from, 1);
  scenes.splice(clampIndex(toIndex, scenes.length), 0, scene);
  return { ...project, scenes };
}

/* ------------------------------------------------------------------ *
 * Layers
 * ------------------------------------------------------------------ */

function mapLayers(
  project: Project,
  layerId: string,
  fn: (layer: Layer) => Layer,
): Project {
  return mapScenes(project, (scene) => {
    if (!scene.layers.some((l) => l.id === layerId)) return scene;
    return {
      ...scene,
      layers: scene.layers.map((layer) => (layer.id === layerId ? fn(layer) : layer)),
    };
  });
}

export function updateLayer(project: Project, layerId: string, patch: Patch<Layer>): Project {
  return mapLayers(project, layerId, (layer) => ({ ...layer, ...patch }));
}

export function updateLayerTransform(
  project: Project,
  layerId: string,
  patch: Patch<Layer["transform"]>,
): Project {
  return mapLayers(project, layerId, (layer) => ({
    ...layer,
    transform: { ...layer.transform, ...patch },
  }));
}

export function updateLayerProps(
  project: Project,
  layerId: string,
  patch: Record<string, unknown>,
): Project {
  return mapLayers(project, layerId, (layer) => ({
    ...layer,
    props: { ...layer.props, ...patch },
  }));
}

export function updateLayerAnimation(
  project: Project,
  layerId: string,
  which: "enter" | "exit",
  patch: Partial<NonNullable<Layer["animation"]["enter"]>> | null,
): Project {
  return mapLayers(project, layerId, (layer) => {
    if (patch === null) {
      const next = { ...layer.animation };
      delete next[which];
      return { ...layer, animation: next };
    }
    const existing = layer.animation[which] ?? {
      preset: "fade",
      durationInFrames: 20,
      delay: 0,
    };
    return {
      ...layer,
      animation: { ...layer.animation, [which]: { ...existing, ...patch } },
    };
  });
}

/**
 * Move or resize a layer within its scene.
 *
 * Clamped so a clip can neither start before the scene nor extend past its
 * end. Allowing either would produce a layer that is invisible in the
 * timeline but still in the model, which users read as a bug.
 */
export function setLayerTiming(
  project: Project,
  layerId: string,
  timing: { start?: number; duration?: number },
): Project {
  return mapScenes(project, (scene) => {
    const index = scene.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return scene;

    const layer = scene.layers[index];
    const duration = Math.max(
      1,
      Math.round(timing.duration ?? layer.duration),
    );
    const start = Math.round(timing.start ?? layer.start);
    const clampedStart = Math.max(0, Math.min(start, scene.durationInFrames - 1));
    const clampedDuration = Math.min(duration, scene.durationInFrames - clampedStart);

    const layers = [...scene.layers];
    layers[index] = { ...layer, start: clampedStart, duration: Math.max(1, clampedDuration) };
    return { ...scene, layers };
  });
}

export function addLayer(
  project: Project,
  sceneId: string,
  init: Partial<Layer> & { type: Layer["type"] },
): { project: Project; layerId: string } {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return { project, layerId: "" };

  const layer = createLayer({
    duration: scene.durationInFrames,
    ...init,
    name: uniqueName(
      init.name ?? defaultLayerName(init),
      scene.layers.map((l) => l.name),
    ),
  });

  return {
    project: mapScenes(project, (s) =>
      s.id === sceneId ? { ...s, layers: [...s.layers, layer] } : s,
    ),
    layerId: layer.id,
  };
}

function defaultLayerName(init: Partial<Layer> & { type: Layer["type"] }): string {
  if (init.type === "component") {
    const name = (init.props as { component?: string } | undefined)?.component;
    if (name) return name;
  }
  if (init.type === "background") {
    return "Background";
  }
  return init.type.charAt(0).toUpperCase() + init.type.slice(1);
}

export function removeLayer(project: Project, layerId: string): Project {
  return mapScenes(project, (scene) => ({
    ...scene,
    layers: scene.layers.filter((l) => l.id !== layerId),
  }));
}

export function duplicateLayer(
  project: Project,
  layerId: string,
): { project: Project; layerId: string } {
  let newId = "";
  const next = mapScenes(project, (scene) => {
    const index = scene.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return scene;

    const source = scene.layers[index];
    newId = createId("lyr");
    const copy: Layer = {
      ...source,
      id: newId,
      name: uniqueName(`${source.name} copy`, scene.layers.map((l) => l.name)),
      transform: { ...source.transform },
      props: { ...source.props },
      animation: { ...source.animation },
    };

    const layers = [...scene.layers];
    layers.splice(index + 1, 0, copy);
    return { ...scene, layers };
  });
  return { project: next, layerId: newId };
}

/**
 * Reorder a layer within its scene.
 *
 * Array order is z-order: later layers paint on top. The timeline shows
 * tracks top-down in the opposite order, which the timeline component
 * reverses for display rather than storing a separate index.
 */
export function moveLayer(project: Project, layerId: string, toIndex: number): Project {
  return mapScenes(project, (scene) => {
    const from = scene.layers.findIndex((l) => l.id === layerId);
    if (from === -1) return scene;

    const layers = [...scene.layers];
    const [layer] = layers.splice(from, 1);
    layers.splice(clampIndex(toIndex, layers.length), 0, layer);
    return { ...scene, layers };
  });
}

/* ------------------------------------------------------------------ *
 * Audio
 * ------------------------------------------------------------------ */

export function addAudio(project: Project, init: Partial<AudioClip>): { project: Project; audioId: string } {
  const clip: AudioClip = {
    id: createId("aud"),
    kind: init.kind ?? "music",
    name: init.name ?? "Audio",
    src: init.src ?? "",
    start: init.start ?? 0,
    duration: init.duration ?? 150,
    trimStart: init.trimStart ?? 0,
    volume: init.volume ?? 1,
    fadeIn: init.fadeIn ?? 0,
    fadeOut: init.fadeOut ?? 0,
    muted: init.muted ?? false,
    solo: init.solo ?? false,
  };
  return { project: { ...project, audio: [...project.audio, clip] }, audioId: clip.id };
}

export function updateAudio(project: Project, audioId: string, patch: Patch<AudioClip>): Project {
  return {
    ...project,
    audio: project.audio.map((clip) =>
      clip.id === audioId ? { ...clip, ...patch } : clip,
    ),
  };
}

export function removeAudio(project: Project, audioId: string): Project {
  return { ...project, audio: project.audio.filter((c) => c.id !== audioId) };
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

/**
 * Register imported files in the model, skipping paths already present.
 *
 * The asset browser scans the filesystem directly, so `project.assets` is a
 * record of what the project *intends* to use rather than an index that must
 * be kept exhaustive. De-duplicating on `src` keeps re-importing the same
 * file idempotent.
 */
export function registerAssets(
  project: Project,
  rows: { kind: string; name: string; src: string; origin?: "user" | "generated" }[],
): Project {
  const known = new Set(project.assets.map((a) => a.src));
  const additions = rows
    .filter((row) => !known.has(row.src))
    .map((row) => ({
      id: createId("ast"),
      kind: row.kind as Project["assets"][number]["kind"],
      name: row.name,
      src: row.src,
      origin: row.origin ?? ("user" as const),
    }));

  if (!additions.length) return project;
  return { ...project, assets: [...project.assets, ...additions] };
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}
