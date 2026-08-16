import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Persistence, against a real filesystem.
 *
 * These are the paths where a bug costs a user their work rather than just
 * misdrawing something, so they run against a temp directory instead of a
 * mocked fs - the atomic-rename save and the "repair a project cloned
 * without its empty directories" behaviour are both properties of the real
 * filesystem, and a mock would assert nothing.
 */

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "rawmotion-test-"));

vi.mock("electron", () => ({
  app: { getPath: () => globalThis.__RM_TEST_HOME },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

globalThis.__RM_TEST_HOME = workspace;

const {
  createProjectOnDisk,
  importAsset,
  listProjectFiles,
  listProjects,
  openProjectFromDisk,
  readProjectFile,
  saveProject,
  scanAssets,
  writeTextFile,
} = await import("./project-store.js");

const { auroraLaunchTemplate } = await import("../shared/templates.js");
const { projectDurationInFrames } = await import("../shared/project.js");

afterAll(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

describe("create and open", () => {
  it("creates the full directory skeleton", async () => {
    const { dir, dirName } = await createProjectOnDisk({ name: "Skeleton" });

    expect(dirName).toBe("Skeleton.rawmotion");
    for (const sub of ["assets/images", "assets/audio", "components", "renders", "cache"]) {
      const stat = await fs.stat(path.join(dir, sub));
      expect(stat.isDirectory(), sub).toBe(true);
    }
    await expect(fs.access(path.join(dir, "project.json"))).resolves.toBeUndefined();
  });

  it("does not overwrite an existing project of the same name", async () => {
    const a = await createProjectOnDisk({ name: "Twice" });
    const b = await createProjectOnDisk({ name: "Twice" });

    expect(a.dirName).toBe("Twice.rawmotion");
    expect(b.dirName).toBe("Twice 2.rawmotion");
    expect(b.project.id).not.toBe(a.project.id);
  });

  it("round-trips a real project through disk without changing it", async () => {
    const template = auroraLaunchTemplate();
    const { dirName, project: created } = await createProjectOnDisk({
      name: "Aurora",
      composition: template.composition,
      scenes: template.scenes,
    });

    const { project: reopened } = await openProjectFromDisk(dirName);

    expect(reopened.scenes).toHaveLength(template.scenes.length);
    expect(reopened.scenes.map((s) => s.name)).toEqual(
      template.scenes.map((s) => s.name),
    );
    expect(projectDurationInFrames(reopened)).toBe(projectDurationInFrames(created));

    // Nested component props must survive JSON exactly.
    const lockup = reopened.scenes.at(-1).layers.find((l) => l.type === "component");
    expect(lockup.props.props.wordmark).toBe("Raw Motion");
  });

  it("recreates missing subdirectories on open", async () => {
    // A project committed to git arrives without its empty directories.
    const { dirName, dir } = await createProjectOnDisk({ name: "Cloned" });
    await fs.rm(path.join(dir, "renders"), { recursive: true });
    await fs.rm(path.join(dir, "assets"), { recursive: true });

    await openProjectFromDisk(dirName);

    expect((await fs.stat(path.join(dir, "renders"))).isDirectory()).toBe(true);
    expect((await fs.stat(path.join(dir, "assets/images"))).isDirectory()).toBe(true);
  });

  it("reports a hand-edited syntax error usefully", async () => {
    const { dirName, dir } = await createProjectOnDisk({ name: "Broken" });
    await fs.writeFile(path.join(dir, "project.json"), "{ not json ", "utf8");

    await expect(openProjectFromDisk(dirName)).rejects.toThrow(/not valid JSON/i);
  });

  it("refuses a directory outside the workspace", async () => {
    await expect(openProjectFromDisk("../escape.rawmotion")).rejects.toThrow(/invalid/i);
  });
});

describe("save", () => {
  it("persists edits and refreshes the timestamp", async () => {
    const { dirName, project } = await createProjectOnDisk({ name: "Saving" });

    const edited = { ...project, name: "Renamed" };
    const saved = await saveProject(dirName, edited);
    expect(saved.name).toBe("Renamed");

    const { project: reopened } = await openProjectFromDisk(dirName);
    expect(reopened.name).toBe("Renamed");
    expect(Date.parse(reopened.meta.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(project.meta.createdAt),
    );
  });

  it("leaves no temporary files behind", async () => {
    // The save is write-then-rename; a leaked .tmp would mean the rename
    // did not happen and the previous version is what is actually on disk.
    const { dirName, dir, project } = await createProjectOnDisk({ name: "Atomic" });
    await saveProject(dirName, project);

    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.includes(".tmp"))).toHaveLength(0);
  });

  it("normalises on the way in, so a malformed edit cannot corrupt the file", async () => {
    const { dirName, project } = await createProjectOnDisk({ name: "Normalising" });

    await saveProject(dirName, {
      ...project,
      scenes: [{ durationInFrames: -50, layers: [{ type: "wat" }] }],
    });

    const { project: reopened } = await openProjectFromDisk(dirName);
    expect(reopened.scenes[0].durationInFrames).toBeGreaterThanOrEqual(1);
    expect(reopened.scenes[0].layers[0].type).toBe("text");
  });
});

describe("listProjects", () => {
  it("lists projects newest first and survives a broken one", async () => {
    const { dir } = await createProjectOnDisk({ name: "Listable" });
    await fs.writeFile(path.join(dir, "project.json"), "<<<", "utf8");

    const rows = await listProjects();
    const broken = rows.find((r) => r.dirName === "Listable.rawmotion");

    // Hiding an unreadable project would leave the user no way to notice it.
    expect(broken?.broken).toBe(true);
    expect(rows.every((r, i) => i === 0 || rows[i - 1].updatedAt >= r.updatedAt)).toBe(true);
  });

  it("ignores directories that are not projects", async () => {
    await fs.mkdir(path.join(workspace, "Raw Motion", "not-a-project"), { recursive: true });
    const rows = await listProjects();
    expect(rows.some((r) => r.dirName === "not-a-project")).toBe(false);
  });
});

describe("sandboxed file access", () => {
  it("reads and writes text inside the project", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Files" });

    await writeTextFile(dirName, "components/Custom.tsx", "export const x = 1;\n");
    const read = await readProjectFile(dirName, "components/Custom.tsx");
    expect(read.content).toBe("export const x = 1;\n");

    const listing = await listProjectFiles(dirName, "components");
    expect(listing.map((r) => r.name)).toContain("Custom.tsx");
  });

  it("refuses to escape the project", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Escape" });

    await expect(readProjectFile(dirName, "../../../etc/passwd")).rejects.toThrow(/escape/i);
    await expect(writeTextFile(dirName, "../evil.ts", "x")).rejects.toThrow(/escape/i);
    await expect(listProjectFiles(dirName, "..")).rejects.toThrow(/escape/i);
  });

  it("refuses binary file types as text", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Binary" });
    await expect(readProjectFile(dirName, "assets/images/x.png")).rejects.toThrow(
      /not editable as text/i,
    );
  });

  it("lists directories before files", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Ordering" });
    await writeTextFile(dirName, "notes.md", "# hi");

    const rows = await listProjectFiles(dirName);
    const firstFile = rows.findIndex((r) => r.kind === "file");
    const lastDir = rows.map((r) => r.kind).lastIndexOf("directory");
    expect(lastDir).toBeLessThan(firstFile);
  });
});

describe("assets", () => {
  let source;

  beforeAll(async () => {
    source = path.join(workspace, "source-image.png");
    await fs.writeFile(source, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("copies an import into the project rather than referencing it", async () => {
    const { dirName, dir } = await createProjectOnDisk({ name: "Assets" });
    const asset = await importAsset(dirName, source);

    expect(asset.kind).toBe("image");
    expect(asset.src).toBe("assets/images/source-image.png");

    // A project that points outside itself breaks the moment it is moved.
    await expect(fs.access(path.join(dir, asset.src))).resolves.toBeUndefined();
  });

  it("does not clobber an existing asset of the same name", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Collide" });
    const first = await importAsset(dirName, source);
    const second = await importAsset(dirName, source);

    expect(second.src).not.toBe(first.src);
    expect(second.src).toContain("source-image 2.png");
  });

  it("rejects an unsupported file type", async () => {
    const { dirName } = await createProjectOnDisk({ name: "Unsupported" });
    const bad = path.join(workspace, "notes.xyz");
    await fs.writeFile(bad, "x");

    await expect(importAsset(dirName, bad)).rejects.toThrow(/unsupported/i);
  });

  it("scans files dropped in by hand, without registration", async () => {
    // The premise of the agent workflow: Claude drops a file into assets/
    // and it shows up.
    const { dirName, dir } = await createProjectOnDisk({ name: "Scan" });
    await fs.writeFile(path.join(dir, "assets/audio/score.mp3"), "x");

    const rows = await scanAssets(dirName);
    const found = rows.find((r) => r.name === "score.mp3");
    expect(found?.kind).toBe("audio");
    expect(found?.src).toBe("assets/audio/score.mp3");
  });

  it("tags generated assets", async () => {
    const { dirName, dir } = await createProjectOnDisk({ name: "Generated" });
    await fs.writeFile(path.join(dir, "assets/generated/hero.png"), "x");

    const rows = await scanAssets(dirName);
    expect(rows.find((r) => r.name === "hero.png")?.origin).toBe("generated");
  });
});
