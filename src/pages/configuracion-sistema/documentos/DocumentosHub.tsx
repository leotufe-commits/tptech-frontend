// src/pages/configuracion-sistema/documentos/DocumentosHub.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Receipt, PackageCheck, ShoppingCart, ArrowLeftRight,
  ChevronRight,
} from "lucide-react";
import { TPSectionShell } from "../../../components/ui/TPSectionShell";
import {
  ALL_KINDS,
  DOC_KIND_LABELS,
  DOC_KIND_DESCRIPTIONS,
  type DocumentKind,
} from "../../../services/document-templates";

const DOC_ICONS: Record<DocumentKind, React.ReactNode> = {
  PRESUPUESTO:      <FileText size={20} />,
  FACTURA:          <Receipt size={20} />,
  REMITO:           <PackageCheck size={20} />,
  ORDEN_COMPRA:     <ShoppingCart size={20} />,
  MOVIMIENTO_STOCK: <ArrowLeftRight size={20} />,
};

export type DocumentosHubProps = {
  /** Cuando true, omitimos el TPSectionShell. Usado al montarse dentro
   *  de `DocumentosComprobantesPage` con tabs — el shell exterior ya
   *  provee el header. Default false → comportamiento standalone. */
  embedded?: boolean;
};

export default function DocumentosHub({ embedded = false }: DocumentosHubProps = {}) {
  const navigate = useNavigate();

  // Helper local — envuelve con TPSectionShell salvo en modo embedded.
  const Shell = embedded
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => (
        <TPSectionShell
          title="Plantillas de documentos"
          subtitle="Configurá el encabezado, columnas, secciones y estilo visual para cada tipo de documento del sistema."
          icon={<FileText size={22} />}
        >
          {children}
        </TPSectionShell>
      );

  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
        {ALL_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            // Path ABSOLUTO — el hub puede montarse en distintas rutas
            // (standalone en `/documentos` o embebido dentro de
            // `/documentos-comprobantes`), pero el editor siempre vive
            // en `/configuracion-sistema/documentos/:kind`.
            onClick={() => navigate(`/configuracion-sistema/documentos/${kind}`)}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left
              shadow-[0_1px_0_0_rgba(0,0,0,0.05)] transition-all duration-150
              hover:bg-surface2 hover:shadow-[0_6px_18px_rgba(0,0,0,0.09)] hover:-translate-y-px
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-primary
              group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
              {DOC_ICONS[kind]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text">{DOC_KIND_LABELS[kind]}</div>
              <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
                {DOC_KIND_DESCRIPTIONS[kind]}
              </p>
            </div>
            <ChevronRight
              size={15}
              className="shrink-0 text-muted/50 transition-all group-hover:translate-x-0.5 group-hover:text-text"
            />
          </button>
        ))}
      </div>
    </Shell>
  );
}
