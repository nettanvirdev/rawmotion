/**
 * Settings.
 *
 * One modal, three sections: where projects live, how renders use the
 * machine, and what this install is. Reads and writes through the settings
 * IPC surface; nothing here touches the filesystem directly.
 *
 * Styling follows the editor system: no borders, rounded surfaces, soft
 * shadows, separation by surface contrast.
 */

import React, { useEffect, useState } from "react";
import { Cpu, FolderOpen, Loader2, MonitorCog, X } from "lucide-react";
import {
  bridge,
  errorMessage,
  type GpuMode,
  type RenderQuality,
  type SettingsPayload,
} from "@/lib/bridge";
import { cn } from "@/lib/utils";

export const SettingsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Moving the workspace is only safe with no project open. */
  canChangeWorkspace: boolean;
  /** Fired after the workspace location changed, so the launcher can refresh. */
  onWorkspaceChanged?: () => void;
}> = ({ open, onClose, canChangeWorkspace, onWorkspaceChanged }) => {
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    bridge.settings
      .get()
      .then(setPayload)
      .catch((e) => setError(errorMessage(e)));
  }, [open]);

  if (!open) return null;

  const update = async (patch: Parameters<typeof bridge.settings.update>[0]) => {
    try {
      setPayload(await bridge.settings.update(patch));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const chooseWorkspace = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.settings.chooseWorkspace();
      setPayload(result);
      if (!result.canceled) onWorkspaceChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rm-editor fixed inset-0 z-[9999] flex items-center justify-center bg-[oklch(0.08_0.005_265/0.6)] p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] rounded-[20px] bg-[var(--rm-chrome)] shadow-[0_32px_80px_-16px_rgb(0_0_0/0.6),0_8px_24px_-8px_rgb(0_0_0/0.4)]">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-[15px] font-medium text-[var(--rm-text)]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex size-7 items-center justify-center rounded-full text-[var(--rm-text-faint)] transition-colors hover:bg-[var(--rm-chrome-high)] hover:text-[var(--rm-text)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <p className="mx-6 mt-3 rounded-[10px] bg-[color-mix(in_oklch,var(--rm-danger),transparent_88%)] px-3 py-2 text-[12px] text-[var(--rm-danger)]">
            {error}
          </p>
        ) : null}

        {!payload ? (
          <div className="flex items-center gap-2 px-6 py-10 text-[12px] text-[var(--rm-text-faint)]">
            <Loader2 className="size-3.5 animate-spin" />
            Reading settings
          </div>
        ) : (
          <div className="rm-scroll max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
            {/* ---- workspace ---- */}
            <Section icon={<FolderOpen className="size-3.5" />} title="Projects">
              <p className="text-[11px] leading-[1.5] text-[var(--rm-text-faint)]">
                Every project lives as a folder inside the workspace.
              </p>
              <div className="mt-2.5 flex items-center gap-2 rounded-[10px] bg-[var(--rm-chrome-low)] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--rm-text-dim)]">
                  {payload.paths.workspace}
                </span>
                <button
                  type="button"
                  onClick={() => void bridge.workspace.reveal().catch(() => undefined)}
                  className="shrink-0 rounded-[7px] bg-[var(--rm-chrome-high)] px-2.5 py-1.5 text-[11px] text-[var(--rm-text-dim)] transition-colors hover:text-[var(--rm-text)]"
                >
                  Reveal
                </button>
                <button
                  type="button"
                  disabled={!canChangeWorkspace || busy}
                  title={
                    canChangeWorkspace
                      ? "Choose a different folder"
                      : "Close the open project to move the workspace"
                  }
                  onClick={() => void chooseWorkspace()}
                  className={cn(
                    "shrink-0 rounded-[7px] bg-[var(--rm-chrome-high)] px-2.5 py-1.5 text-[11px] text-[var(--rm-text-dim)] transition-colors hover:text-[var(--rm-text)]",
                    (!canChangeWorkspace || busy) && "cursor-not-allowed opacity-40",
                  )}
                >
                  Change…
                </button>
              </div>
              {!canChangeWorkspace ? (
                <p className="mt-1.5 text-[10px] text-[var(--rm-text-faint)]">
                  Close the open project to move the workspace.
                </p>
              ) : null}
            </Section>

            {/* ---- rendering ---- */}
            <Section icon={<MonitorCog className="size-3.5" />} title="Rendering">
              <Row
                label="GPU acceleration"
                hint={
                  payload.gpu.available
                    ? `Detected: ${payload.gpu.description}`
                    : payload.gpu.description
                }
              >
                <Segmented
                  value={payload.settings.render.gpu}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                  onChange={(gpu) => void update({ render: { gpu: gpu as GpuMode } })}
                />
              </Row>

              <Row
                label="Quality"
                hint="Draft renders fast for review; High is the final master."
              >
                <Segmented
                  value={payload.settings.render.quality}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "standard", label: "Standard" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={(quality) =>
                    void update({ render: { quality: quality as RenderQuality } })
                  }
                />
              </Row>

              <Row
                label="Parallel frames"
                hint={`This machine has ${payload.cpu.cores} cores. Auto uses half of them.`}
              >
                <Segmented
                  value={String(payload.settings.render.concurrency ?? "auto")}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: String(Math.max(2, Math.floor(payload.cpu.cores * 0.75))), label: "Most" },
                    { value: String(payload.cpu.cores), label: "All" },
                  ]}
                  onChange={(value) =>
                    void update({
                      render: { concurrency: value === "auto" ? null : Number(value) },
                    })
                  }
                />
              </Row>
            </Section>

            {/* ---- about ---- */}
            <Section icon={<Cpu className="size-3.5" />} title="This machine">
              <dl className="space-y-1.5 text-[11px]">
                <InfoRow label="Processor" value={`${payload.cpu.model} · ${payload.cpu.cores} cores · ${payload.cpu.memoryGb} GB`} />
                <InfoRow
                  label="Graphics"
                  value={payload.gpu.devices.length ? payload.gpu.devices.join(", ") : "None detected"}
                />
                <InfoRow label="Configuration file" value={payload.paths.settingsFile} />
              </dl>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <section>
    <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="mt-2.5 flex items-start justify-between gap-4 first:mt-0">
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--rm-text)]">{label}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-[1.45] text-[var(--rm-text-faint)]">{hint}</p>
      ) : null}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-3">
    <dt className="w-[110px] shrink-0 text-[var(--rm-text-faint)]">{label}</dt>
    <dd className="min-w-0 break-all text-[var(--rm-text-dim)]">{value}</dd>
  </div>
);

const Segmented: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex rounded-full bg-[var(--rm-chrome-low)] p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] transition-colors duration-100",
          value === option.value
            ? "bg-[var(--rm-chrome-high)] text-[var(--rm-text)] shadow-[0_2px_6px_-2px_rgb(0_0_0/0.5)]"
            : "text-[var(--rm-text-faint)] hover:text-[var(--rm-text-dim)]",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);
