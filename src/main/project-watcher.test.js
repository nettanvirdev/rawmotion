import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * The live-edit loop.
 *
 * This is the mechanism behind Raw Motion's central claim: Claude edits
 * `project.json` with ordinary file tools and the preview updates. The two
 * behaviours worth testing are the ones that are wrong in the obvious
 * implementation:
 *
 *  - an external edit must reach the renderer;
 *  - the app's *own* saves must not, or every save would bounce back and
 *    overwrite whatever the user typed during the round trip.
 */

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "rawmotion-watch-"));

vi.mock("electron", () => ({
  app: { getPath: () => workspace },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

const { watchProject, stopWatching } = await import("./project-watcher.js");
const { createProjectOnDisk, writeProjectFile } = await import("./project-store.js");
const { serializeProject } = await import("../shared/project.js");

afterEach(() => stopWatching());
afterAll(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

/** Wait for the watcher to fire, or resolve null on timeout. */
function nextChange(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    changeHandler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
  });
}

let changeHandler = () => {};
const onChange = (payload) => changeHandler(payload);

describe("watchProject", () => {
  it("reports an external edit", async () => {
    const { dir, project } = await createProjectOnDisk({ name: "Watched" });
    watchProject(dir, onChange);

    const pending = nextChange();
    // Simulates an agent writing the file directly.
    await fs.writeFile(
      path.join(dir, "project.json"),
      serializeProject({ ...project, name: "Edited by an agent" }),
      "utf8",
    );

    const payload = await pending;
    expect(payload?.project?.name).toBe("Edited by an agent");
  });

  it("ignores the app's own save", async () => {
    const { dir, project } = await createProjectOnDisk({ name: "SelfWrite" });
    watchProject(dir, onChange);

    const pending = nextChange(1200);
    // writeProjectFile fingerprints its content before writing.
    await writeProjectFile(dir, { ...project, name: "Saved by the app" });

    expect(await pending).toBeNull();
  });

  it("still reports an external edit after one of our own saves", async () => {
    // Guards against the fingerprint being sticky - if it were never
    // superseded, the first self-save would deafen the watcher for good.
    const { dir, project } = await createProjectOnDisk({ name: "Interleaved" });
    watchProject(dir, onChange);

    const ignored = nextChange(1000);
    await writeProjectFile(dir, { ...project, name: "App save" });
    expect(await ignored).toBeNull();

    const seen = nextChange();
    await fs.writeFile(
      path.join(dir, "project.json"),
      serializeProject({ ...project, name: "Agent save" }),
      "utf8",
    );
    expect((await seen)?.project?.name).toBe("Agent save");
  });

  it("reports a syntax error instead of throwing, and keeps watching", async () => {
    // An agent mid-write, or a hand edit with a trailing comma. The renderer
    // shows a banner; the next good write must still come through.
    const { dir, project } = await createProjectOnDisk({ name: "Malformed" });
    watchProject(dir, onChange);

    const broken = nextChange();
    await fs.writeFile(path.join(dir, "project.json"), "{ oops", "utf8");
    expect(await broken).toHaveProperty("error");

    const recovered = nextChange();
    await fs.writeFile(
      path.join(dir, "project.json"),
      serializeProject({ ...project, name: "Fixed" }),
      "utf8",
    );
    expect((await recovered)?.project?.name).toBe("Fixed");
  });

  it("collapses a burst of writes into one reload", async () => {
    const { dir, project } = await createProjectOnDisk({ name: "Bursty" });

    let calls = 0;
    watchProject(dir, () => {
      calls += 1;
    });

    const file = path.join(dir, "project.json");
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(file, serializeProject({ ...project, name: `v${i}` }), "utf8");
    }

    await new Promise((r) => setTimeout(r, 700));
    // Debounced: an editor writing in several syscalls, or the atomic
    // write-then-rename firing twice, must not reload five times.
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("watching a second project replaces the first", async () => {
    const a = await createProjectOnDisk({ name: "First" });
    const b = await createProjectOnDisk({ name: "Second" });

    watchProject(a.dir, onChange);
    watchProject(b.dir, onChange);

    const pending = nextChange(1200);
    await fs.writeFile(
      path.join(a.dir, "project.json"),
      serializeProject({ ...a.project, name: "Should be ignored" }),
      "utf8",
    );
    expect(await pending).toBeNull();
  });
});
