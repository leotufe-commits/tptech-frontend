// src/components/ui/TPDimensionsGuide.tsx
// Ilustración SVG inline de una caja 3D con indicadores de Largo / Alto / Ancho.
// Usa currentColor → hereda el color del contenedor padre.

type Props = {
  /** Unidad activa (g, cm, mm…). Se muestra entre paréntesis en la etiqueta de Largo. */
  unit?: string;
  className?: string;
};

export function TPDimensionsGuide({ unit, className }: Props) {
  /*
   * Proyección cabinet simplificada.
   * Cara frontal: (40,80)–(100,80)–(100,35)–(40,35)
   * Profundidad:  offset (24, -18) → cara superior + cara derecha
   *
   * Vértices:
   *   A = (40,80)   B = (100,80)   C = (100,35)   D = (40,35)   ← frente
   *   E = (64,62)   F = (124,62)   G = (124,17)   H = (64,17)   ← fondo
   */

  const largoLabel = unit ? `Frente (${unit})` : "Frente";

  return (
    <svg
      viewBox="0 0 168 124"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Guía visual de dimensiones de caja"
      role="img"
    >
      {/* ── CAJA ─────────────────────────────────────────────── */}

      {/* Cara frontal */}
      <path
        d="M 40 80 L 100 80 L 100 35 L 40 35 Z"
        stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.04"
      />
      {/* Cara superior */}
      <path
        d="M 40 35 L 64 17 L 124 17 L 100 35 Z"
        stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.06"
      />
      {/* Cara derecha */}
      <path
        d="M 100 35 L 124 17 L 124 62 L 100 80 Z"
        stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.03"
      />

      {/* ── LARGO (ancho frontal) ─────────────────────────────── */}

      {/* Líderes punteados */}
      <line x1="40"  y1="80" x2="40"  y2="96" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      <line x1="100" y1="80" x2="100" y2="96" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      {/* Línea de cota */}
      <line x1="40" y1="93" x2="100" y2="93" stroke="currentColor" strokeWidth="1" />
      {/* Flechas */}
      <polyline points="46,90 40,93 46,96"  stroke="currentColor" strokeWidth="1" fill="none" />
      <polyline points="94,90 100,93 94,96" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Etiqueta */}
      <text x="70" y="109" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="700" opacity="0.85">
        {largoLabel}
      </text>

      {/* ── ALTO (altura frontal) ─────────────────────────────── */}

      {/* Líderes punteados */}
      <line x1="40" y1="35" x2="24" y2="35" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      <line x1="40" y1="80" x2="24" y2="80" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      {/* Línea de cota */}
      <line x1="27" y1="35" x2="27" y2="80" stroke="currentColor" strokeWidth="1" />
      {/* Flechas */}
      <polyline points="24,41 27,35 30,41" stroke="currentColor" strokeWidth="1" fill="none" />
      <polyline points="24,74 27,80 30,74" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Etiqueta (rotada) */}
      <text
        x="14" y="57"
        textAnchor="middle"
        fontSize="9"
        fill="currentColor"
        fontWeight="700"
        opacity="0.85"
        transform="rotate(-90 14 57)"
      >
        Alto
      </text>

      {/* ── ANCHO (profundidad) ───────────────────────────────── */}

      {/*
       * La profundidad va en dirección (24,-18), longitud ≈ 30.
       * Usamos el borde inferior de la cara derecha:
       *   desde B=(100,80) hasta F=(124,62)
       * La línea de cota la desplazamos ~10px hacia abajo-derecha
       * (perpendicular outward): dirección (18,24)/30 → offset (6,8)
       */}

      {/* Líderes punteados */}
      <line x1="100" y1="80" x2="107" y2="89" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      <line x1="124" y1="62" x2="131" y2="71" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />
      {/* Línea de cota */}
      <line x1="107" y1="87" x2="131" y2="69" stroke="currentColor" strokeWidth="1" />
      {/* Flecha inicio */}
      <polyline points="112,85 107,87 110,82" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Flecha fin */}
      <polyline points="127,71 131,69 128,74" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Etiqueta */}
      <text x="143" y="81" textAnchor="start" fontSize="9" fill="currentColor" fontWeight="700" opacity="0.85">
        Profundo
      </text>
    </svg>
  );
}

export default TPDimensionsGuide;
