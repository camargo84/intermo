import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Stat = { label: string; value: string };

const stats: Stat[] = [
  { label: "Assinatura", value: "Em minutos" },
  { label: "Segurança", value: "Dados criptografados" },
  { label: "Validade", value: "Jurídica" },
];

export function LivePanel() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <Card variant="live" className="grid grid-cols-1 md:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex flex-col gap-3 p-8 transition-all duration-700 ease-out",
              i > 0 && "border-t md:border-t-0 md:border-l border-[color:var(--color-graphite)]",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
            )}
            style={{ transitionDelay: visible ? `${i * 120}ms` : "0ms" }}
          >
            <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-ash)]">
              {s.label}
            </span>
            <span className="text-[28px] md:text-[36px] font-medium leading-tight text-[color:var(--color-chalk)]">
              {s.value}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
