import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { createProject, createScene, createLayer } from "./src/shared/project.js";
const CHROME = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const SP = process.argv[2];

const CODE = `const glass = {
  backdropFilter: "blur(48px) saturate(180%)",
  background: "rgb(255 255 255 / 0.72)",
  borderRadius: 42,
};`;

const scenes = [
  createScene({ name: "Card", durationInFrames: 150, layers: [
    createLayer({ type: "background", duration: 150, props: { kind: "studio" } }),
    createLayer({ type: "component", duration: 150, layout: { preset: "splitLeft" },
      props: { component: "HeroTitle", props: { eyebrow: "Introducing", text: "Glass", size: 96, align: "left",
        caption: "A material, not a filter." } } }),
    createLayer({ type: "component", duration: 150, layout: { preset: "splitRight" },
      props: { component: "GlassCard", props: { eyebrow: "New", title: "Studio", caption: "Frosted, lit from above.", width: 640, height: 400 } } }),
  ]}),
  createScene({ name: "Bar", durationInFrames: 150, layers: [
    createLayer({ type: "background", duration: 150, props: { kind: "studio" } }),
    createLayer({ type: "component", duration: 150, layout: { preset: "topBand" },
      props: { component: "GlassBar", props: { items: "Overview | Library | Settings", active: 2, fontSize: 26 } } }),
    createLayer({ type: "component", duration: 150, layout: { preset: "middleBand" },
      props: { component: "CodeBlock", props: { filename: "glass.ts", code: CODE, fontSize: 22, width: 900, lineStagger: 2, focusLines: "2-3", focusAt: 40 } } }),
  ]}),
];

const project = createProject({ name: "Glass", theme: "glass",
  composition: { width: 1920, height: 1080, fps: 30 }, scenes });

const serveUrl = await bundle({ entryPoint: "/home/user/rawmotion/src/remotion/entry.tsx" });
const inputProps = { project };
const composition = await selectComposition({ serveUrl, id: "RawMotion", inputProps, browserExecutable: CHROME });
await renderStill({ composition, serveUrl, output: `${SP}/glass-1.png`, frame: 110, inputProps, browserExecutable: CHROME, scale: 0.5 });
await renderStill({ composition, serveUrl, output: `${SP}/glass-2.png`, frame: 250, inputProps, browserExecutable: CHROME, scale: 0.5 });
console.log("ok");
