import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Texto truncado por padrão. Quando o usuário passa o mouse e o conteúdo
 * realmente excede a largura disponível, faz um único ciclo de marquee.
 * Respeita prefers-reduced-motion.
 */
export function ThreadLabel({ text, className }: { text: string; className?: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [playing, setPlaying] = useState(false);

  function handleEnter() {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const diff = inner.scrollWidth - wrap.clientWidth;
    if (diff > 4) {
      setOverflow(diff);
      setPlaying(true);
    }
  }

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setPlaying(false), 7000);
    return () => window.clearTimeout(t);
  }, [playing]);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPlaying(false)}
      className={cn("relative inline-block overflow-hidden align-middle", className)}
    >
      <span
        ref={innerRef}
        className={cn(
          "inline-block whitespace-nowrap will-change-transform",
          playing ? "animate-marquee" : "",
        )}
        style={
          playing
            ? ({ "--marquee-distance": `-${overflow + 16}px` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}
