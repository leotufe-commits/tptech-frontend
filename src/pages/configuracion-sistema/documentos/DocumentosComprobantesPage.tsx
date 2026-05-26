// src/pages/configuracion-sistema/documentos/DocumentosComprobantesPage.tsx
// ============================================================================
// Pantalla unificada "Documentos y comprobantes" — tabs Plantillas /
// Numeración.
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Documentos y comprobantes                                    │
//   │  Cómo se ven y numeran los comprobantes.                      │
//   │                                                                │
//   │  [ Plantillas ] [ Numeración ]                                │
//   │                                                                │
//   │  ┌────────────────────────────┐  ┌────────────────────────┐ │
//   │  │ Tab activo                  │  │ Ayuda rápida            │ │
//   │  └────────────────────────────┘  └────────────────────────┘ │
//   └──────────────────────────────────────────────────────────────┘
//
//   · Plantillas → embeds `DocumentosHub` (grid de doc kinds). Click
//                  en una card → editor `/documentos/:kind`. El editor
//                  ya incluye un live preview que es VISUALMENTE
//                  IDÉNTICO al PDF final (Fase B1, kind=FACTURA usa
//                  el mismo `<SaleInvoicePrintable>` que Imprimir /
//                  Descargar / Mail).
//   · Numeración → "Próximamente" inline (módulo aún no implementado
//                  en backend).
//
//  La tab antigua "Vista previa" se eliminó (Fase A): el editor ya
//  muestra el preview en vivo; era una duplicación de UX que sólo
//  era un grid de links al mismo editor. Deep-links viejos con
//  `?tab=preview` se normalizan a `?tab=plantillas` para no romper.
//
//  Las rutas legacy /documentos y /numeracion redirigen acá (ver
//  router). La ruta del editor `/documentos/:kind` queda intacta —
//  sigue siendo un deep workflow independiente.
//
//  El backend NO se toca; los permisos heredados de las rutas tampoco.
// ============================================================================

import React from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Hash, Clock } from "lucide-react";
import { TPSectionShell } from "../../../components/ui/TPSectionShell";
import { TPCard } from "../../../components/ui/TPCard";
import TPTabs from "../../../components/ui/TPTabs";
import DocumentosHub from "./DocumentosHub";

type TabValue = "plantillas" | "numeracion";

const TAB_OPTIONS: Array<{ value: TabValue; label: string }> = [
  { value: "plantillas", label: "Plantillas"  },
  { value: "numeracion", label: "Numeración"  },
];

const VALID_TABS = new Set<TabValue>(["plantillas", "numeracion"]);

/** Normaliza el `?tab=` del URL a un valor válido. Acepta:
 *   · "plantillas" o "numeracion" → tal cual.
 *   · "preview" (legacy, tab eliminada en Fase A) → "plantillas".
 *     Mantiene compat con deep-links externos.
 *   · cualquier otro / null → "plantillas" (default). */
function normalizeTab(raw: string | null): TabValue {
  if (raw === "preview") return "plantillas";
  if (raw && VALID_TABS.has(raw as TabValue)) return raw as TabValue;
  return "plantillas";
}

const HELP_BY_TAB: Record<TabValue, { title: string; body: string }> = {
  plantillas: {
    title: "Plantillas",
    body:
      "Diseño visual de cada comprobante: encabezado, logo, columnas, "
      + "secciones y estilo. El editor muestra una vista previa idéntica "
      + "al PDF final, con datos de ejemplo.",
  },
  numeracion: {
    title: "Numeración",
    body:
      "Series, prefijos, punto de venta y próximo número por tipo de "
      + "comprobante. Módulo en preparación — coordinado con AFIP.",
  },
};

function HelpCard({ tab }: { tab: TabValue }): React.ReactElement {
  const active = HELP_BY_TAB[tab];
  return (
    <TPCard title="Ayuda rápida">
      <div className="space-y-3 text-xs leading-relaxed">
        <div>
          <div className="font-semibold text-text mb-0.5">{active.title}</div>
          <p className="text-muted">{active.body}</p>
        </div>
        <div className="border-t border-border/40 pt-2 space-y-1.5 text-muted">
          {(Object.keys(HELP_BY_TAB) as TabValue[])
            .filter((t) => t !== tab)
            .map((t) => (
              <div key={t}>
                <span className="font-medium text-text/80">{HELP_BY_TAB[t].title}: </span>
                <span>{HELP_BY_TAB[t].body}</span>
              </div>
            ))}
        </div>
      </div>
    </TPCard>
  );
}

/** Panel "Próximamente" para la tab Numeración. Visual claro que el módulo
 *  todavía no está disponible, con descripción del scope esperado. */
function NumeracionComingSoon(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-muted">
          <Clock size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text">Numeración de comprobantes</h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Módulo en preparación. Va a permitir configurar series, prefijos,
            punto de venta y próximo número por tipo de comprobante
            (Factura, Presupuesto, Remito, etc.), con sincronización opcional
            contra AFIP.
          </p>
          <p className="text-xs text-muted mt-3">
            Mientras tanto, la numeración se asigna automáticamente al crear
            cada documento siguiendo la secuencia interna del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

const TAB_ICON: Record<TabValue, React.ReactNode> = {
  plantillas: <FileText size={22} />,
  numeracion: <Hash size={22} />,
};

export default function DocumentosComprobantesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  // Si el URL trae el legacy ?tab=preview, lo limpiamos a
  // ?tab=plantillas en el primer render. Así deep-links viejos
  // se canonicalizan sin un Navigate intermedio.
  React.useEffect(() => {
    if (searchParams.get("tab") === "preview") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "plantillas");
      setSearchParams(next, { replace: true });
    }
    // Sólo en montaje. Si el operador cambia de tab manualmente,
    // `changeTab` maneja el setSearchParams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTab(next: string) {
    if (!VALID_TABS.has(next as TabValue)) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", next);
    setSearchParams(newParams, { replace: true });
  }

  return (
    <TPSectionShell
      title="Documentos y comprobantes"
      subtitle="Cómo se ven y numeran los comprobantes que emite TPTech. Reúne plantillas y numeración en un solo lugar."
      icon={TAB_ICON[activeTab]}
    >
      <div className="space-y-5">
        <TPTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={changeTab}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
          <div className="min-w-0">
            {activeTab === "plantillas" && <DocumentosHub embedded />}
            {activeTab === "numeracion" && <NumeracionComingSoon />}
          </div>

          <aside className="lg:sticky lg:top-4">
            <HelpCard tab={activeTab} />
          </aside>
        </div>
      </div>
    </TPSectionShell>
  );
}
