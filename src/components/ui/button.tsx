import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal-mint)]/60 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-2xl bg-[color:var(--color-signal-mint)] text-[color:var(--color-abyss)] shadow-subtle hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:brightness-100",
        destructive: "rounded-2xl bg-destructive text-destructive-foreground hover:brightness-110",
        outline:
          "rounded-2xl border border-[color:var(--color-graphite)] bg-transparent text-[color:var(--color-chalk)] hover:bg-white/[0.04]",
        secondary:
          "rounded-2xl bg-[color:var(--color-carbon)] text-[color:var(--color-chalk)] border border-[color:var(--color-graphite)] hover:bg-white/[0.04]",
        ghost: "rounded-2xl text-[color:var(--color-chalk)] hover:bg-white/[0.05]",
        link: "text-[color:var(--color-signal-mint)] underline-offset-4 hover:underline",
        pill: "rounded-full bg-[color:var(--color-chalk)] text-[color:var(--color-abyss)] hover:brightness-95",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
