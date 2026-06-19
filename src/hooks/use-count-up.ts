import { useEffect, useRef, useState } from "react";

type Options = {
  to: number;
  duration?: number;
  delay?: number;
  decimals?: number;
};

/**
 * Conta 0 → `to` UMA vez quando entra na viewport. Sem loop.
 * Respeita prefers-reduced-motion.
 */
export function useCountUp<T extends HTMLElement = HTMLDivElement>({
  to,
  duration = 1400,
  delay = 0,
  decimals = 0,
}: Options) {
  const ref = useRef<T | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setValue(to);
      return;
    }

    let raf = 0;
    let started = false;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const start = () => {
      if (started) return;
      started = true;
      const startedAt = performance.now() + delay;
      const tick = (now: number) => {
        const elapsed = Math.max(0, now - startedAt);
        const t = Math.min(1, elapsed / duration);
        const v = easeOutCubic(t) * to;
        setValue(Number(v.toFixed(decimals)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            start();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration, delay, decimals]);

  return { ref, value } as const;
}
