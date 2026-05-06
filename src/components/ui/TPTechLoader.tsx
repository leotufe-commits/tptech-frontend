// src/components/ui/TPTechLoader.tsx
// ============================================================================
// TPTechLoader — loader premium para TPTech (ERP de joyería).
//
// Estética: minimalista, tecnológica, suave. Pensado para sentirse cerca de
// loaders de Stripe / Linear / Vercel / Raycast / Framer — nada cartoon, nada
// neón fuerte. Usa el logo institucional como ancla visual y le suma:
//
//   · Glow azulado pulsante detrás del logo
//   · Anillo orbital exterior (spin lento)
//   · Anillo interno (spin reverso, más rápido)
//   · Float vertical leve del logo
//   · Shine sutil que cruza el círculo cada algunos segundos
//   · Sombra elíptica debajo del logo
//
// Sin dependencias externas. Todas las animaciones son CSS keyframes
// inyectadas una sola vez en `<head>` desde el primer mount.
//
// Modo `fullscreen` centra el loader en pantalla y opcionalmente añade
// `backdrop-blur` (modo `overlay`).
// ============================================================================

import { useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Keyframes — inyectadas una sola vez por id estable.
// ─────────────────────────────────────────────────────────────────────────────

const KEYFRAMES_ID = "tp-tech-loader-keyframes";
const KEYFRAMES_CSS = `
@keyframes tp-spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes tp-spin-reverse {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes tp-float-soft {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
@keyframes tp-pulse-glow {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50%      { opacity: 0.85; transform: scale(1.06); }
}
@keyframes tp-shine {
  0%   { transform: translateX(-120%); opacity: 0; }
  35%  { opacity: 0.18; }
  60%  { opacity: 0.18; }
  100% { transform: translateX(120%); opacity: 0; }
}
@keyframes tp-text-fade {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
`;

function injectKeyframesOnce(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper local
// ─────────────────────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type TPTechLoaderProps = {
  /** Tamaño del círculo contenedor en px. Default 140. */
  size?: number;
  /** Texto opcional debajo del loader. */
  text?: string;
  /** Centra vertical y horizontalmente en toda la pantalla. */
  fullscreen?: boolean;
  /** Cuando `fullscreen=true`, agrega backdrop-blur sobre el contenido detrás. */
  overlay?: boolean;
  /** Clases extra para el wrapper exterior. */
  className?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function TPTechLoader({
  size = 140,
  text,
  fullscreen = false,
  overlay = false,
  className,
}: TPTechLoaderProps) {
  useEffect(injectKeyframesOnce, []);

  const wrapperBase = fullscreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center"
    : "inline-flex flex-col items-center justify-center";

  const overlayClass =
    fullscreen && overlay
      ? // backdrop-blur + capa neutra que respeta dark mode del sistema TPTech
        "backdrop-blur-md bg-black/30 dark:bg-black/50"
      : "";

  // Tamaños relativos: el logo ocupa ~55% del círculo. Los anillos se
  // dibujan con `inset` proporcional para escalar bien con `size`.
  const ringInsetInner = Math.max(8, Math.round(size * 0.12));

  return (
    <div
      className={cx(wrapperBase, overlayClass, className)}
      role="status"
      aria-live="polite"
      aria-label={text ?? "Cargando"}
    >
      <div
        className="relative animate-[fade-in_0.4s_ease-out]"
        style={{
          width:  size,
          height: size,
          // float lento y leve sobre todo el bloque del logo
          animation: "tp-float-soft 4.2s ease-in-out infinite",
        }}
      >
        {/* ── Glow azulado pulsante de fondo ────────────────────────────── */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(120,170,255,0.55) 0%, rgba(120,170,255,0.18) 35%, transparent 70%)",
            animation: "tp-pulse-glow 3.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        />

        {/* ── Anillo orbital exterior (spin lento) ──────────────────────── */}
        <div
          className="absolute inset-0 rounded-full border border-primary/25 dark:border-primary/30"
          style={{
            animation: "tp-spin-slow 6s linear infinite",
            // máscara: el ring se desvanece en la mitad inferior — efecto
            // "arco superior" más elegante que un círculo cerrado.
            WebkitMaskImage:
              "linear-gradient(180deg, black 0%, black 35%, transparent 75%)",
            maskImage:
              "linear-gradient(180deg, black 0%, black 35%, transparent 75%)",
          }}
        >
          {/* Punto luminoso en el extremo superior del anillo */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-primary"
            style={{
              top: -2,
              width: 6,
              height: 6,
              boxShadow:
                "0 0 8px rgba(120,170,255,0.9), 0 0 14px rgba(120,170,255,0.55)",
            }}
          />
        </div>

        {/* ── Anillo interior (spin reverso, más rápido y más sutil) ────── */}
        <div
          className="absolute rounded-full border border-primary/15 dark:border-primary/25"
          style={{
            top:    ringInsetInner,
            right:  ringInsetInner,
            bottom: ringInsetInner,
            left:   ringInsetInner,
            animation: "tp-spin-reverse 4s linear infinite",
            WebkitMaskImage:
              "linear-gradient(0deg, black 0%, black 30%, transparent 75%)",
            maskImage:
              "linear-gradient(0deg, black 0%, black 30%, transparent 75%)",
          }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-primary/80"
            style={{
              bottom: -2,
              width: 4,
              height: 4,
              boxShadow: "0 0 6px rgba(120,170,255,0.7)",
            }}
          />
        </div>

        {/* ── Sombra elíptica debajo del logo ───────────────────────────── */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full opacity-40 blur-md"
          style={{
            bottom: Math.round(size * 0.12),
            width:  Math.round(size * 0.45),
            height: Math.round(size * 0.06),
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
          }}
        />

        {/* ── Logo centrado con drop-shadow tenue ───────────────────────── */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/logo-tptech.png"
            alt="TPTech"
            draggable={false}
            className="select-none pointer-events-none"
            style={{
              width:  Math.round(size * 0.55),
              height: "auto",
              filter:
                "drop-shadow(0 0 10px rgba(120,170,255,0.35)) drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
            }}
          />
        </div>

        {/* ── Shine: barra diagonal de luz que cruza el círculo ─────────── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <div
            className="absolute inset-y-0 w-2/3"
            style={{
              left: 0,
              background:
                "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
              animation: "tp-shine 5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
              animationDelay: "1.4s",
            }}
          />
        </div>
      </div>

      {/* ── Texto opcional debajo ────────────────────────────────────────── */}
      {text && (
        <div
          className="mt-4 text-[12px] font-medium tracking-wide text-text/70 dark:text-text/85"
          style={{
            animation: "tp-text-fade 2.4s ease-in-out infinite",
            letterSpacing: "0.02em",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper de conveniencia: fullscreen + overlay activos por default.
// Pensado para "Inicializando sistema…", carga inicial de pantallas, etc.
// ─────────────────────────────────────────────────────────────────────────────

export function TPTechFullscreenLoader(
  props: Omit<TPTechLoaderProps, "fullscreen">,
) {
  return <TPTechLoader fullscreen overlay {...props} />;
}

export default TPTechLoader;
