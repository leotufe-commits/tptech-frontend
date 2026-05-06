// src/pages/InformesHub.tsx
// ============================================================================
// Informes — hub de entrada al módulo.
//
// Muestra 4 cards de acceso: Ventas, Compras, Stock, Finanzas. Cada card linkea
// al informe específico. Pantalla sin estado, sin filtros, sin datos — solo
// navegación.
// ============================================================================

import React from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  ShoppingCart,
  ShoppingBag,
  Package,
  Wallet,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";

type HubCard = {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const CARDS: HubCard[] = [
  {
    to: "/informes/ventas",
    title: "Informe de ventas",
    description: "Facturación, clientes, productos más vendidos.",
    icon: <ShoppingCart size={22} />,
  },
  {
    to: "/informes/compras",
    title: "Informe de compras",
    description: "Órdenes, proveedores, evolución del gasto.",
    icon: <ShoppingBag size={22} />,
  },
  {
    to: "/informes/stock",
    title: "Informe de stock",
    description: "Existencias, rotación, reposición sugerida.",
    icon: <Package size={22} />,
  },
  {
    to: "/informes/finanzas",
    title: "Informe financiero",
    description: "Saldos, deuda, flujo de caja por moneda.",
    icon: <Wallet size={22} />,
  },
];

export default function InformesHub() {
  return (
    <TPSectionShell
      title="Informes"
      subtitle="Análisis y reportes del sistema"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                {c.icon}
              </div>
              <div className="text-sm font-semibold text-text">{c.title}</div>
            </div>
            <div className="mt-3 text-xs text-muted leading-relaxed">
              {c.description}
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-primary opacity-0 transition group-hover:opacity-100">
              <BarChart3 size={12} />
              Ver informe
            </div>
          </Link>
        ))}
      </div>
    </TPSectionShell>
  );
}
