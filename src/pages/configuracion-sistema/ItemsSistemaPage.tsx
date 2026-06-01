// src/pages/configuracion-sistema/ItemsSistemaPage.tsx
// ============================================================================
// Pantalla unificada "Ítems del sistema" — tabs Ítems / Unidades / Categorías.
//
// Reemplaza la navegación fragmentada entre /items, /unidades y /categorias
// por un único entry-point con tabs:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Ítems del sistema                                            │
//   │  Catálogos base, unidades y categorías que estructuran TPTech│
//   │                                                                │
//   │  [ Ítems ] [ Unidades ] [ Categorías ]                        │
//   │                                                                │
//   │  ┌────────────────────────────┐  ┌────────────────────────┐ │
//   │  │ Tab activo — página        │  │ Ayuda                  │ │
//   │  │ embebida (sin shell        │  │ Qué es cada tab,       │ │
//   │  │ propio).                   │  │ cuándo se toca cada    │ │
//   │  │                             │  │ una.                   │ │
//   │  └────────────────────────────┘  └────────────────────────┘ │
//   └──────────────────────────────────────────────────────────────┘
//
// Cada página interna corre con su prop `embedded={true}` → no
// renderiza su propio TPSectionShell, el shell exterior provee
// el header común.
//
// Las rutas legacy /items, /unidades, /categorias redirigen acá con
// `?tab=...` (ver router.tsx). El backend NO se toca: cada página sigue
// haciendo su propio fetch/save independiente. Permisos intactos.
// ============================================================================

import React from "react";
import { useSearchParams } from "react-router-dom";
import { Database } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import TPTabs from "../../components/ui/TPTabs";
import ConfiguracionSistemaItems from "./ConfiguracionSistemaItems";
import ConfiguracionSistemaUnidades from "./ConfiguracionSistemaUnidades";
import ConfiguracionSistemaCategorias from "./ConfiguracionSistemaCategorias";

type TabValue = "items" | "unidades" | "categorias";

const TAB_OPTIONS: Array<{ value: TabValue; label: string }> = [
  { value: "items",      label: "Ítems"      },
  { value: "unidades",   label: "Unidades"   },
  { value: "categorias", label: "Categorías" },
];

const VALID_TABS = new Set<TabValue>(["items", "unidades", "categorias"]);

function normalizeTab(raw: string | null): TabValue {
  if (raw && VALID_TABS.has(raw as TabValue)) return raw as TabValue;
  return "items";
}

const HELP_BY_TAB: Record<TabValue, { title: string; body: string }> = {
  items: {
    title: "Ítems",
    body:
      "Listas base del sistema: tipos de documento, condiciones de IVA, "
      + "estados, ubicaciones. Alimentan los combos de toda la app.",
  },
  unidades: {
    title: "Unidades",
    body:
      "Cómo se mide o se vende cada artículo: venta, peso, dimensión, "
      + "volumen. Se usan al cargar artículos y al armar líneas de venta.",
  },
  categorias: {
    title: "Categorías",
    body:
      "Cómo se organizan los artículos en una jerarquía. Cada categoría "
      + "puede tener atributos propios y lista de precios por defecto.",
  },
};

/** Card lateral con ayuda contextual — explica brevemente cada tab para
 *  que el operador entienda el propósito de la sección activa sin tener
 *  que abrir documentación. */
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

export default function ItemsSistemaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  function changeTab(next: string) {
    if (!VALID_TABS.has(next as TabValue)) return;
    // `replace: true` — no acumular tabs en el history del browser.
    // PRESERVA otros query params (ej. ?type=DOCUMENT_TYPE que la página
    // de Ítems usa para deep-linkear a un catálogo específico).
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", next);
    setSearchParams(newParams, { replace: true });
  }

  return (
    <TPSectionShell
      title="Ítems del sistema"
      subtitle="Catálogos base, unidades y categorías que estructuran TPTech. Definí acá cómo se etiquetan, miden y organizan los datos del negocio."
      icon={<Database size={22} />}
    >
      <div className="space-y-5">
        <TPTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={changeTab}
        />

        {/* Grid responsive: pantalla embebida (izq) + card de ayuda
            (der). En tablets/mobile apilamos. La card de ayuda es
            sticky en desktop para que siempre acompañe al usuario. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
          <div className="min-w-0">
            {activeTab === "items"      && <ConfiguracionSistemaItems      embedded />}
            {activeTab === "unidades"   && <ConfiguracionSistemaUnidades   embedded />}
            {activeTab === "categorias" && <ConfiguracionSistemaCategorias embedded />}
          </div>

          <aside className="lg:sticky lg:top-4">
            <HelpCard tab={activeTab} />
          </aside>
        </div>
      </div>
    </TPSectionShell>
  );
}
