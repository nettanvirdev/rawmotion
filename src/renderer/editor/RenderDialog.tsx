/**
 * Export configuration.
 *
 * The render button opens this instead of firing immediately: format,
 * resolution and quality are decisions the user makes per export, not global
 * state. The dialog echoes the resulting pixel size and length so there are
 * no surprises when the file lands.
 */

import React, { useState } from "react";
import { Film, Loader2 } from "lucide-react";
import type { Project } from "@shared/project.js";
import { formatDuration, projectDurationInFrames } from "@shared/project.js";
import type { RenderQuality } from "@/lib/bridge";
import { cn } from "@/lib/utils";

export interface RenderChoice {
  format: "mp4" | "webm";
  scale: number;
  quality: RenderQuality;
}

export const RenderDialog: React.FC<{
  open: boolean;
  project: Project;
  busy: boolean;
  onClose: () => void;
  onRender: (choice: RenderChoice) => void;
}> = ({ open, project, busy, onClose, onRender }) => {
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState<RenderQuality>("standard");

  if (!open) return null;

  const { width, height, fps } = project.composition;
  const frames = projectDurationInFrames(project);
  const outW = even(Math.round(width * scale));
  const outH = even(Math.round(height * scale));

  return (
    <div
      className="rm-editor fixed inset-0 z-[9999] flex items-center justify-center bg-[oklch(0.08_0.005_265/0.6)] p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-[20px] bg-[var(--rm-chrome)] p-6 shadow-[0_32px_80px_-16px_rgb(0_0_0/0.6),0_8px_24px_-8px_rgb(0_0_0/0.4)]">
        <h2 className="text-[15px] font-medium text-[var(--rm-text)]">Export video</h2>
        <p className="rm-num mt-1 text-[11px] text-[var(--rm-text-faint)]">
          {outW}x{outH} · {fps}fps · {formatDuration(frames, fps)}
        </p>

        <Field label="Format">
          <Chips
            value={format}
            options={[
              { value: "mp4", label: "MP4 (H.264)" },
              { value: "webm", label: "WebM" },
            ]}
            onChange={(v) => setFormat(v as "mp4" | "webm")}
          />
        </Field>

        <Field label="Resolution">
          <Chips
            value={String(scale)}
            options={[
              { value: "0.5", label: `Half · ${even(Math.round(width * 0.5))}p wide` },
              { value: "1", label: `Full · ${width}` },
              { value: "2", label: `2x · ${width * 2}` },
            ]}
            onChange={(v) => setScale(Number(v))}
          />
        </Field>

        <Field label="Quality">
          <Chips
            value={quality}
            options={[
              { value: "draft", label: "Draft" },
              { value: "standard", label: "Standard" },
              { value: "high", label: "High" },
            ]}
            onChange={(v) => setQuality(v as RenderQuality)}
          />
        </Field>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRender({ format, scale, quality })}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--rm-accent)] text-[13px] text-white transition-opacity hover:opacity-90",
              busy && "opacity-50",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
            Start render
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[10px] px-4 text-[12px] text-[var(--rm-text-dim)] transition-colors hover:text-[var(--rm-text)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/** H.264 requires even dimensions. */
function even(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mt-4">
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
      {label}
    </p>
    {children}
  </div>
);

const Chips: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          "rounded-full px-3 py-1.5 text-[11px] transition-colors duration-100",
          value === option.value
            ? "bg-[var(--rm-accent-dim)] text-[var(--rm-accent)]"
            : "bg-[var(--rm-chrome-high)] text-[var(--rm-text-dim)] hover:text-[var(--rm-text)]",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);
