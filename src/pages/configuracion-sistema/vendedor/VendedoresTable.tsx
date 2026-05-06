import React, { useState } from "react";
import { Plus, Star } from "lucide-react";
import TPImageLightbox from "../../../components/ui/TPImageLightbox";
import { TPButton } from "../../../components/ui/TPButton";
import { TPTableKit, type TPColDef } from "../../../components/ui/TPTableKit";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import type { SellerRow } from "../../../services/sellers";
import type { SortKey } from "./vendedor.types";
import { COL_LS_KEY } from "./vendedor.constants";
import { formatCommission, formatCommissionBase } from "./vendedor.helpers";
import { useFieldFormats } from "../../../context/FieldFormatsContext";

const VENDOR_COLS: TPColDef[] = [
  { key: "nombre",    label: "Nombre",             canHide: false, sortKey: "displayName" },
  { key: "contacto",  label: "Email / Teléfono",   sortKey: "email" },
  { key: "comision",  label: "Comisión" },
  { key: "almacenes", label: "Almacenes" },
  { key: "estado",    label: "Estado",              sortKey: "isActive" },
  { key: "documento", label: "Documento",           visible: false },
  { key: "ubicacion", label: "Ciudad / Provincia",  visible: false, sortKey: "city" },
  { key: "acciones",  label: "Acciones",            canHide: false, align: "right" },
];

interface Props {
  rows: SellerRow[];
  loading: boolean;
  q: string;
  onSearchChange: (q: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  colVis: Record<string, boolean>;
  onColChange: (key: string, visible: boolean) => void;
  busyFavorite: string | null;
  onFavorite: (row: SellerRow) => void;
  onView: (row: SellerRow) => void;
  onEdit: (row: SellerRow) => void;
  onToggle: (row: SellerRow) => void;
  onDelete: (row: SellerRow) => void;
  onNewSeller: () => void;
}

export function VendedoresTable({
  rows,
  loading,
  q,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  busyFavorite,
  onFavorite,
  onView,
  onEdit,
  onToggle,
  onDelete,
  onNewSeller,
}: Props) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { fmtPhone, fmtDoc } = useFieldFormats();

  return (
    <>
    <TPTableKit
      rows={rows}
      columns={VENDOR_COLS}
      storageKey={COL_LS_KEY}
      search={q}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nombre, email…"
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as SortKey)}
      loading={loading}
      emptyText={q ? "No hay resultados para esa búsqueda." : "Todavía no hay vendedores."}
      countLabel={(n) => `${n} ${n === 1 ? "vendedor" : "vendedores"}`}
      responsive="stack"
      actions={
        <TPButton
          variant="primary"
          onClick={onNewSeller}
          iconLeft={<Plus size={16} />}
          className="h-9 whitespace-nowrap shrink-0"
        >
          Nuevo vendedor
        </TPButton>
      }
      pagination
      onRowClick={(row) => onView(row)}
      renderRow={(row, vis, _sel, orderedKeys) => {
        function renderCell(key: string) {
          switch (key) {
            case "nombre":
              return vis.nombre ? (
                <TPTd key="nombre">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                      {row.avatarUrl ? (
                        <button
                          type="button"
                          className="h-full w-full cursor-zoom-in"
                          onClick={(e) => { e.stopPropagation(); setLightboxSrc(row.avatarUrl); }}
                          title="Ver imagen"
                        >
                          <img
                            src={row.avatarUrl}
                            alt={row.displayName}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-bold text-primary bg-primary/10">
                          {row.displayName
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text truncate">
                        {row.displayName}
                      </span>
                      {row.isFavorite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />}
                    </div>
                  </div>
                </TPTd>
              ) : null;
            case "documento":
              return vis.documento ? (
                <TPTd key="documento" className="hidden md:table-cell">
                  <span className="text-sm text-muted">
                    {row.documentType || row.documentNumber
                      ? `${row.documentType ? row.documentType + " " : ""}${fmtDoc(row.documentNumber)}`
                      : "—"}
                  </span>
                </TPTd>
              ) : null;
            case "contacto":
              return vis.contacto ? (
                <TPTd key="contacto" className="hidden md:table-cell">
                  <div className="text-sm space-y-0.5">
                    <div className="text-text">{row.email || "—"}</div>
                    {row.phone && (
                      <div className="text-muted text-xs">{fmtPhone("", row.phone)}</div>
                    )}
                  </div>
                </TPTd>
              ) : null;
            case "ubicacion":
              return vis.ubicacion ? (
                <TPTd key="ubicacion" className="hidden lg:table-cell">
                  <div className="text-sm space-y-0.5">
                    {row.city && <div className="text-text">{row.city}</div>}
                    {row.province && <div className="text-xs text-muted">{row.province}</div>}
                    {!row.city && !row.province && <span className="text-muted">—</span>}
                  </div>
                </TPTd>
              ) : null;
            case "comision":
              return vis.comision ? (
                <TPTd key="comision" className="hidden md:table-cell">
                  {row.commissionType === "NONE" ? (
                    <span className="text-sm text-muted">Sin comisión</span>
                  ) : (
                    <>
                      <div className="text-sm text-text tabular-nums">{formatCommission(row)}</div>
                      <div className="text-xs text-muted">{formatCommissionBase(row)}</div>
                    </>
                  )}
                </TPTd>
              ) : null;
            case "almacenes":
              return vis.almacenes ? (
                <TPTd key="almacenes" className="hidden md:table-cell">
                  <span className="text-sm text-muted">
                    {row.warehouses.length === 0
                      ? "Todos"
                      : row.warehouses.length <= 2
                        ? row.warehouses.map((w) => w.warehouse.name).join(", ")
                        : `${row.warehouses.slice(0, 2).map((w) => w.warehouse.name).join(", ")} +${row.warehouses.length - 2}`}
                  </span>
                </TPTd>
              ) : null;
            case "estado":
              return vis.estado ? (
                <TPTd key="estado" className="hidden md:table-cell">
                  <TPStatusPill active={row.isActive} />
                </TPTd>
              ) : null;
            case "acciones":
              return vis.acciones ? (
                <TPTd key="acciones" className="text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <span className="md:hidden">
                      <TPStatusPill active={row.isActive} />
                    </span>
                    <TPRowActions
                      onFavorite={() => onFavorite(row)}
                      isFavorite={row.isFavorite}
                      busyFavorite={busyFavorite === row.id}
                      onView={() => onView(row)}
                      onEdit={() => onEdit(row)}
                      onToggle={() => onToggle(row)}
                      isActive={row.isActive}
                      onDelete={() => onDelete(row)}
                    />
                  </div>
                </TPTd>
              ) : null;
            default:
              return null;
          }
        }
        const keys = orderedKeys ?? VENDOR_COLS.map((c) => c.key);
        return (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {keys.map((key) => (
              <React.Fragment key={key}>{renderCell(key)}</React.Fragment>
            ))}
          </TPTr>
        );
      }}
    />
    <TPImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
