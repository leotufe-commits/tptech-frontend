// src/pages/configuracion-sistema/FinanzasCobrosPage.tsx
// ============================================================================
// Pantalla unificada "Finanzas y cobros" — tabs Pagos / Impuestos /
// Cuenta corriente / Canales.
//
// Centra todo lo relacionado a "cómo TPTech cobra, factura, calcula
// impuestos y administra deuda/saldo" en un solo entry-point:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Finanzas y cobros                                            │
//   │  Cobros, impuestos, deuda y canales — desde acá controlás     │
//   │  cómo TPTech maneja el flujo financiero del negocio.          │
//   │                                                                │
//   │  [ Pagos ] [ Impuestos ] [ Cuenta corriente ] [ Canales ]     │
//   │                                                                │
//   │  ┌────────────────────────────┐  ┌────────────────────────┐ │
//   │  │ Tab activa                 │  │ Ayuda rápida            │ │
//   │  └────────────────────────────┘  └────────────────────────┘ │
//   └──────────────────────────────────────────────────────────────┘
//
//   · Pagos          → embeds `ConfiguracionSistemaPagos`
//   · Impuestos      → embeds `ConfiguracionSistemaImpuestos`
//   · Cuenta corriente → "Próximamente" inline (configuración de
//                        comportamiento de saldo aún no implementada;
//                        la pantalla operativa de saldo vive en
//                        /finanzas/cuenta-corriente).
//   · Canales        → embeds `ConfiguracionSistemaCanalesDeVenta`
//
// Las rutas legacy /pagos, /impuestos, /canales-venta redirigen acá
// (ver router.tsx). El backend NO se toca; los permisos heredados de
// las rutas tampoco.
// ============================================================================

import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard, Receipt, Wallet, ArrowUpDown, Clock, ExternalLink } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import TPTabs from "../../components/ui/TPTabs";
import ConfiguracionSistemaPagos from "./ConfiguracionSistemaPagos";
import ConfiguracionSistemaImpuestos from "./ConfiguracionSistemaImpuestos";
import ConfiguracionSistemaCanalesDeVenta from "./ConfiguracionSistemaCanalesDeVenta";

type TabValue = "pagos" | "impuestos" | "cuenta-corriente" | "canales";

const TAB_OPTIONS: Array<{ value: TabValue; label: string }> = [
  { value: "pagos",            label: "Pagos y cobros"  },
  { value: "impuestos",        label: "Impuestos"       },
  { value: "cuenta-corriente", label: "Cuenta corriente" },
  { value: "canales",          label: "Canales"         },
];

const VALID_TABS = new Set<TabValue>([
  "pagos", "impuestos", "cuenta-corriente", "canales",
]);

function normalizeTab(raw: string | null): TabValue {
  if (raw && VALID_TABS.has(raw as TabValue)) return raw as TabValue;
  return "pagos";
}

const HELP_BY_TAB: Record<TabValue, { title: string; body: string }> = {
  pagos: {
    title: "Pagos y cobros",
    body:
      "Cómo cobra TPTech: medios de pago aceptados (efectivo, "
      + "transferencia, tarjeta), condiciones, recargos y cuotas. "
      + "Cada medio puede tener su comportamiento operativo.",
  },
  impuestos: {
    title: "Impuestos y tributos",
    body:
      "Cómo se calculan los tributos sobre las ventas: IVA, "
      + "percepciones, retenciones y configuración fiscal. Los valores "
      + "definidos acá los usa el motor de precios al confirmar.",
  },
  "cuenta-corriente": {
    title: "Cuenta corriente",
    body:
      "Cómo se administra la deuda/saldo de clientes y proveedores: "
      + "vencimientos, crédito disponible, comportamiento del saldo. "
      + "Módulo en preparación.",
  },
  canales: {
    title: "Canales de venta",
    body:
      "Cómo se comporta cada canal comercial (Local, Web, Mayorista, "
      + "Marketplace, etc.). Cada canal puede definir recargos o "
      + "descuentos que se aplican al confirmar la venta.",
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

/** Panel "Próximamente" para la tab Cuenta corriente. La pantalla
 *  OPERATIVA de saldo (lista de cuentas, movimientos) ya existe en
 *  /finanzas/cuenta-corriente — la dejamos accesible como quick-link
 *  para que el operador no se quede sin salida. Lo que falta es el
 *  módulo de CONFIGURACIÓN del comportamiento (vencimientos default,
 *  crédito por categoría, etc.). */
function CuentaCorrienteComingSoon(): React.ReactElement {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-muted">
            <Clock size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text">Cuenta corriente — configuración</h3>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Módulo en preparación. Va a centralizar el comportamiento del
              saldo financiero: vencimientos por defecto, crédito disponible
              por cliente/categoría, intereses por mora, recordatorios y
              reglas de notificación.
            </p>
            <p className="text-xs text-muted mt-3">
              Mientras tanto, podés operar el saldo (ver movimientos,
              registrar pagos, ajustar deuda) desde la pantalla operativa
              de cuenta corriente.
            </p>
          </div>
        </div>
      </div>

      <Link
        to="/finanzas/cuenta-corriente"
        className={[
          "group flex items-center gap-3 rounded-xl border border-border bg-card p-3",
          "transition-colors hover:bg-surface2 hover:border-primary/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        ].join(" ")}
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface2 text-primary">
          <Wallet size={16} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">Ir a Cuenta corriente (operativa)</div>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">
            Saldos, movimientos y pagos por cliente/proveedor.
          </p>
        </div>
        <ExternalLink size={15} className="shrink-0 text-muted/50 group-hover:text-text transition-colors" />
      </Link>
    </div>
  );
}

const TAB_ICON: Record<TabValue, React.ReactNode> = {
  pagos:             <CreditCard size={22} />,
  impuestos:         <Receipt size={22} />,
  "cuenta-corriente": <Wallet size={22} />,
  canales:           <ArrowUpDown size={22} />,
};

export default function FinanzasCobrosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  function changeTab(next: string) {
    if (!VALID_TABS.has(next as TabValue)) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", next);
    setSearchParams(newParams, { replace: true });
  }

  return (
    <TPSectionShell
      title="Finanzas y cobros"
      subtitle="Cobros, impuestos, deuda y canales — desde acá controlás cómo TPTech maneja el flujo financiero del negocio."
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
            {activeTab === "pagos"             && <ConfiguracionSistemaPagos             embedded />}
            {activeTab === "impuestos"         && <ConfiguracionSistemaImpuestos         embedded />}
            {activeTab === "cuenta-corriente"  && <CuentaCorrienteComingSoon />}
            {activeTab === "canales"           && <ConfiguracionSistemaCanalesDeVenta    embedded />}
          </div>

          <aside className="lg:sticky lg:top-4">
            <HelpCard tab={activeTab} />
          </aside>
        </div>
      </div>
    </TPSectionShell>
  );
}
