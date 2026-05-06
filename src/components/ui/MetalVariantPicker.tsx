// src/components/ui/MetalVariantPicker.tsx
//
// Selector multi de variantes de metal usado en el alcance "Metales" de
// promociones, cupones y descuentos por cantidad. Carga lazy todas las
// variantes activas de todos los metales del tenant. Presentación: chips
// con label "{metal} {variante}" (ej. "Oro 18K").
//
// Reutiliza la lógica de listado de `CostCompositionTable` pero la encapsula
// para que las pantallas de configuración no tengan que armar la query.
import React, { useEffect, useMemo, useState } from "react";
import TPComboMulti from "./TPComboMulti";
import { listMetals, listVariants, type MetalRow, type MetalVariantRow } from "../../services/valuation";

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
};

type Loaded = { metal: MetalRow; variants: MetalVariantRow[] };

export function MetalVariantPicker({
  selected,
  onChange,
  disabled,
  placeholder = "Seleccionar variantes de metal…",
  searchable = true,
  className,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(false);

  // Carga lazy: una sola vez al montar. El listado de metales suele ser
  // chico (5-15 metales con ~3 variantes cada uno), así que el N+1 acotado
  // es aceptable. Si el tenant crece, se puede agregar un endpoint batch.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const metalsResp: any = await listMetals();
        const metals: MetalRow[] = (metalsResp?.rows ?? metalsResp ?? []).filter((m: MetalRow) => m.isActive);
        const results = await Promise.all(
          metals.map(async (m) => {
            const vResp: any = await listVariants(m.id, { isActive: true });
            const variants: MetalVariantRow[] = (vResp?.rows ?? vResp ?? []).filter((v: MetalVariantRow) => v.isActive);
            return { metal: m, variants };
          }),
        );
        if (!cancelled) setLoaded(results);
      } catch {
        if (!cancelled) setLoaded([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(() => {
    const opts: { value: string; label: string; sublabel?: string }[] = [];
    for (const { metal, variants } of loaded) {
      for (const v of variants) {
        opts.push({
          value:    v.id,
          // Label compacto "Oro 18K" (metal name + variant name).
          label:    `${metal.name} ${v.name}`.trim(),
          sublabel: v.sku || undefined,
        });
      }
    }
    return opts;
  }, [loaded]);

  return (
    <TPComboMulti
      value={selected}
      onChange={onChange}
      options={options}
      placeholder={loading ? "Cargando…" : placeholder}
      disabled={disabled || loading}
      searchable={searchable}
      className={className}
    />
  );
}

export default MetalVariantPicker;
