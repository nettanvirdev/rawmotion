import { describe, expect, it, vi } from "vitest";
import path from "node:path";

/**
 * The sandbox is a security boundary, so it gets adversarial tests rather
 * than happy-path ones. Everything that reaches the filesystem from the
 * renderer or from an agent goes through `resolveInProject`; if it can be
 * made to return a path outside the project, the whole `file.*` and
 * `asset.*` surface becomes an arbitrary read/write primitive.
 */

// workspace.js imports `electron`, which is unavailable under Vitest. Only
// `app.getPath` and `shell` are touched, and neither is used by the pure
// path functions under test.
vi.mock("electron", () => ({
  app: { getPath: () => "/home/user/Documents" },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

const { resolveInProject, resolveProjectDir, projectDirNameFor } = await import(
  "./workspace.js"
);

const PROJECT = path.resolve("/home/user/Documents/Raw Motion/Demo.rawmotion");

describe("resolveInProject", () => {
  it("resolves a normal relative path", () => {
    expect(resolveInProject(PROJECT, "assets/images/a.png")).toBe(
      path.join(PROJECT, "assets/images/a.png"),
    );
  });

  it("allows the project root itself", () => {
    expect(resolveInProject(PROJECT, ".")).toBe(PROJECT);
  });

  it.each([
    "../secrets.txt",
    "../../.ssh/id_rsa",
    "assets/../../escape.txt",
    "assets/images/../../../../etc/passwd",
    "./../../out",
  ])("refuses traversal: %s", (attempt) => {
    expect(() => resolveInProject(PROJECT, attempt)).toThrow(/escape/i);
  });

  it("refuses absolute paths", () => {
    expect(() => resolveInProject(PROJECT, "/etc/passwd")).toThrow(/relative/i);
  });

  it("refuses non-string input", () => {
    expect(() => resolveInProject(PROJECT, null)).toThrow();
    expect(() => resolveInProject(PROJECT, 42)).toThrow();
  });

  it("refuses a sibling directory sharing the project's name prefix", () => {
    // The bug a naive startsWith() check would have: "Demo.rawmotion-evil"
    // begins with "Demo.rawmotion".
    expect(() => resolveInProject(PROJECT, "../Demo.rawmotion-evil/x")).toThrow(/escape/i);
  });

  it("refuses paths inside denied directories", () => {
    expect(() => resolveInProject(PROJECT, ".git/config")).toThrow(/not accessible/i);
    expect(() => resolveInProject(PROJECT, "node_modules/x/index.js")).toThrow(
      /not accessible/i,
    );
  });

  it("allows a path whose name merely contains a denied segment", () => {
    // ".gitignore" is not ".git" - segment matching, not substring matching.
    expect(() => resolveInProject(PROJECT, "assets/gitignore.txt")).not.toThrow();
  });
});

describe("resolveProjectDir", () => {
  it("accepts a plain project folder name", () => {
    expect(resolveProjectDir("Demo.rawmotion")).toBe(PROJECT);
  });

  it("refuses a name containing path structure", () => {
    expect(() => resolveProjectDir("../Demo.rawmotion")).toThrow(/invalid/i);
    expect(() => resolveProjectDir("sub/Demo.rawmotion")).toThrow(/invalid/i);
  });

  it("refuses a folder that is not a project", () => {
    expect(() => resolveProjectDir("Documents")).toThrow(/not a raw motion project/i);
  });

  it("refuses empty input", () => {
    expect(() => resolveProjectDir("")).toThrow();
    expect(() => resolveProjectDir(undefined)).toThrow();
  });
});

describe("projectDirNameFor", () => {
  it("appends the project extension", () => {
    expect(projectDirNameFor("Aurora Launch")).toBe("Aurora Launch.rawmotion");
  });

  it("strips characters illegal in filenames", () => {
    expect(projectDirNameFor('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij.rawmotion");
  });

  it("keeps spaces and hyphens", () => {
    expect(projectDirNameFor("Q3 - Feature reveal")).toBe("Q3 - Feature reveal.rawmotion");
  });

  it("strips leading dots so a project cannot be hidden", () => {
    expect(projectDirNameFor("...hidden")).toBe("hidden.rawmotion");
  });

  it("falls back to Untitled when nothing survives", () => {
    expect(projectDirNameFor("///")).toBe("Untitled.rawmotion");
    expect(projectDirNameFor("")).toBe("Untitled.rawmotion");
  });

  it("produces a name that resolveProjectDir accepts", () => {
    // The two functions are used as a pair, so their contracts must agree.
    for (const input of ["Aurora", "a/b", "  spaced  ", "...x"]) {
      expect(() => resolveProjectDir(projectDirNameFor(input))).not.toThrow();
    }
  });
});
