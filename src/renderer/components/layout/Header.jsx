import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

/**
 * Sticky, with a negative bottom margin so content scrolls UNDER it.
 * Legibility comes from the gradient scrim, not a solid bar - a solid header
 * reads as a different system immediately.
 */
export function Header({
  title,
  theme,
  onThemeChange,
  highContrast,
  onHighContrastChange,
}) {
  return (
    <div className="sticky top-0 z-[30] -mb-12">
      <div className="header-scrim flex items-center gap-1 px-1.5 pb-1 pt-0.5">
        {/* No sidebar toggle here. When the sidebar is collapsed its rail is
            still on screen and owns the expand control; adding one here too
            put two identical buttons side by side. */}
        <h1 className="nudge-label min-w-0 flex-1 truncate px-1 text-15 font-normal text-ink-body">
          {title}
        </h1>

        <Tooltip content="High contrast">
          <Button
            variant="ghost"
            size="header"
            aria-label="Toggle high contrast"
            aria-pressed={highContrast}
            onClick={() => onHighContrastChange(!highContrast)}
            className={cn(highContrast && "bg-wash-soft text-ink-strong")}
          >
            <Contrast className="size-4" aria-hidden />
          </Button>
        </Tooltip>

        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="header" aria-label="Theme">
              {theme === "light" ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Appearance</MenuLabel>
            <MenuSeparator />
            <MenuItem onSelect={() => onThemeChange("light")}>
              <Sun aria-hidden />
              Light
            </MenuItem>
            <MenuItem onSelect={() => onThemeChange("dark")}>
              <Moon aria-hidden />
              Dark
            </MenuItem>
            <MenuItem onSelect={() => onThemeChange("oled")}>
              <Monitor aria-hidden />
              OLED
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {/* The scrim extends 40px past the header so the fade completes. */}
      <div className="header-scrim pointer-events-none h-10" />
    </div>
  );
}
