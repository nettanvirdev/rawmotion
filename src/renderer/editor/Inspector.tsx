/**
 * The inspector.
 *
 * Context-sensitive: it renders controls for whatever is selected - a layer,
 * a scene, an audio clip - and falls back to composition settings when
 * nothing is.
 *
 * Every control writes through `projectStore.apply`, which means there is no
 * local form state to synchronise. A value shown here is read from the
 * project on every render, so a change made by an agent on disk, by undo, or
 * by dragging a clip in the timeline is reflected immediately without this
 * component knowing those paths exist.
 *
 * Continuous controls pass a `coalesceKey` so a drag becomes one undo entry.
 */

import React from "react";
import { Code2, Copy, Trash2, Upload } from "lucide-react";
import type { Layer, Project, Scene } from "@shared/project.js";
import {
  COMPOSITION_PRESETS,
  LAYER_TYPES,
  findLayer,
  formatTimecode,
} from "@shared/project.js";
import { FONTS } from "@shared/fonts.js";
import { BACKGROUND_REGISTRY } from "@motion/backgrounds";
import {
  COMPONENT_REGISTRY,
  componentDefaults,
  lookupComponent,
  type PropSpec,
} from "@motion/registry";
import { presetOptions } from "@motion/presets";
import { useComponentStore } from "@/state/componentStore";
import { useEditorStore } from "@/state/editorStore";
import { useProjectStore } from "@/state/projectStore";
import * as ops from "@/state/operations";
import { bridge } from "@/lib/bridge";
import {
  ColorField,
  EmptyState,
  IconButton,
  NumberField,
  Pair,
  Row,
  SegmentedField,
  SelectField,
  Section,
  SliderField,
  TextField,
  ToggleField,
} from "./controls";

export const Inspector: React.FC<{ project: Project }> = ({ project }) => {
  const selection = useEditorStore((s) => s.selection);

  if (selection.kind === "layer") {
    const found = findLayer(project, selection.id);
    if (!found) return <CompositionInspector project={project} />;
    return <LayerInspector project={project} layer={found.layer} scene={found.scene} />;
  }

  if (selection.kind === "scene") {
    const scene = project.scenes.find((s) => s.id === selection.id);
    if (!scene) return <CompositionInspector project={project} />;
    return <SceneInspector scene={scene} />;
  }

  if (selection.kind === "audio") {
    const clip = project.audio.find((a) => a.id === selection.id);
    if (!clip) return <CompositionInspector project={project} />;
    return <AudioInspector project={project} clip={clip} />;
  }

  return <CompositionInspector project={project} />;
};

/* ------------------------------------------------------------------ *
 * Composition
 * ------------------------------------------------------------------ */

const CompositionInspector: React.FC<{ project: Project }> = ({ project }) => {
  const apply = useProjectStore((s) => s.apply);
  const { width, height, fps, background } = project.composition;

  const activePreset = COMPOSITION_PRESETS.find(
    (p) => p.width === width && p.height === height && p.fps === fps,
  );

  return (
    <div className="rm-scroll flex-1 overflow-y-auto">
      <Header title="Composition" subtitle={project.name} />

      <Section title="Format">
        <Row label="Preset">
          <SelectField
            value={activePreset?.id ?? "custom"}
            onChange={(id) => {
              const preset = COMPOSITION_PRESETS.find((p) => p.id === id);
              if (!preset) return;
              apply("Change format", (p) =>
                ops.updateComposition(p, {
                  width: preset.width,
                  height: preset.height,
                  fps: preset.fps,
                }),
              );
            }}
            options={[
              ...(activePreset ? [] : [{ value: "custom", label: "Custom" }]),
              ...COMPOSITION_PRESETS.map((p) => ({
                value: p.id,
                label: `${p.label} - ${p.hint}`,
              })),
            ]}
          />
        </Row>

        <Pair label="Size">
          <NumberField
            value={width}
            min={16}
            max={7680}
            step={2}
            precision={0}
            onChange={(v) =>
              apply("Change width", (p) => ops.updateComposition(p, { width: Math.round(v) }), {
                coalesceKey: "comp:width",
              })
            }
          />
          <NumberField
            value={height}
            min={16}
            max={7680}
            step={2}
            precision={0}
            onChange={(v) =>
              apply("Change height", (p) => ops.updateComposition(p, { height: Math.round(v) }), {
                coalesceKey: "comp:height",
              })
            }
          />
        </Pair>

        <Row label="Frame rate" hint="Frames per second">
          <NumberField
            value={fps}
            min={1}
            max={120}
            step={1}
            precision={0}
            suffix="fps"
            onChange={(v) =>
              apply("Change frame rate", (p) =>
                ops.updateComposition(p, { fps: Math.max(1, Math.round(v)) }),
              )
            }
          />
        </Row>

        <Row label="Backdrop">
          <ColorField
            value={background}
            onChange={(v) =>
              apply("Change backdrop", (p) => ops.updateComposition(p, { background: v }), {
                coalesceKey: "comp:bg",
              })
            }
          />
        </Row>
      </Section>

      <Section title="Project">
        <Row label="Name">
          <TextField
            value={project.name}
            onChange={(v) =>
              apply("Rename project", (p) => ops.renameProject(p, v), {
                coalesceKey: "project:name",
              })
            }
          />
        </Row>
      </Section>

      <p className="px-3 py-4 text-[11px] leading-[1.6] text-[var(--rm-text-faint)]">
        Select a layer, scene or audio clip to edit it. Duration is computed
        from the scenes - there is no project length to set.
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

const SceneInspector: React.FC<{ scene: Scene }> = ({ scene }) => {
  const apply = useProjectStore((s) => s.apply);
  const select = useEditorStore((s) => s.select);

  return (
    <div className="rm-scroll flex-1 overflow-y-auto">
      <Header
        title="Scene"
        subtitle={scene.name}
        actions={
          <>
            <IconButton
              title="Duplicate scene"
              onClick={() => apply("Duplicate scene", (p) => ops.duplicateScene(p, scene.id))}
            >
              <Copy className="size-3.5" />
            </IconButton>
            <IconButton
              title="Delete scene"
              danger
              onClick={() => {
                apply("Delete scene", (p) => ops.removeScene(p, scene.id));
                select({ kind: "none" });
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </>
        }
      />

      <Section title="Scene">
        <Row label="Name">
          <TextField
            value={scene.name}
            onChange={(v) =>
              apply("Rename scene", (p) => ops.updateScene(p, scene.id, { name: v }), {
                coalesceKey: `scene:name:${scene.id}`,
              })
            }
          />
        </Row>
        <Row label="Duration">
          <NumberField
            value={scene.durationInFrames}
            min={1}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) =>
              apply(
                "Change scene duration",
                (p) => ops.updateScene(p, scene.id, { durationInFrames: Math.max(1, Math.round(v)) }),
                { coalesceKey: `scene:dur:${scene.id}` },
              )
            }
          />
        </Row>
      </Section>

      <Section title="Camera">
        <Row label="Move">
          <SelectField
            value={scene.camera.move}
            onChange={(v) =>
              apply("Change camera", (p) =>
                ops.updateSceneCamera(p, scene.id, { move: v as Scene["camera"]["move"] }),
              )
            }
            options={[
              { value: "none", label: "Static" },
              { value: "push", label: "Push in" },
              { value: "pull", label: "Pull out" },
              { value: "pan", label: "Pan" },
            ]}
          />
        </Row>
        {scene.camera.move !== "none" ? (
          <Row label="Amount">
            <SliderField
              value={scene.camera.amount}
              min={0}
              max={0.5}
              step={0.005}
              precision={3}
              onChange={(v) =>
                apply("Change camera amount", (p) => ops.updateSceneCamera(p, scene.id, { amount: v }), {
                  coalesceKey: `scene:cam:${scene.id}`,
                })
              }
            />
          </Row>
        ) : null}
      </Section>

      <Section title="Transition out">
        <Row label="Type" hint="How the next scene arrives over this one">
          <SelectField
            value={scene.transition.type}
            onChange={(v) =>
              apply("Change transition", (p) =>
                ops.updateSceneTransition(p, scene.id, {
                  type: v as Scene["transition"]["type"],
                  // A transition with no length is invisible; give it a
                  // sensible one the moment a type is chosen.
                  durationInFrames:
                    v !== "none" && scene.transition.durationInFrames === 0
                      ? 15
                      : scene.transition.durationInFrames,
                }),
              )
            }
            options={[
              { value: "none", label: "Cut" },
              { value: "morph", label: "Morph - continuity glide" },
              { value: "fade", label: "Cross dissolve" },
              { value: "blur", label: "Blur dissolve" },
              { value: "slide", label: "Slide up" },
              { value: "wipe", label: "Wipe" },
              { value: "zoom", label: "Zoom settle" },
              { value: "push", label: "Push" },
              { value: "circle", label: "Iris circle" },
              { value: "spin", label: "Spin settle" },
              { value: "glitch", label: "Glitch" },
            ]}
          />
        </Row>
        {scene.transition.type === "morph" ? (
          <p className="pl-[84px] text-[10px] leading-[1.5] text-[var(--rm-text-faint)]">
            Layers sharing a morph ID - or a type and name - glide and
            transform into their place in the next scene instead of cutting.
          </p>
        ) : null}
        {scene.transition.type !== "none" ? (
          <Row label="Length" hint="Frames of overlap with the next scene">
            <NumberField
              value={scene.transition.durationInFrames}
              min={0}
              max={scene.durationInFrames}
              step={1}
              precision={0}
              suffix="f"
              onChange={(v) =>
                apply(
                  "Change transition length",
                  (p) =>
                    ops.updateSceneTransition(p, scene.id, {
                      durationInFrames: Math.max(0, Math.round(v)),
                    }),
                  { coalesceKey: `scene:tr:${scene.id}` },
                )
              }
            />
          </Row>
        ) : null}
      </Section>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Layer
 * ------------------------------------------------------------------ */

const LayerInspector: React.FC<{ project: Project; layer: Layer; scene: Scene }> = ({
  project,
  layer,
  scene,
}) => {
  const apply = useProjectStore((s) => s.apply);
  const select = useEditorStore((s) => s.select);
  const { fps } = project.composition;

  const setTransform = (patch: Partial<Layer["transform"]>, key: string) =>
    apply("Transform layer", (p) => ops.updateLayerTransform(p, layer.id, patch), {
      coalesceKey: `layer:${key}:${layer.id}`,
    });

  const setProps = (patch: Record<string, unknown>, key: string) =>
    apply("Change layer", (p) => ops.updateLayerProps(p, layer.id, patch), {
      coalesceKey: `layer:${key}:${layer.id}`,
    });

  return (
    <div className="rm-scroll flex-1 overflow-y-auto">
      <Header
        title={layer.type}
        subtitle={layer.name}
        actions={
          <>
            <IconButton
              title="Duplicate layer"
              onClick={() =>
                apply("Duplicate layer", (p) => ops.duplicateLayer(p, layer.id).project)
              }
            >
              <Copy className="size-3.5" />
            </IconButton>
            <IconButton
              title="Delete layer"
              danger
              onClick={() => {
                apply("Delete layer", (p) => ops.removeLayer(p, layer.id));
                select({ kind: "none" });
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </>
        }
      />

      <Section title="Layer">
        <Row label="Name">
          <TextField
            value={layer.name}
            onChange={(v) =>
              apply("Rename layer", (p) => ops.updateLayer(p, layer.id, { name: v }), {
                coalesceKey: `layer:name:${layer.id}`,
              })
            }
          />
        </Row>
        <Row label="Type">
          <SelectField
            value={layer.type}
            onChange={(v) =>
              apply("Change layer type", (p) =>
                ops.updateLayer(p, layer.id, {
                  type: v as Layer["type"],
                  // Props are type-specific, so switching type resets them.
                  // Merging would leave a text layer carrying a video src.
                  props: {},
                }),
              )
            }
            options={LAYER_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Row>
        <Row label="Morph ID" hint="Layers with the same ID across a morph transition become one element">
          <TextField
            value={String((layer as Layer & { morphId?: string }).morphId ?? "")}
            placeholder="e.g. hero"
            onChange={(v) =>
              apply("Change morph ID", (p) =>
                ops.updateLayer(p, layer.id, { morphId: v || undefined } as never),
                { coalesceKey: `layer:morph:${layer.id}` },
              )
            }
          />
        </Row>
      </Section>

      <Section title="Timing">
        <Pair label="Start / length">
          <NumberField
            value={layer.start}
            min={0}
            max={scene.durationInFrames - 1}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) =>
              apply("Move layer", (p) => ops.setLayerTiming(p, layer.id, { start: v }), {
                coalesceKey: `layer:start:${layer.id}`,
              })
            }
          />
          <NumberField
            value={layer.duration}
            min={1}
            max={scene.durationInFrames}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) =>
              apply("Trim layer", (p) => ops.setLayerTiming(p, layer.id, { duration: v }), {
                coalesceKey: `layer:dur:${layer.id}`,
              })
            }
          />
        </Pair>
        <p className="pl-[84px] text-[10px] text-[var(--rm-text-faint)] rm-num">
          {formatTimecode(layer.start, fps)} - {formatTimecode(layer.start + layer.duration, fps)}
        </p>
      </Section>

      <Section title="Transform">
        <Row label="X">
          <SliderField
            value={layer.transform.x}
            min={-project.composition.width}
            max={project.composition.width}
            step={1}
            precision={0}
            onChange={(v) => setTransform({ x: v }, "x")}
          />
        </Row>
        <Row label="Y">
          <SliderField
            value={layer.transform.y}
            min={-project.composition.height}
            max={project.composition.height}
            step={1}
            precision={0}
            onChange={(v) => setTransform({ y: v }, "y")}
          />
        </Row>
        <Row label="Scale">
          <SliderField
            value={layer.transform.scale}
            min={0.01}
            max={10}
            step={0.01}
            precision={2}
            onChange={(v) => setTransform({ scale: v }, "scale")}
          />
        </Row>
        <Row label="Rotate">
          <SliderField
            value={layer.transform.rotate}
            min={-360}
            max={360}
            step={1}
            precision={1}
            onChange={(v) => setTransform({ rotate: v }, "rotate")}
          />
        </Row>
        <Row label="Opacity">
          <SliderField
            value={layer.transform.opacity}
            onChange={(v) => setTransform({ opacity: v }, "opacity")}
          />
        </Row>
        <Row label="Blur">
          <SliderField
            value={layer.transform.blur}
            min={0}
            max={60}
            step={0.5}
            precision={1}
            onChange={(v) => setTransform({ blur: v }, "blur")}
          />
        </Row>
      </Section>

      <LayerPropsSection layer={layer} setProps={setProps} />

      <AnimationSection layer={layer} which="enter" />
      <AnimationSection layer={layer} which="exit" />
    </div>
  );
};

/**
 * Type-specific properties.
 *
 * `component` layers are the interesting case: their controls are generated
 * from the registry's prop schema, so registering a new motion component
 * gives it a full inspector with no UI work.
 */
const LayerPropsSection: React.FC<{
  layer: Layer;
  setProps: (patch: Record<string, unknown>, key: string) => void;
}> = ({ layer, setProps }) => {
  const props = layer.props as Record<string, any>;

  if (layer.type === "text") {
    return (
      <Section title="Text">
        <Row label="Content">
          <TextField
            value={String(props.text ?? "")}
            multiline
            onChange={(v) => setProps({ text: v }, "text")}
          />
        </Row>
        <Row label="Font" hint="Loaded from Google Fonts - nothing to install">
          <SelectField
            value={String(props.fontFamily ?? "")}
            onChange={(v) => setProps({ fontFamily: v }, "font")}
            options={[
              { value: "", label: "System (default)" },
              ...FONTS.map((f) => ({ value: f.family, label: f.family, group: f.category })),
            ]}
          />
        </Row>
        <Pair label="Size / weight">
          <NumberField
            value={Number(props.fontSize ?? 96)}
            min={4}
            max={800}
            step={1}
            precision={0}
            onChange={(v) => setProps({ fontSize: v }, "fontSize")}
          />
          <NumberField
            value={Number(props.fontWeight ?? 500)}
            min={100}
            max={900}
            step={100}
            precision={0}
            onChange={(v) => setProps({ fontWeight: v }, "fontWeight")}
          />
        </Pair>
        <Row label="Tracking">
          <SliderField
            value={Number(props.letterSpacing ?? -0.02)}
            min={-0.1}
            max={0.4}
            step={0.005}
            precision={3}
            onChange={(v) => setProps({ letterSpacing: v }, "tracking")}
          />
        </Row>
        <Row label="Leading">
          <SliderField
            value={Number(props.lineHeight ?? 1.1)}
            min={0.7}
            max={2.5}
            step={0.01}
            precision={2}
            onChange={(v) => setProps({ lineHeight: v }, "leading")}
          />
        </Row>
        <Row label="Colour">
          <ColorField
            value={String(props.color ?? "#ffffff")}
            onChange={(v) => setProps({ color: v }, "color")}
          />
        </Row>
        <Row label="Align">
          <SegmentedField
            value={String(props.align ?? "center")}
            onChange={(v) => setProps({ align: v }, "align")}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Row>
        <Row label="Reveal" hint="Stagger the reveal by character, word or line">
          <SelectField
            value={String(props.split ?? "none")}
            onChange={(v) => setProps({ split: v }, "split")}
            options={[
              { value: "none", label: "All at once" },
              { value: "chars", label: "By character" },
              { value: "words", label: "By word" },
              { value: "lines", label: "By line" },
            ]}
          />
        </Row>
      </Section>
    );
  }

  if (layer.type === "background") {
    const kind = String(props.kind ?? "cinematicGradient");
    return (
      <Section title="Background">
        <Row label="Kind">
          <SelectField
            value={kind}
            onChange={(v) => setProps({ kind: v }, "bgkind")}
            options={Object.entries(BACKGROUND_REGISTRY).map(([value, entry]) => ({
              value,
              label: entry.label,
            }))}
          />
        </Row>
        <Row label="Hue">
          <SliderField
            value={Number(props.hue ?? 250)}
            min={0}
            max={360}
            step={1}
            precision={0}
            onChange={(v) => setProps({ hue: v }, "hue")}
          />
        </Row>
        <Row label="Intensity">
          <SliderField
            value={Number(props.intensity ?? 1)}
            min={0}
            max={2}
            step={0.02}
            onChange={(v) => setProps({ intensity: v }, "intensity")}
          />
        </Row>
        <Row label="Speed">
          <SliderField
            value={Number(props.speed ?? 1)}
            min={0}
            max={4}
            step={0.05}
            onChange={(v) => setProps({ speed: v }, "speed")}
          />
        </Row>
      </Section>
    );
  }

  if (layer.type === "shape") {
    return (
      <Section title="Shape">
        <Row label="Shape">
          <SegmentedField
            value={String(props.shape ?? "rect")}
            onChange={(v) => setProps({ shape: v }, "shape")}
            options={[
              { value: "rect", label: "Rect" },
              { value: "ellipse", label: "Ellipse" },
              { value: "line", label: "Line" },
            ]}
          />
        </Row>
        <Pair label="Size">
          <NumberField
            value={Number(props.width ?? 480)}
            min={1}
            step={1}
            precision={0}
            onChange={(v) => setProps({ width: v }, "w")}
          />
          <NumberField
            value={Number(props.height ?? 300)}
            min={1}
            step={1}
            precision={0}
            onChange={(v) => setProps({ height: v }, "h")}
          />
        </Pair>
        <Row label="Radius">
          <NumberField
            value={Number(props.radius ?? 24)}
            min={0}
            step={1}
            precision={0}
            onChange={(v) => setProps({ radius: v }, "radius")}
          />
        </Row>
        <Row label="Fill">
          <ColorField
            value={String(props.fill ?? "#ffffff")}
            onChange={(v) => setProps({ fill: v }, "fill")}
          />
        </Row>
        <Row label="Fill alpha">
          <SliderField
            value={Number(props.fillOpacity ?? 0.06)}
            onChange={(v) => setProps({ fillOpacity: v }, "fillalpha")}
          />
        </Row>
        <Row label="Stroke">
          <ColorField
            value={String(props.stroke ?? "#ffffff")}
            onChange={(v) => setProps({ stroke: v }, "stroke")}
          />
        </Row>
        <Row label="Stroke alpha">
          <SliderField
            value={Number(props.strokeOpacity ?? 0.12)}
            onChange={(v) => setProps({ strokeOpacity: v }, "strokealpha")}
          />
        </Row>
      </Section>
    );
  }

  if (layer.type === "image" || layer.type === "video") {
    return (
      <Section title={layer.type === "image" ? "Image" : "Video"}>
        <Row label="Source" hint="Pick a project asset or import a file">
          <AssetField
            value={String(props.src ?? "")}
            kind={layer.type === "image" ? "image" : "video"}
            onChange={(v) => setProps({ src: v }, "src")}
          />
        </Row>
        <Row label="Fit">
          <SegmentedField
            value={String(props.fit ?? "contain")}
            onChange={(v) => setProps({ fit: v }, "fit")}
            options={[
              { value: "contain", label: "Contain" },
              { value: "cover", label: "Cover" },
            ]}
          />
        </Row>
        <Row label="Radius">
          <NumberField
            value={Number(props.radius ?? 0)}
            min={0}
            step={1}
            precision={0}
            onChange={(v) => setProps({ radius: v }, "radius")}
          />
        </Row>
        {layer.type === "video" ? (
          <Row label="Volume">
            <SliderField
              value={Number(props.volume ?? 0)}
              onChange={(v) => setProps({ volume: v }, "vol")}
            />
          </Row>
        ) : null}
      </Section>
    );
  }

  if (layer.type === "composite") {
    return <CompositeSection layer={layer} setProps={setProps} />;
  }

  if (layer.type === "component") {
    return <ComponentSection layer={layer} setProps={setProps} />;
  }

  return null;
};

/**
 * One control for one PropSpec.
 *
 * This is the whole point of the schema system: built-in registry specs and
 * custom-component manifests both reduce to PropSpec, so both get a full
 * inspector from this single renderer - adding a prop to a manifest is all
 * it takes to get a control.
 */
const SpecControl: React.FC<{
  spec: PropSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ spec, value, onChange }) => {
  if (spec.kind === "text") {
    return (
      <TextField
        value={String(value ?? spec.default)}
        multiline={spec.multiline}
        onChange={onChange}
      />
    );
  }
  if (spec.kind === "number") {
    // A bounded number gets a slider beside its input - finding a value by
    // feel beats typing candidates one at a time.
    return spec.min != null && spec.max != null ? (
      <SliderField
        value={Number(value ?? spec.default)}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        precision={2}
        onChange={onChange}
      />
    ) : (
      <NumberField
        value={Number(value ?? spec.default)}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        precision={2}
        onChange={onChange}
      />
    );
  }
  if (spec.kind === "color") {
    return <ColorField value={String(value ?? spec.default)} onChange={onChange} />;
  }
  if (spec.kind === "image") {
    return <AssetField value={String(value ?? spec.default)} kind="image" onChange={onChange} />;
  }
  if (spec.kind === "toggle") {
    return <ToggleField value={Boolean(value ?? spec.default)} onChange={onChange} />;
  }
  return (
    <SelectField
      value={String(value ?? spec.default)}
      onChange={onChange}
      options={spec.options}
    />
  );
};

/**
 * The `component` layer's inspector: pick from the built-in registry or the
 * project's own `components/` directory, then edit whatever props the
 * component's schema declares.
 */
const ComponentSection: React.FC<{
  layer: Layer;
  setProps: (patch: Record<string, unknown>, key: string) => void;
}> = ({ layer, setProps }) => {
  const props = layer.props as Record<string, any>;
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);
  const customs = useComponentStore((s) => s.components);

  const name = String(props.component ?? "");
  const entry = lookupComponent(name);
  const custom = customs.find((c) => c.name === name) ?? null;
  const inner = (props.props ?? {}) as Record<string, unknown>;

  const setInner = (key: string, value: unknown) =>
    setProps({ props: { ...inner, [key]: value } }, `cprop:${key}`);

  const specs: Record<string, PropSpec> | null = entry
    ? entry.props
    : custom
      ? (custom.manifest.props as Record<string, PropSpec>)
      : null;
  const description = entry ? entry.description : custom?.manifest.description ?? "";

  const defaultsFor = (componentName: string): Record<string, unknown> => {
    const builtin = lookupComponent(componentName);
    if (builtin) return componentDefaults(componentName);
    const c = customs.find((x) => x.name === componentName);
    if (!c) return {};
    return Object.fromEntries(
      Object.entries(c.manifest.props).map(([key, spec]) => [key, (spec as PropSpec).default]),
    );
  };

  return (
    <>
      <Section title="Component">
        <Row label="Component">
          <SelectField
            value={name}
            onChange={(v) =>
              // Reset props to the new component's defaults. Carrying the
              // old ones over would leave stale keys the new component
              // ignores but the JSON still records.
              setProps({ component: v, props: defaultsFor(v) }, "component")
            }
            options={[
              ...(entry || custom ? [] : [{ value: name, label: name || "Select a component" }]),
              ...COMPONENT_REGISTRY.map((e) => ({ value: e.name, label: e.label, group: "Built in" })),
              ...customs
                .filter((c) => !lookupComponent(c.name))
                .map((c) => ({
                  value: c.name,
                  label: c.manifest.label,
                  group: `Project - ${c.manifest.category}`,
                })),
            ]}
          />
        </Row>
        {description ? (
          <p className="pl-[84px] text-[10px] leading-[1.5] text-[var(--rm-text-faint)]">
            {description}
          </p>
        ) : null}
        {custom ? (
          <Row label="Source" hint="A TSX file in the project's components folder">
            <button
              type="button"
              onClick={() => openComponentEditor(custom.file)}
              className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[5px] bg-[var(--rm-chrome-high)] px-2 text-left text-[11px] text-[var(--rm-text)] transition-colors duration-100 hover:bg-[var(--rm-accent)]"
            >
              <Code2 className="size-3.5 shrink-0" />
              <span className="truncate">{custom.file}</span>
            </button>
          </Row>
        ) : null}
        {custom?.error ? (
          <p className="pl-[84px] text-[10px] leading-[1.5] text-[var(--rm-danger)] whitespace-pre-wrap">
            {custom.error}
          </p>
        ) : null}
      </Section>

      {specs ? (
        <Section title="Properties">
          {Object.entries(specs).map(([key, spec]) => (
            <Row key={key} label={spec.label}>
              <SpecControl spec={spec} value={inner[key]} onChange={(v) => setInner(key, v)} />
            </Row>
          ))}
        </Section>
      ) : null}
    </>
  );
};

/**
 * The composite layer's node tree, edited as JSON.
 *
 * A composite is a component the AI designed - rows, columns, text, SVG -
 * and its structure is open-ended, so the honest editor for it is the data
 * itself. The JSON is validated on every keystroke but only committed when
 * it parses, so a half-typed edit never corrupts the project.
 */
const CompositeSection: React.FC<{
  layer: Layer;
  setProps: (patch: Record<string, unknown>, key: string) => void;
}> = ({ layer, setProps }) => {
  const props = layer.props as { nodes?: unknown[]; stagger?: number };
  const canonical = React.useMemo(
    () => JSON.stringify(props.nodes ?? [], null, 2),
    [props.nodes],
  );

  const [draft, setDraft] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState(false);

  // An outside edit (undo, an agent writing the file) discards a stale draft.
  React.useEffect(() => {
    setDraft(null);
    setInvalid(false);
  }, [canonical]);

  const count = Array.isArray(props.nodes) ? countNodes(props.nodes) : 0;

  return (
    <Section title="Composite">
      <Row label="Stagger" hint="Frames between node entrances">
        <SliderField
          value={Number(props.stagger ?? 3)}
          min={0}
          max={20}
          step={0.5}
          precision={1}
          onChange={(v) => setProps({ stagger: v }, "stagger")}
        />
      </Row>
      <Row label="Nodes" hint={`${count} node${count === 1 ? "" : "s"} - rows, columns, text, svg, path, image`}>
        <TextField
          value={draft ?? canonical}
          multiline
          mono
          onChange={(v) => {
            setDraft(v);
            try {
              const parsed = JSON.parse(v);
              if (!Array.isArray(parsed)) throw new Error("not an array");
              setInvalid(false);
              setProps({ nodes: parsed }, "nodes");
            } catch {
              setInvalid(true);
            }
          }}
        />
      </Row>
      {invalid ? (
        <p className="pl-[84px] text-[10px] text-[var(--rm-danger)]">
          Invalid JSON - the last valid tree is still rendering.
        </p>
      ) : null}
    </Section>
  );
};

function countNodes(nodes: unknown[]): number {
  let n = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    n += 1;
    const children = (node as { children?: unknown[] }).children;
    if (Array.isArray(children)) n += countNodes(children);
  }
  return n;
}

/**
 * A project-asset picker: choose from imported assets of a kind, or import
 * new files without leaving the inspector. The raw path stays editable for
 * hand-written references.
 */
const AssetField: React.FC<{
  value: string;
  kind: "image" | "video" | "audio";
  onChange: (value: string) => void;
}> = ({ value, kind, onChange }) => {
  const project = useProjectStore((s) => s.project);
  const dirName = useProjectStore((s) => s.dirName);
  const apply = useProjectStore((s) => s.apply);
  const [busy, setBusy] = React.useState(false);

  const assets = (project?.assets ?? []).filter((a) => a.kind === kind);

  const importAndPick = async () => {
    if (!dirName || busy) return;
    setBusy(true);
    try {
      const result = await bridge.assets.import(dirName);
      if (!result.canceled && result.imported.length) {
        apply("Import assets", (p) => ops.registerAssets(p, result.imported));
        const first = result.imported.find((a) => a.kind === kind) ?? result.imported[0];
        if (first) onChange(first.src);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div className="min-w-0 flex-1">
        {assets.length ? (
          <SelectField
            value={value}
            onChange={onChange}
            options={[
              { value: "", label: "None" },
              // Keep a hand-typed path selectable even if it is not a
              // registered asset - deleting it silently would lose data.
              ...(value && !assets.some((a) => a.src === value)
                ? [{ value, label: value }]
                : []),
              ...assets.map((a) => ({ value: a.src, label: a.name })),
            ]}
          />
        ) : (
          <TextField value={value} placeholder="assets/..." onChange={onChange} />
        )}
      </div>
      <IconButton title="Import media" onClick={() => void importAndPick()} disabled={busy}>
        <Upload className="size-3.5" />
      </IconButton>
    </div>
  );
};

/**
 * Entrance and exit animation.
 *
 * Presented as an optional block with an on/off toggle rather than a
 * "none" preset, because absence of an animation is a distinct state in the
 * model - `animation.enter` is undefined - and conflating it with a preset
 * named "none" would mean writing a no-op animation into every layer.
 */
const AnimationSection: React.FC<{ layer: Layer; which: "enter" | "exit" }> = ({
  layer,
  which,
}) => {
  const apply = useProjectStore((s) => s.apply);
  const animation = layer.animation[which];

  const update = (patch: Parameters<typeof ops.updateLayerAnimation>[3]) =>
    apply(which === "enter" ? "Change entrance" : "Change exit", (p) =>
      ops.updateLayerAnimation(p, layer.id, which, patch),
    );

  return (
    <Section
      title={which === "enter" ? "Entrance" : "Exit"}
      actions={
        <ToggleField
          value={Boolean(animation)}
          label={`Enable ${which}`}
          onChange={(on) =>
            update(
              on
                ? { preset: which === "enter" ? "riseFade" : "fade", durationInFrames: 20, delay: 0 }
                : null,
            )
          }
        />
      }
    >
      {animation ? (
        <>
          <Row label="Preset">
            <SelectField
              value={animation.preset}
              onChange={(v) => update({ preset: v })}
              options={presetOptions()}
            />
          </Row>
          <Pair label="Length / delay">
            <NumberField
              value={animation.durationInFrames}
              min={1}
              step={1}
              precision={0}
              suffix="f"
              onChange={(v) => update({ durationInFrames: Math.max(1, Math.round(v)) })}
            />
            <NumberField
              value={animation.delay}
              min={0}
              step={1}
              precision={0}
              suffix="f"
              onChange={(v) => update({ delay: Math.max(0, Math.round(v)) })}
            />
          </Pair>
          <Row label="Distance">
            <NumberField
              value={animation.distance ?? 48}
              step={1}
              precision={0}
              onChange={(v) => update({ distance: v })}
            />
          </Row>
          <Row label="Spring" hint="Physical settle instead of a fixed curve">
            <ToggleField
              value={Boolean(animation.spring)}
              onChange={(v) => update({ spring: v })}
            />
          </Row>
        </>
      ) : (
        <p className="text-[11px] text-[var(--rm-text-faint)]">
          No {which === "enter" ? "entrance" : "exit"} animation.
        </p>
      )}
    </Section>
  );
};

/* ------------------------------------------------------------------ *
 * Audio
 * ------------------------------------------------------------------ */

const AudioInspector: React.FC<{ project: Project; clip: Project["audio"][number] }> = ({
  clip,
}) => {
  const apply = useProjectStore((s) => s.apply);
  const select = useEditorStore((s) => s.select);

  const update = (patch: Partial<typeof clip>, key: string) =>
    apply("Change audio", (p) => ops.updateAudio(p, clip.id, patch), {
      coalesceKey: `audio:${key}:${clip.id}`,
    });

  return (
    <div className="rm-scroll flex-1 overflow-y-auto">
      <Header
        title="Audio"
        subtitle={clip.name}
        actions={
          <IconButton
            title="Remove audio"
            danger
            onClick={() => {
              apply("Remove audio", (p) => ops.removeAudio(p, clip.id));
              select({ kind: "none" });
            }}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        }
      />

      <Section title="Clip">
        <Row label="Name">
          <TextField value={clip.name} onChange={(v) => update({ name: v }, "name")} />
        </Row>
        <Row label="Role">
          <SelectField
            value={clip.kind}
            onChange={(v) => update({ kind: v as typeof clip.kind }, "kind")}
            options={[
              { value: "music", label: "Music" },
              { value: "voice", label: "Voiceover" },
              { value: "sfx", label: "Sound effect" },
            ]}
          />
        </Row>
        <Row label="Source">
          <TextField
            value={clip.src}
            placeholder="assets/audio/..."
            onChange={(v) => update({ src: v }, "src")}
          />
        </Row>
      </Section>

      <Section title="Timing">
        <Pair label="Start / length">
          <NumberField
            value={clip.start}
            min={0}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) => update({ start: Math.max(0, Math.round(v)) }, "start")}
          />
          <NumberField
            value={clip.duration}
            min={1}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) => update({ duration: Math.max(1, Math.round(v)) }, "dur")}
          />
        </Pair>
        <Row label="Trim in" hint="Frames skipped from the head of the source file">
          <NumberField
            value={clip.trimStart}
            min={0}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) => update({ trimStart: Math.max(0, Math.round(v)) }, "trim")}
          />
        </Row>
      </Section>

      <Section title="Mix">
        <Row label="Volume">
          <SliderField value={clip.volume} onChange={(v) => update({ volume: v }, "vol")} />
        </Row>
        <Pair label="Fades">
          <NumberField
            value={clip.fadeIn}
            min={0}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) => update({ fadeIn: Math.max(0, Math.round(v)) }, "fin")}
          />
          <NumberField
            value={clip.fadeOut}
            min={0}
            step={1}
            precision={0}
            suffix="f"
            onChange={(v) => update({ fadeOut: Math.max(0, Math.round(v)) }, "fout")}
          />
        </Pair>
        <Row label="Mute">
          <ToggleField value={clip.muted} onChange={(v) => update({ muted: v }, "mute")} />
        </Row>
        <Row label="Solo">
          <ToggleField value={clip.solo} onChange={(v) => update({ solo: v }, "solo")} />
        </Row>
      </Section>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

const Header: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <header className="rm-hairline-b flex h-10 items-center gap-2 px-3">
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
        {title}
      </p>
      {subtitle ? (
        <p className="truncate text-[12px] leading-tight text-[var(--rm-text)]">{subtitle}</p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
  </header>
);
