import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_0_rgba(0,0,0,0.2),0_8px_24px_-12px_hsl(207_53%_50%/0.45)] hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-100",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:brightness-110",
        outline:
          "border border-[color:var(--border-hairline)] bg-transparent text-foreground hover:bg-foreground/[0.04]",
        secondary:
          "bg-[color:var(--color-surface-2)] text-foreground border border-[color:var(--border-hairline)] hover:bg-[color:var(--color-surface-3)]",
        ghost:
          "text-foreground hover:bg-foreground/[0.05]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
