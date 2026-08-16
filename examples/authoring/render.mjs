/**
 * Render every film, one at a time.
 *
 * Serial on purpose. Queueing all of these at once on a 4-core box does not
 * parallelise anything - Remotion already spreads a single render across
 * every core - it just interleaves six jobs so each takes six times as long
 * and none of them reports meaningful progress.
 */
import { json, client } from "./client.mjs";

const FILMS = [
  ["01-midnight-ship.rawmotion", "01 - Ship (midnight)"],
  ["02-ember-aperture.rawmotion", "02 - Aperture (ember)"],
  ["03-aurora-fleet.rawmotion", "03 - Fleet (aurora)"],
  ["04-ultraviolet-synth.rawmotion", "04 - Synth (ultraviolet)"],
  ["05-arctic-ledger.rawmotion", "05 - Ledger (arctic)"],
  ["06-glass-lumen.rawmotion", "06 - Lumen (glass)"],
];

const only = process.argv.slice(2);
const queue = only.length ? FILMS.filter((f) => only.some((o) => f[0].startsWith(o))) : FILMS;

for (const [dirName, filename] of queue) {
  const started = Date.now();
  const r = await json("render_video", { dirName, filename, crf: 19 });
  process.stdout.write(`${filename}: ${r.totalFrames} frames `);

  for (;;) {
    const s = await json("render_status", { jobId: r.jobId });
    if (s.status === "done") {
      const mb = (s.output.bytes / 1e6).toFixed(1);
      console.log(`\n  OK ${s.output.path} (${mb} MB, ${Math.round((Date.now() - started) / 1000)}s)`);
      break;
    }
    if (s.status === "failed") {
      console.log(`\n  FAILED ${s.error}`);
      break;
    }
    process.stdout.write(`${Math.round(s.progress * 100)}% `);
    await new Promise((res) => setTimeout(res, 15000));
  }
}

await client.close();
