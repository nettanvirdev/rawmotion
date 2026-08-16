import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 20% tint + 700/200 text is the one status recipe in the system.
 * Reuse it for banners and inline callouts rather than inventing another.
 */
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-md px-[5px] py-[5px] text-12 font-normal uppercase leading-none",
  {
    variants: {
      variant: {
        info: "bg-blue-500/20 text-blue-700 dark:text-blue-200",
        success: "bg-green-500/20 text-green-700 dark:text-green-200",
        warning: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-200",
        error: "bg-red-500/20 text-red-700 dark:text-red-200",
        muted: "bg-gray-500/20 text-gray-700 dark:text-gray-200",
      },
    },
    defaultVariants: { variant: "muted" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
