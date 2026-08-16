import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import {
  defaultWorkspaceRoot,
  resolveWorkspaceRoot,
  workspacePointerPath,
} from "./paths.js";

/**
 * Workspace discovery.
 *
 * The app and the MCP server must land on the same folder or the product's
 * central promise silently fails: an agent creates projects the app never
 * lists, and the "live loop" appears broken with no error anywhere.
 *
 * They cannot share a default. The app asks Electron for the `documents`
 * path, which honours XDG on Linux and the real Documents folder elsewhere;
 * a plain Node process has no way to reproduce that. So the app publishes
 * where it landed and the server reads it.
 */

const ORIGINAL = process.env.RAWMOTION_WORKSPACE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RAWMOTION_WORKSPACE;
  else process.env.RAWMOTION_WORKSPACE = ORIGINAL;
});

describe("resolveWorkspaceRoot", () => {
  const home = path.resolve("/home/ada");
  const documents = path.resolve("/home/ada/Documents");

  it("prefers the environment override above everything", () => {
    process.env.RAWMOTION_WORKSPACE = "/tmp/explicit";
    const read = () => JSON.stringify({ workspace: "/somewhere/else" });
    expect(resolveWorkspaceRoot(documents, home, read)).toBe("/tmp/explicit");
  });

  it("uses the pointer the app published", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    const read = (file) => {
      expect(file).toBe(workspacePointerPath(home));
      return JSON.stringify({ workspace: "/home/ada/Documents/Raw Motion" });
    };
    expect(resolveWorkspaceRoot(documents, home, read)).toBe(
      "/home/ada/Documents/Raw Motion",
    );
  });

  it("falls back to <documents>/Raw Motion when no pointer exists", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    // The app has never run - the server still has to work.
    const read = () => null;
    expect(resolveWorkspaceRoot(documents, home, read)).toBe(
      path.join(documents, "Raw Motion"),
    );
  });

  it("falls back when the pointer is unreadable", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    const read = () => {
      throw new Error("EACCES");
    };
    expect(resolveWorkspaceRoot(documents, home, read)).toBe(
      path.join(documents, "Raw Motion"),
    );
  });

  it("falls back when the pointer is corrupt", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    // A half-written file must not take the server down.
    for (const corrupt of ["{ not json", "null", "[]", '{"workspace": ""}', '{"workspace": 42}']) {
      expect(resolveWorkspaceRoot(documents, home, () => corrupt)).toBe(
        path.join(documents, "Raw Motion"),
      );
    }
  });

  it("works with no pointer reader at all", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    expect(resolveWorkspaceRoot(documents)).toBe(path.join(documents, "Raw Motion"));
  });
});

describe("defaultWorkspaceRoot", () => {
  it("honours the override", () => {
    process.env.RAWMOTION_WORKSPACE = "/tmp/ws";
    expect(defaultWorkspaceRoot("/anything")).toBe("/tmp/ws");
  });

  it("otherwise sits under the given documents directory", () => {
    delete process.env.RAWMOTION_WORKSPACE;
    expect(defaultWorkspaceRoot(path.resolve("/docs"))).toBe(
      path.join(path.resolve("/docs"), "Raw Motion"),
    );
  });

  it("agrees with resolveWorkspaceRoot when there is no pointer", () => {
    // The two functions are the app's and the server's entry points into the
    // same decision; if they disagree the product splits in half.
    delete process.env.RAWMOTION_WORKSPACE;
    const documents = path.resolve("/home/ada/Documents");
    expect(defaultWorkspaceRoot(documents)).toBe(
      resolveWorkspaceRoot(documents, path.resolve("/home/ada"), () => null),
    );
  });
});

describe("workspacePointerPath", () => {
  it("is a dotfile under the home directory", () => {
    expect(workspacePointerPath(path.resolve("/home/ada"))).toBe(
      path.join(path.resolve("/home/ada"), ".rawmotion", "workspace.json"),
    );
  });
});
