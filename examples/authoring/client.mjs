/**
 * A minimal MCP client, so these scripts drive Raw Motion the same way an
 * agent does.
 *
 * There is no privileged back door here: the scripts in this directory
 * speak the identical stdio protocol over the identical tools that Claude
 * or any other harness uses. That is deliberate - if the demo films could
 * only be made through some internal API, they would not be evidence that
 * the MCP surface is sufficient to make them.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "../../src/mcp/server.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env },
});

export const client = new Client({ name: "director", version: "1.0.0" });
await client.connect(transport);

/** Call a tool, turning an MCP error result into a thrown error. */
export async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) throw new Error(`${name}: ${res.content[0].text}`);
  return res;
}

/** Call a tool whose result is JSON, and parse it. */
export async function json(name, args) {
  return JSON.parse((await call(name, args)).content[0].text);
}

/** Write every image in a tool result to `<prefix>-NN.png`. */
export async function saveImages(res, prefix) {
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  const out = [];
  let i = 0;
  for (const c of res.content) {
    if (c.type !== "image") continue;
    const file = `${prefix}-${String(++i).padStart(2, "0")}.png`;
    fs.writeFileSync(file, Buffer.from(c.data, "base64"));
    out.push(file);
  }
  return out;
}
