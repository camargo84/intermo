import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border-hairline)] bg-foreground/[0.06] text-foreground font-mono text-[11px] tracking-wide uppercase",
        secondary:
          "border-[color:var(--border-hairline)] bg-[color:var(--color-surface-2)] text-foreground",
        destructive:
          "border-transparent bg-destructive/15 text-destructive",
        outline: "border-[color:var(--border-hairline)] text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
