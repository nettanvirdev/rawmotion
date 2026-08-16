/**
 * GPU detection.
 *
 * Rendering walks every frame through a headless Chromium; whether that
 * Chromium composites on the GPU or in software is the difference between a
 * render that saturates one core and one that finishes in a fraction of the
 * time. Electron already knows what the machine has - `app.getGPUInfo` - so
 * the render pipeline asks once and caches the answer.
 */

import { app } from "electron";
import os from "node:os";

const VENDORS = {
  0x10de: "NVIDIA",
  0x1002: "AMD",
  0x1022: "AMD",
  0x8086: "Intel",
  0x13b5: "ARM",
  0x5143: "Qualcomm",
  0x106b: "Apple",
};

/** Microsoft Basic Render Driver - the software rasteriser, not a GPU. */
const SOFTWARE_VENDOR = 0x1414;

/** @type {{ available: boolean, description: string, devices: string[] } | null} */
let cached = null;

/**
 * Detect the machine's GPU once per process.
 *
 * @returns {Promise<{ available: boolean, description: string, devices: string[] }>}
 */
export async function detectGpu() {
  if (cached) return cached;
  try {
    const info = /** @type {any} */ (await app.getGPUInfo("basic"));
    const devices = (info?.gpuDevice ?? [])
      .filter((d) => d && d.vendorId !== SOFTWARE_VENDOR)
      .map((d) => {
        const vendor = VENDORS[d.vendorId] ?? `0x${(d.vendorId ?? 0).toString(16)}`;
        return d.deviceString ? `${vendor} ${d.deviceString}` : vendor;
      });

    cached = {
      available: devices.length > 0,
      description: devices[0] ?? "No hardware GPU detected",
      devices,
    };
  } catch (error) {
    cached = {
      available: false,
      description: `GPU detection failed: ${error.message}`,
      devices: [],
    };
  }
  return cached;
}

/** CPU summary for the settings page. */
export function cpuInfo() {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model?.trim() ?? "Unknown CPU",
    cores: cpus.length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
  };
}
