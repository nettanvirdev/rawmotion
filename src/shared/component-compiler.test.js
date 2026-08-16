/**
 * The compile -> extract-manifest pipeline, run against real files in a
 * temporary directory with the real esbuild. This is the platform's
 * load-bearing test: if it passes, a project component compiles, exposes
 * its manifest, and can import rawmotion and sibling files.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildEntry,
  compileComponentFile,
  discoverComponents,
  extractManifest,
} from "./component-compiler.js";
import { componentTemplate } from "./component-manifest.js";

let dir;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "rm-components-"));
  await fs.mkdir(path.join(dir, "components"), { recursive: true });
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function write(name, content) {
  await fs.writeFile(path.join(dir, "components", name), content, "utf8");
}

describe("compileComponentFile + extractManifest", () => {
  it("compiles the template and yields its manifest and default export", async () => {
    await write("StatBadge.tsx", componentTemplate("StatBadge"));
    const { code } = await compileComponentFile(path.join(dir, "components", "StatBadge.tsx"));

    // Externals stay external - the runtime provides them.
    expect(code).toContain('require("react');
    expect(code).toContain('require("rawmotion")');

    const { manifest, hasDefault } = extractManifest(code, "StatBadge");
    expect(hasDefault).toBe(true);
    expect(manifest.name).toBe("StatBadge");
    expect(manifest.props.title.kind).toBe("text");
    expect(manifest.props.size.kind).toBe("number");
  });

  it("supports importing sibling components (nesting)", async () => {
    await write(
      "Inner.tsx",
      `import React from "react";
export const manifest = { name: "Inner" };
export default function Inner() { return <span>inner</span>; }`,
    );
    await write(
      "Outer.tsx",
      `import React from "react";
import Inner from "./Inner";
export const manifest = { name: "Outer", props: { n: { type: "number", default: 2 } } };
export default function Outer() { return <div><Inner /></div>; }`,
    );

    const entry = await buildEntry(dir, "Outer.tsx");
    expect(entry.error).toBeNull();
    // Inner is bundled in, not left as an unresolvable require.
    expect(entry.code).not.toContain('require("./Inner")');
    expect(entry.manifest.props.n.default).toBe(2);
  });

  it("reads top-level rawmotion constants during extraction without exploding", async () => {
    await write(
      "UsesRuntime.tsx",
      `import React from "react";
import { EASINGS, staggerDelay } from "rawmotion";
const curve = EASINGS.outExpo;
const d = staggerDelay(1, 10, 2, 30);
export const manifest = { name: "UsesRuntime" };
export default function UsesRuntime() { return <div />; }`,
    );
    const entry = await buildEntry(dir, "UsesRuntime.tsx");
    expect(entry.error).toBeNull();
    expect(entry.name).toBe("UsesRuntime");
  });
});

describe("buildEntry error reporting", () => {
  it("returns a located compile error instead of throwing", async () => {
    await write("Broken.tsx", "export default function Broken( { return <div>; }");
    const entry = await buildEntry(dir, "Broken.tsx");
    expect(entry.code).toBe("");
    expect(entry.error).toMatch(/Broken\.tsx:\d+/);
  });

  it("flags a missing default export", async () => {
    await write("NoDefault.tsx", "export const manifest = { name: 'NoDefault' };");
    const entry = await buildEntry(dir, "NoDefault.tsx");
    expect(entry.error).toMatch(/default export/);
  });

  it("rejects imports outside the allowed surface", async () => {
    await write(
      "BadImport.tsx",
      `import React from "react";
import fs from "node:fs";
export default function BadImport() { return <div>{String(fs)}</div>; }`,
    );
    const entry = await buildEntry(dir, "BadImport.tsx");
    // esbuild cannot resolve node:fs for a browser platform, so the error
    // arrives at compile time - before the code could ever run anywhere.
    expect(entry.error).toBeTruthy();
  });
});

describe("discoverComponents", () => {
  it("returns every component file, sorted, and tolerates a missing directory", async () => {
    const all = await discoverComponents(dir);
    const names = all.map((c) => path.basename(c.file));
    expect(names).toContain("StatBadge.tsx");
    expect(names).toContain("Outer.tsx");
    expect(names).toEqual([...names].sort());

    const empty = await discoverComponents(path.join(dir, "does-not-exist"));
    expect(empty).toEqual([]);
  });
});
