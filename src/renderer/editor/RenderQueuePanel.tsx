/**
 * The render queue panel.
 *
 * A view onto the main process's queue - it holds no job state of its own.
 * Progress arrives on an IPC channel, which is why a render keeps advancing
 * while the user edits, switches panels, or scrubs the timeline.
 *
 * Also hosts the AI operation log, because the two answer the same question -
 * "what is this application doing, and what has it done" - and splitting
 * them across two panels would mean neither gets looked at.
 */

import React from "react";
import { CheckCircle2, CircleSlash, FolderOpen, Loader2, X, XCircle } from "lucide-react";
import type { RenderJob } from "@/lib/bridge";
import { useRenderStore } from "@/state/renderStore";
import { useAiStore } from "@/state/aiStore";
import { EmptyState, IconButton } from "./controls";
import { cn } from "@/lib/utils";

export const RenderQueuePanel: React.FC<{ dirName: string }> = ({ dirName }) => {
  const jobs = useRenderStore((s) => s.jobs);
  const cancel = useRenderStore((s) => s.cancel);
  const reveal = useRenderStore((s) => s.reveal);
  const operations = useAiStore((s) => s.operations);

  return (
    <div className="rm-panel flex min-h-0 flex-1">
      <div className="rm-hairline-r flex min-h-0 flex-1 flex-col">
        <header className="rm-hairline-b flex h-8 shrink-0 items-center px-3">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
            Render queue
          </h2>
        </header>

        <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {jobs.length === 0 ? (
            <EmptyState
              title="Nothing rendering"
              hint="Exports appear here and keep running while you work."
            />
          ) : (
            jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onCancel={() => void cancel(job.id)}
                onReveal={() => void reveal(dirName, job.outputRelative)}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 w-[300px] shrink-0 flex-col">
        <header className="rm-hairline-b flex h-8 shrink-0 items-center px-3">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
            Activity
          </h2>
        </header>

        <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {operations.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            operations.map((op) => (
              <div key={op.id} className="mb-1 flex gap-2 px-1 py-1">
                <span className="rm-num shrink-0 text-[10px] text-[var(--rm-text-faint)]">
                  {new Date(op.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-[1.4] text-[var(--rm-text-dim)]">
                    {op.label}
                  </p>
                  {op.detail ? (
                    <p className="text-[10px] leading-[1.4] text-[var(--rm-text-faint)]">
                      {op.detail}
                    </p>
                  ) : null}
                </div>
                {op.source === "agent" ? (
                  <span className="shrink-0 self-start rounded-full bg-[var(--rm-accent-dim)] px-1.5 text-[9px] text-[var(--rm-accent)]">
                    AI
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const JobRow: React.FC<{
  job: RenderJob;
  onCancel: () => void;
  onReveal: () => void;
}> = ({ job, onCancel, onReveal }) => {
  const running =
    job.status === "rendering" || job.status === "bundling" || job.status === "queued";

  return (
    <div className="mb-1 rounded-[6px] bg-[var(--rm-chrome-high)] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <StatusIcon status={job.status} />

        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--rm-text)]">
          {job.label}
        </span>

        <span className="rm-num shrink-0 text-[10px] text-[var(--rm-text-faint)]">
          {job.width}x{job.height} · {job.format.toUpperCase()}
        </span>

        {running ? (
          <IconButton title="Cancel render" onClick={onCancel} danger className="size-5">
            <X className="size-3" />
          </IconButton>
        ) : job.status === "done" ? (
          <IconButton title="Show in folder" onClick={onReveal} className="size-5">
            <FolderOpen className="size-3" />
          </IconButton>
        ) : null}
      </div>

      {running ? (
        <div className="mt-1.5 flex items-center gap-2">
          {/* A determinate bar only once frames are actually being written;
              during bundling there is no meaningful percentage and a bar
              stuck at 0% reads as a hang. */}
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--rm-chrome-low)]">
            <div
              className={cn(
                "h-full rounded-full bg-[var(--rm-accent)] transition-[width] duration-200",
                job.status === "bundling" && "w-1/4 animate-pulse",
              )}
              style={job.status === "rendering" ? { width: `${job.progress * 100}%` } : undefined}
            />
          </div>
          <span className="rm-num w-24 shrink-0 text-right text-[10px] text-[var(--rm-text-faint)]">
            {job.status === "rendering"
              ? `${Math.round(job.progress * 100)}% · ${job.renderedFrames}/${job.totalFrames}`
              : job.status === "bundling"
                ? "Compiling"
                : "Queued"}
          </span>
        </div>
      ) : null}

      {job.error ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-[1.5] text-[var(--rm-danger)]">
          {job.error}
        </p>
      ) : null}

      {job.status === "done" ? (
        <p className="rm-num mt-1 truncate text-[10px] text-[var(--rm-text-faint)]">
          {job.outputRelative}
        </p>
      ) : null}
    </div>
  );
};

const StatusIcon: React.FC<{ status: RenderJob["status"] }> = ({ status }) => {
  if (status === "done") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-[var(--rm-good)]" />;
  }
  if (status === "failed") {
    return <XCircle className="size-3.5 shrink-0 text-[var(--rm-danger)]" />;
  }
  if (status === "cancelled") {
    return <CircleSlash className="size-3.5 shrink-0 text-[var(--rm-text-faint)]" />;
  }
  return (
    <Loader2
      className={cn(
        "size-3.5 shrink-0 text-[var(--rm-accent)]",
        status !== "queued" && "animate-spin",
      )}
    />
  );
};
