import { cn } from "@/lib/utils";

type IntermoMarkProps = {
  className?: string;
  /** "plain" = só o símbolo (usa currentColor). "tile" = quadrado com fundo --primary e símbolo claro. */
  variant?: "plain" | "tile";
  title?: string;
};

/**
 * Símbolo Intermo: dois nós conectados por um elo (A ↔ Intermo ↔ B).
 * SVG em currentColor — colorize via classes (text-accent, text-primary-foreground, etc.).
 */
export function IntermoMark({ className, variant = "plain", title = "Intermo" }: IntermoMarkProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-full w-full"
    >
      <title>{title}</title>
      {/* arco de conexão (o "elo") */}
      <path d="M7 12 C 9 7, 15 7, 17 12" />
      {/* nó A */}
      <circle cx="5" cy="14" r="2.25" fill="currentColor" stroke="none" />
      {/* nó B */}
      <circle cx="19" cy="14" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  );

  if (variant === "tile") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg bg-primary p-1.5 text-primary-foreground",
          className,
        )}
      >
        <span className="block h-full w-full text-primary-foreground">{svg}</span>
      </span>
    );
  }

  return <span className={cn("inline-block text-accent", className)}>{svg}</span>;
}
