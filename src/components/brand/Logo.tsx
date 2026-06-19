import { cn } from "@/lib/utils";
import { inTermoMark } from "./inTermoMark";
import { Wordmark } from "./Wordmark";

type LogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

/** Marca completa: ícone + wordmark, alinhados. */
export function Logo({ className, markClassName, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <inTermoMark variant="tile" className={cn("h-7 w-7", markClassName)} />
      <Wordmark className={cn("text-lg", wordmarkClassName)} />
    </span>
  );
}
