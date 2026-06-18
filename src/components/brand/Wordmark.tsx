import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  variant?: "default" | "mono";
};

/**
 * Wordmark "intermo".
 * default: "inter" em foreground, "mo" em accent (ciano da paleta).
 * mono: tudo em currentColor (usar em logo p&b ou sobre gradiente de marca).
 */
export function Wordmark({ className, variant = "default" }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-semibold tracking-tight leading-none",
        className,
      )}
    >
      <span className={variant === "mono" ? "text-current" : "text-foreground"}>inter</span>
      <span className={variant === "mono" ? "text-current" : "text-accent"}>mo</span>
    </span>
  );
}
