import { json, client } from "./.drive.mjs";

const FILMS = [
  ["01-midnight-ship.rawmotion", "01 - Ship (midnight)"],
  ["02-ember-aperture.rawmotion", "02 - Aperture (ember)"],
  ["03-aurora-fleet.rawmotion", "03 - Fleet (aurora)"],
  ["04-ultraviolet-synth.rawmotion", "04 - Synth (ultraviolet)"],
  ["05-arctic-ledger.rawmotion", "05 - Ledger (arctic)"],
];

const jobs = [];
for (const [dirName, filename] of FILMS) {
  const r = await json("render_video", { dirName, filename, crf: 19 });
  jobs.push({ dirName, filename, jobId: r.jobId, frames: r.totalFrames });
  console.log(`queued ${filename} -> ${r.jobId} (${r.totalFrames} frames)`);
}

for (;;) {
  const statuses = await Promise.all(jobs.map((j) => json("render_status", { jobId: j.jobId })));
  const line = statuses
    .map((s, i) => `${jobs[i].filename.slice(0, 6)} ${s.status === "done" ? "done" : Math.round(s.progress * 100) + "%"}`)
    .join("  ");
  console.log(line);

  if (statuses.every((s) => s.status === "done" || s.status === "failed")) {
    for (const s of statuses) {
      if (s.status === "failed") console.log("FAILED:", s.error);
      else console.log("OK", s.output.path, s.output.bytes, "bytes", s.output.seconds + "s");
    }
    break;
  }
  await new Promise((r) => setTimeout(r, 20000));
}
await client.close();
