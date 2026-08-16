/**
 * Starter projects.
 *
 * Lives in `shared` because both processes need it: the renderer offers
 * these when creating a project, and the main process instantiates them.
 *
 * The demo is not a technical test. It is the argument for the product - the
 * first thing a new user sees, and the reference for what "premium" means in
 * this system. Everything in it is procedural: no bundled images, no fonts
 * to install, nothing to download. It renders identically on a fresh machine.
 *
 * A note on the numbers below: they are all deliberate, and they are all
 * multiples of the frame rate or close to it. Motion that lands on
 * half-second boundaries feels composed; motion timed to arbitrary frame
 * counts feels like a first draft.
 */

import { createLayer, createProject, createScene } from "./project.js";

/** The accent used across the demo. One hue, one accent - see docs/design.md. */
const ACCENT = "#8b9bff";
const HUE = 252;

/**
 * A background layer filling its scene.
 *
 * Every scene gets one. The alternative - a single background layer spanning
 * the project - would prevent per-scene camera moves from parallaxing
 * against it, which is most of what makes the demo read as three-dimensional.
 */
function backdrop(durationInFrames, overrides = {}) {
  return createLayer({
    type: "background",
    name: "Backdrop",
    start: 0,
    duration: durationInFrames,
    props: {
      kind: "depth",
      hue: HUE,
      intensity: 1,
      speed: 1,
      particles: 55,
      grain: 0.05,
      vignette: 1,
      ...overrides,
    },
  });
}

/**
 * "Aurora" - a product launch in five scenes, 22 seconds at 30fps.
 *
 * Structure follows the shape of a real launch film: a held beat to settle
 * the eye, the claim, the object, the substance, the mark.
 *
 * @returns {import("./project.js").Project}
 */
export function auroraLaunchTemplate() {
  return createProject({
    name: "Aurora Launch",
    composition: { width: 1920, height: 1080, fps: 30, background: "#06060a" },
    scenes: [
      /* 1. Cold open. Almost nothing happens, which is the point - it gives
         the grain and the drifting light a moment to establish the world
         before any information arrives. */
      createScene({
        name: "Cold open",
        durationInFrames: 90,
        camera: { move: "push", amount: 0.05 },
        transition: { type: "blur", durationInFrames: 18 },
        layers: [
          backdrop(90, { particles: 35, intensity: 0.8 }),
          createLayer({
            type: "text",
            name: "Eyebrow",
            start: 18,
            duration: 72,
            transform: { y: 0 },
            props: {
              text: "AURORA",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 0.46,
              color: "#9aa0b8",
              align: "center",
              split: "chars",
            },
            animation: {
              enter: { preset: "fade", durationInFrames: 30, delay: 0 },
              exit: { preset: "fade", durationInFrames: 18, delay: 0 },
            },
          }),
        ],
      }),

      /* 2. The claim. Camera pushes through the title so the cut into the
         product arrives with momentum already built. */
      createScene({
        name: "Statement",
        durationInFrames: 150,
        camera: { move: "push", amount: 0.09 },
        transition: { type: "fade", durationInFrames: 20 },
        layers: [
          backdrop(150),
          createLayer({
            type: "component",
            name: "Headline",
            start: 0,
            duration: 150,
            props: {
              component: "HeroTitle",
              props: {
                eyebrow: "Introducing",
                text: "Motion, written\nin code",
                caption:
                  "A design environment where every frame is a component you can read, edit and render.",
                accent: ACCENT,
                size: 118,
                align: "center",
              },
            },
            animation: {
              enter: { preset: "depthIn", durationInFrames: 34, delay: 6 },
              exit: { preset: "blurIn", durationInFrames: 20, delay: 0 },
            },
          }),
        ],
      }),

      /* 3. The object. Camera pulls back to hand the frame to the card, and
         a warm rim light sits behind it to separate it from the backdrop. */
      createScene({
        name: "Product reveal",
        durationInFrames: 180,
        camera: { move: "pull", amount: 0.12 },
        transition: { type: "slide", durationInFrames: 18 },
        layers: [
          backdrop(180, { particles: 70, intensity: 1.05 }),
          createLayer({
            type: "background",
            name: "Rim light",
            start: 0,
            duration: 180,
            props: { kind: "glow", hue: 268, x: 0.5, y: 0.44, size: 0.9, intensity: 1.15 },
            animation: { enter: { preset: "fade", durationInFrames: 40, delay: 8 } },
          }),
          createLayer({
            type: "component",
            name: "Product card",
            start: 8,
            duration: 172,
            transform: { y: -30 },
            props: {
              component: "ProductCard",
              props: {
                title: "Raw Motion",
                caption: "AI-native motion design",
                badge: "v1.0",
                accent: ACCENT,
                width: 760,
                height: 460,
                sway: 2.5,
              },
            },
            animation: { enter: { preset: "depthIn", durationInFrames: 40, delay: 0 } },
          }),
          createLayer({
            type: "text",
            name: "Sub",
            start: 54,
            duration: 126,
            transform: { y: 330 },
            props: {
              text: "Preview, edit and export the same composition.",
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: -0.01,
              color: "#8e93a8",
              align: "center",
              split: "words",
            },
            animation: { enter: { preset: "riseFade", durationInFrames: 26, delay: 0, distance: 22 } },
          }),
        ],
      }),

      /* 4. The substance. A slow lateral pan gives the list somewhere to
         live without the frame going static for six seconds. */
      createScene({
        name: "Capabilities",
        durationInFrames: 180,
        camera: { move: "pan", amount: 0.035 },
        transition: { type: "fade", durationInFrames: 20 },
        layers: [
          backdrop(180, { particles: 45, intensity: 0.9 }),
          createLayer({
            type: "text",
            name: "Section title",
            start: 0,
            duration: 180,
            transform: { x: -420, y: -180 },
            props: {
              text: "Built for\nreal work",
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: -0.035,
              lineHeight: 1.05,
              color: "#ffffff",
              align: "left",
              maxWidth: 0.4,
            },
            animation: { enter: { preset: "riseFade", durationInFrames: 30, delay: 4 } },
          }),
          createLayer({
            type: "component",
            name: "Capabilities",
            start: 14,
            duration: 166,
            transform: { x: 300, y: 20 },
            props: {
              component: "FeatureList",
              props: {
                items:
                  "Code-first compositions\nLive preview while you edit\nScenes, layers and keyframes\nFrame-accurate MP4 export\nEditable by you or by Claude",
                accent: ACCENT,
                fontSize: 36,
              },
            },
            animation: { enter: { preset: "fade", durationInFrames: 20, delay: 0 } },
          }),
        ],
      }),

      /* 5. The mark. Held long enough to read, with the background quieted
         so the lockup is the only thing moving. */
      createScene({
        name: "Outro",
        durationInFrames: 120,
        camera: { move: "push", amount: 0.04 },
        transition: { type: "none", durationInFrames: 0 },
        layers: [
          backdrop(120, { particles: 28, intensity: 0.7, grain: 0.045 }),
          createLayer({
            type: "component",
            name: "Lockup",
            start: 6,
            duration: 114,
            props: {
              component: "LogoLockup",
              props: { wordmark: "Raw Motion", accent: ACCENT, size: 104 },
            },
            animation: { exit: { preset: "fade", durationInFrames: 24, delay: 0 } },
          }),
          createLayer({
            type: "text",
            name: "Tagline",
            start: 40,
            duration: 80,
            transform: { y: 150 },
            props: {
              text: "Everything is editable.",
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: 0.02,
              color: "#7b8098",
              align: "center",
            },
            animation: {
              enter: { preset: "riseFade", durationInFrames: 26, delay: 0, distance: 16 },
              exit: { preset: "fade", durationInFrames: 20, delay: 0 },
            },
          }),
        ],
      }),
    ],
  });
}

/** A single empty scene. The starting point for building from nothing. */
export function blankTemplate(name = "Untitled") {
  return createProject({
    name,
    scenes: [
      createScene({
        name: "Scene 1",
        durationInFrames: 150,
        layers: [backdrop(150)],
      }),
    ],
  });
}

/**
 * Templates offered in the launcher.
 *
 * `build` returns a whole project, but only its `scenes` and `composition`
 * are used - the name comes from the user.
 */
export const TEMPLATES = [
  {
    id: "aurora",
    label: "Aurora launch",
    description: "A five-scene product film. Everything procedural - no assets required.",
    build: auroraLaunchTemplate,
  },
  {
    id: "blank",
    label: "Blank",
    description: "One scene with a cinematic backdrop.",
    build: () => blankTemplate(),
  },
];
