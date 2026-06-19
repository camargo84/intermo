/**
 * AmbientBackground — camadas decorativas globais (glows + grão).
 * Apenas visual, pointer-events-none, montado em RootComponent.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Glow azul-aço atrás do hero (somente dark) */}
      <div
        className="absolute hidden dark:block"
        style={{
          top: "-15%",
          left: "-10%",
          width: "60vw",
          height: "60vw",
          background: "var(--gradient-radial-steel)",
          filter: "blur(40px)",
        }}
      />
      {/* Glow secundário ciano-frio (somente dark) */}
      <div
        className="absolute hidden dark:block"
        style={{
          bottom: "-20%",
          right: "-15%",
          width: "55vw",
          height: "55vw",
          background: "var(--gradient-radial-cool)",
          filter: "blur(50px)",
        }}
      />
      {/* Vinheta sutil */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)",
        }}
      />
      {/* Grão (noise) — soft-light com fallback de opacidade */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.06]"
        style={{
          mixBlendMode: "soft-light",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: "240px 240px",
        }}
      />
    </div>
  );
}
