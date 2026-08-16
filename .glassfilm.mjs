import { call, json, saveImages, client } from "./.drive.mjs";
const SHOTS = process.argv[2];

const bg = { type: "background", name: "Backdrop", props: { kind: "studio" } };

const CODE = `const surface = {
  background: "rgb(255 255 255 / 0.72)",
  backdropFilter: "blur(48px) saturate(180%)",
  borderRadius: 42,
  boxShadow: [
    "inset 0 1.5px 0 0 rgb(255 255 255 / 0.95)",
    "0 2px 10px -2px rgb(0 0 0 / 0.07)",
    "0 40px 90px -24px rgb(0 0 0 / 0.22)",
  ].join(", "),
};`;

const p = await json("create_project", {
  name: "06-glass-lumen", width: 1920, height: 1080, fps: 30, theme: "glass",
});
const dirName = p.dirName;

await json("build_scenes", {
  dirName,
  scenes: [
    { name: "Cold open", durationInFrames: 75, camera: { move: "push", amount: 0.04 },
      transition: { type: "blur", durationInFrames: 16 },
      layers: [bg,
        { type: "text", name: "Mark", start: 12, layout: { preset: "center" },
          props: { text: "LUMEN", fontSize: 24, fontWeight: 500, letterSpacing: 0.52 },
          enter: { preset: "fade", durationInFrames: 30 }, exit: { preset: "fade", durationInFrames: 14 } }]},

    { name: "Claim", durationInFrames: 145, camera: { move: "push", amount: 0.07 },
      transition: { type: "fade", durationInFrames: 18 },
      layers: [bg,
        { type: "component", name: "Headline", layout: { preset: "center" },
          props: { component: "HeroTitle", props: { eyebrow: "Introducing", text: "Light, made\nof glass", size: 112,
            caption: "A surface you can see through, and still read." } },
          enter: { preset: "depthIn", durationInFrames: 32, delay: 4 }, exit: { preset: "blurIn", durationInFrames: 18 } }]},

    { name: "Object", durationInFrames: 170, camera: { move: "pull", amount: 0.1 },
      transition: { type: "fade", durationInFrames: 18 },
      layers: [bg,
        { type: "component", name: "Chapter", layout: { preset: "splitLeft" },
          props: { component: "Chapter", props: { number: "01", title: "One material", subtitle: "Frosted, lit from above, alive to what is behind it.", size: 56 } },
          enter: { preset: "riseFade", durationInFrames: 26 } },
        { type: "component", name: "Card", start: 12, layout: { preset: "splitRight" },
          props: { component: "GlassCard", props: { eyebrow: "New", title: "Lumen", caption: "Frosted, lit from above.", width: 640, height: 400 } },
          enter: { preset: "depthIn", durationInFrames: 34 } }]},

    { name: "Interface", durationInFrames: 165, camera: { move: "push", amount: 0.04 },
      transition: { type: "fade", durationInFrames: 18 },
      layers: [bg,
        { type: "component", name: "Bar", start: 4, layout: { preset: "topBand" },
          props: { component: "GlassBar", props: { items: "Overview | Library | Settings", active: 2, fontSize: 26 } } },
        { type: "component", name: "Code", start: 20, layout: { preset: "middleBand" },
          props: { component: "CodeBlock", props: { filename: "surface.ts", code: CODE, fontSize: 19, width: 900, lineStagger: 1.8,
            focusLines: "2-3", focusAt: 76 } },
          enter: { preset: "scaleIn", durationInFrames: 24 } },
        { type: "component", name: "Note", start: 112, layout: { preset: "caption" },
          props: { component: "Callout", props: { label: "MATERIAL", text: "Blur alone is plastic. The saturation is what makes it glass.", fontSize: 21, width: 720 } } }]},

    { name: "Range", durationInFrames: 130, camera: { move: "push", amount: 0.04 },
      transition: { type: "fade", durationInFrames: 18 },
      layers: [bg,
        { type: "text", name: "Heading", layout: { preset: "topBand" },
          props: { text: "Every surface", fontSize: 58, fontWeight: 600, letterSpacing: -0.035 },
          enter: { preset: "riseFade", durationInFrames: 26 } },
        { type: "component", name: "Stats", start: 14, layout: { preset: "middleBand" },
          props: { component: "StatGrid", props: { stats: "1 | material\n8 | themes\n0 | images", size: 88 } } }]},

    { name: "Outro", durationInFrames: 115, camera: { move: "push", amount: 0.03 },
      transition: { type: "none", durationInFrames: 0 },
      layers: [bg,
        { type: "component", name: "Lockup", start: 6, layout: { preset: "center" },
          props: { component: "LogoLockup", props: { wordmark: "Lumen", size: 116 } },
          exit: { preset: "fade", durationInFrames: 22 } },
        { type: "text", name: "Tag", start: 38, layout: { preset: "bottomBand" },
          props: { text: "lumen.design", fontSize: 24, letterSpacing: 0.04 },
          enter: { preset: "riseFade", durationInFrames: 24, distance: 14 }, exit: { preset: "fade", durationInFrames: 18 } }]},
  ],
});

const tl = await json("timeline", { dirName });
console.log(`glass film: ${tl.durationInFrames} frames ${tl.durationTimecode}`);

const sheet = await call("render_contact_sheet", { dirName, scale: 0.3 });
console.log("shots:", (await saveImages(sheet, `${SHOTS}/glass`)).length);
console.log(JSON.stringify({ dirName }));
await client.close();
