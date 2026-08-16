import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const WIDTHS = {
  xs: "max-w-[16rem]",
  sm: "max-w-[30rem]",
  md: "max-w-[42rem]",
  lg: "max-w-[56rem]",
  xl: "max-w-[70rem]",
  "2xl": "max-w-[84rem]",
  full: "max-w-full",
};

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

/**
 * The backdrop, not the card, is the scroll container - a tall modal never
 * clips and the page behind never shifts. Radix handles the focus trap,
 * body scroll lock, and Escape-closes-topmost-only.
 */
export function ModalContent({
  className,
  size = "sm",
  title,
  description,
  showClose = true,
  children,
  ...props
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          "fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[var(--backdrop)] p-3",
          "[scrollbar-gutter:stable] transition-opacity duration-[10ms]",
        )}
      >
        <div className="flex min-h-full items-center justify-center">
          <Dialog.Content
            className={cn(
              "relative w-full rounded-3xl bg-surface-modal",
              "shadow-[var(--shadow-modal)]",
              "animate-[var(--animate-fly-and-scale)] max-sm:mx-2",
              WIDTHS[size],
              className,
            )}
            {...props}
          >
            {title ? (
              <Dialog.Title className="px-5 pt-5 text-16 font-medium text-ink-strong">
                {title}
              </Dialog.Title>
            ) : (
              <Dialog.Title className="sr-only">Dialog</Dialog.Title>
            )}

            {description ? (
              <Dialog.Description className="px-5 pt-1 text-14 text-ink-muted">
                {description}
              </Dialog.Description>
            ) : null}

            {showClose ? (
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="header"
                  aria-label="Close"
                  className="absolute end-4 top-4"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </Dialog.Close>
            ) : null}

            <div className="p-5">{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Overlay>
    </Dialog.Portal>
  );
}

/**
 * Confirm dialog. Outranks modals in the stack because it gets raised from
 * inside one. Destructive intent is carried here, by the copy - there is no
 * red button in the system.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
}) {
  // Close first, then run the action.
  const handleConfirm = () => {
    onOpenChange?.(false);
    onConfirm?.();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10001] overflow-y-auto overscroll-contain bg-[var(--backdrop)] p-3">
          <div className="flex min-h-full items-center justify-center">
            <Dialog.Content
              onKeyDown={(e) => {
                // Enter confirms, but yields to a focused link/button/textarea.
                if (e.key !== "Enter") return;
                const tag = document.activeElement?.tagName;
                if (tag === "A" || tag === "BUTTON" || tag === "TEXTAREA")
                  return;
                e.preventDefault();
                handleConfirm();
              }}
              className={cn(
                "w-full max-w-[32rem] rounded-2xl bg-surface-dialog p-5",
                "shadow-[var(--shadow-modal)] animate-[var(--animate-fly-and-scale)]",
              )}
            >
              <Dialog.Title className="mb-2.5 text-16 font-medium text-ink-strong">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-14 text-ink-muted">
                {message}
              </Dialog.Description>

              <div className="mt-5 flex gap-1.5">
                <Dialog.Close asChild>
                  <Button variant="filled" className="flex-1">
                    {cancelLabel}
                  </Button>
                </Dialog.Close>
                <Button
                  variant="solid"
                  className="flex-1"
                  onClick={handleConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
