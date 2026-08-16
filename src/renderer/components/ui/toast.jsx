import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/**
 * The PRIMARY feedback channel for async results and action-level validation.
 * Field-level errors stay inline; everything else lands here.
 *
 * Sits above modals in the stack so it stays visible and clickable while one
 * is open.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      style={{ zIndex: 10000 }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border-0 !bg-surface !text-14 !text-ink-body !font-normal !shadow-[var(--shadow-menu)]",
          title: "!text-14 !font-normal !text-ink-strong",
          description: "!text-12 !text-ink-muted",
          closeButton:
            "!border-0 !bg-surface !text-ink-muted hover:!text-ink-strong",
          success: "[&_[data-icon]]:!text-green-500",
          error: "[&_[data-icon]]:!text-red-500",
          warning: "[&_[data-icon]]:!text-yellow-500",
          info: "[&_[data-icon]]:!text-blue-500",
        },
      }}
    />
  );
}
