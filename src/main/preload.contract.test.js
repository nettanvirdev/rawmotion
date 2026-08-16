import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_CHANNELS, CHANNELS, EVENTS } from "../shared/ipc.js";

/**
 * The preload script cannot import `src/shared/ipc.js`.
 *
 * A preload running under `sandbox: true` may only `require("electron")` -
 * it cannot load local modules and cannot be ESM. So the channel names exist
 * twice: once in the shared module that main and the renderer import, and
 * once as string literals in `preload.cjs`.
 *
 * This test is what makes that duplication safe. Without it, renaming a
 * channel in the shared module would leave the preload silently sending on
 * the old name, and the failure would appear at runtime as a call that never
 * resolves - one of the more tedious bugs to track down in Electron.
 */

const preloadSource = fs.readFileSync(
  path.join(import.meta.dirname, "preload.cjs"),
  "utf8",
);

describe("preload / shared channel contract", () => {
  it.each(ALL_CHANNELS)("preload.cjs references %s", (channel) => {
    expect(preloadSource).toContain(`"${channel}"`);
  });

  it("has no duplicate channel names across CHANNELS and EVENTS", () => {
    expect(new Set(ALL_CHANNELS).size).toBe(ALL_CHANNELS.length);
  });

  it("does not send on channels the shared module has never heard of", () => {
    // Catches the reverse drift: a handler wired up in the preload but never
    // registered in main, which would fail as an unhandled invoke.
    const used = new Set(
      [...preloadSource.matchAll(/ipcRenderer\.(?:send|invoke|on)\(\s*"([^"]+)"/g)].map(
        (m) => m[1],
      ),
    );
    const known = new Set(ALL_CHANNELS);

    for (const channel of used) {
      expect(known.has(channel), `preload sends on unknown channel "${channel}"`).toBe(true);
    }
  });

  it("exposes a namespaced API rather than ipcRenderer itself", () => {
    // Handing the renderer the raw object would let any script - including
    // anything injected into a composition - send on any channel.
    expect(preloadSource).toContain("exposeInMainWorld");
    expect(preloadSource).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/);
  });

  it("returns an unsubscribe function from every subscription", () => {
    // React effects must be able to clean up individually; a blanket
    // removeAllListeners would tear out other components' listeners too.
    // Matched as a call, not as a bare word - the rationale above mentions
    // it by name in prose.
    expect(preloadSource).not.toMatch(/ipcRenderer\.removeAllListeners\s*\(/);
    expect(preloadSource).toMatch(/ipcRenderer\.removeListener\s*\(/);
  });
});

describe("channel naming", () => {
  it("uses namespace:verb throughout", () => {
    for (const channel of ALL_CHANNELS) {
      expect(channel, `${channel} should be "namespace:verb"`).toMatch(
        /^[a-z]+:[a-z-]+$/,
      );
    }
  });

  it("keeps request and event channels distinct", () => {
    const requests = new Set(Object.values(CHANNELS));
    for (const event of Object.values(EVENTS)) {
      expect(requests.has(event)).toBe(false);
    }
  });
});
