import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--color-signal-mint)] focus:ring-offset-0",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--color-graphite)] text-[color:var(--color-chalk)]",
        secondary:
          "bg-[color:var(--color-carbon)] text-[color:var(--color-chalk)] border border-[color:var(--color-graphite)]",
        destructive: "bg-destructive/15 text-destructive",
        outline: "border border-[color:var(--color-graphite)] text-[color:var(--color-chalk)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
