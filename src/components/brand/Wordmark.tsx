import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  variant?: "default" | "mono";
};

/** Wordmark "inTermo" — "in" em Chalk, "Termo" em Signal Mint. */
export function Wordmark({ className, variant = "default" }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-medium tracking-tight leading-none",
        className,
      )}
    >
      <span className={variant === "mono" ? "text-current" : "text-[color:var(--color-chalk)]"}>in</span>
      <span className={variant === "mono" ? "text-current" : "text-[color:var(--color-signal-mint)]"}>Termo</span>
    </span>
  );
}
