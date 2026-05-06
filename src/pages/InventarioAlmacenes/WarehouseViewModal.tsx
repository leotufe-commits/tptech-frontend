import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";

import Modal from "../../components/ui/Modal";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import {
  TPTablePaginated,
  TPTr,
  TPTh,
  TPTd,
} from "../../components/ui/TPTable";
import { TPBadge } from "../../components/ui/TPBadges";
import TPAttachmentList, { type TPAttachmentItem } from "../../components/ui/TPAttachmentList";

import type { WarehouseAttachment, WarehouseRow } from "./types";
import type { ArticleStockRow } from "./warehouses.api";
import { isRowActive, s } from "./warehouses.utils";
import { fmtNumberSmart } from "../../lib/format";
import { useFieldFormats } from "../../context/FieldFormatsContext";
import { warehousesApi } from "./warehouses.api";

function StatusPill({ active }: { active: boolean }) {
  return (
    <TPBadge tone={active ? "success" : "danger"}>
      {active ? "Activo" : "Inactivo"}
    </TPBadge>
  );
}

function Field({ label, value }: { label: string; value?: any }) {
  const text = s(value);
  return (
    <div>
      <div className="text-xs text-muted mb-0.5">{label}</div>
      <div className="text-sm text-text">{text || "—"}</div>
    </div>
  );
}

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR");
}

function movementTone(kind: string) {
  switch (kind) {
    case "IN":       return "success";
    case "OUT":      return "danger";
    case "TRANSFER": return "info";
    case "ADJUST":   return "warning";
    case "OPENING":  return "primary";
    default:         return "neutral";
  }
}

function movementLabel(kind: string) {
  switch (kind) {
    case "IN":       return "Entrada";
    case "OUT":      return "Salida";
    case "TRANSFER": return "Transfer";
    case "ADJUST":   return "Ajuste";
    case "OPENING":  return "Apertura";
    default:         return kind || "—";
  }
}

function gramsForMovement(m: any) {
  return (
    m?.lines?.reduce((acc: number, l: any) => acc + Number(l?.grams || 0), 0) || 0
  );
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stockTone(qty: number, reorder: number | null): "success" | "warning" | "danger" | "neutral" {
  if (qty < 0) return "danger";
  if (qty === 0) return "neutral";
  if (reorder !== null && qty <= reorder) return "warning";
  return "success";
}

function stockLabel(qty: number, reorder: number | null) {
  if (qty < 0) return `Negativo (${fmtNumberSmart(qty)})`;
  if (qty === 0) return "Sin stock";
  if (reorder !== null && qty <= reorder) return `Bajo (${fmtNumberSmart(qty)})`;
  return `${fmtNumberSmart(qty)} u.`;
}

export default function WarehouseViewModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: WarehouseRow | null;
}) {
  const { fmtPhone } = useFieldFormats();
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [articleStock, setArticleStock] = useState<ArticleStockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  const [articleMovements, setArticleMovements] = useState<any[]>([]);
  const [loadingArticleMovements, setLoadingArticleMovements] = useState(false);

  const [attachments, setAttachments] = useState<WarehouseAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    if (!open || !target?.id) return;

    const id = target.id;

    setLoadingMovements(true);
    warehousesApi.getMovements(id)
      .then((data) => setMovements(Array.isArray(data?.rows) ? data.rows : []))
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false));

    setLoadingStock(true);
    warehousesApi.getArticleStock(id)
      .then((rows) => setArticleStock(Array.isArray(rows) ? rows : []))
      .catch(() => setArticleStock([]))
      .finally(() => setLoadingStock(false));

    setLoadingArticleMovements(true);
    warehousesApi.getArticleMovements(id)
      .then((data) => setArticleMovements(Array.isArray(data?.rows) ? data.rows : []))
      .catch(() => setArticleMovements([]))
      .finally(() => setLoadingArticleMovements(false));

    setLoadingAttachments(true);
    warehousesApi.getAttachments(id)
      .then((data) => setAttachments(Array.isArray(data) ? data : []))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false));
  }, [open, target?.id]);

  const attachmentItems: TPAttachmentItem[] = useMemo(() =>
    attachments.map((a) => ({
      id: a.id,
      name: a.filename,
      size: a.size,
      url: a.url,
      mimeType: a.mimeType,
    })),
    [attachments]
  );

  const openInNewTab = useCallback((url: string) => {
    try { window.open(url, "_blank", "noreferrer"); } catch {}
  }, []);

  const download = useCallback((url: string) => {
    try { window.location.assign(url); } catch { openInNewTab(url); }
  }, [openInNewTab]);

  const addressLine =
    s(target?.street) || s(target?.number)
      ? `${s(target?.street)} ${s(target?.number)}`.trim()
      : "";

  const phoneLine = fmtPhone(target?.phoneCountry, target?.phoneNumber);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={s(target?.name) || "Ver almacén"}
      subtitle="Información del almacén (solo lectura)."
      maxWidth="6xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="inventario-almacenes-view"
      footer={
        <div className="flex w-full items-center justify-end">
          <TPButton variant="secondary" onClick={onClose} iconLeft={<X size={14} />}>
            Cerrar
          </TPButton>
        </div>
      }
    >
      {target ? (
        <div className="space-y-4">

          {/* ── 1. Resumen: Estado + Stock ──────────────────────────────── */}
          <TPCard className="p-4">
            <div className="flex items-center divide-x divide-border">
              <div className="pr-6 flex flex-col gap-1.5 min-w-[100px]">
                <div className="text-xs text-muted">Estado</div>
                <StatusPill active={isRowActive(target)} />
              </div>
              <div className="px-6 flex flex-col gap-0.5">
                <div className="text-xs text-muted">Stock metales</div>
                <div className="text-xl font-bold text-text tabular-nums leading-tight">
                  {fmtNumberSmart(target.stockGrams ?? 0)}
                  <span className="text-xs font-normal text-muted ml-1">g</span>
                </div>
              </div>
              <div className="pl-6 flex flex-col gap-0.5">
                <div className="text-xs text-muted">Stock artículos</div>
                <div className="text-xl font-bold text-text tabular-nums leading-tight">
                  {fmtNumberSmart(target.stockPieces ?? 0)}
                  <span className="text-xs font-normal text-muted ml-1">pzas.</span>
                </div>
              </div>
            </div>
          </TPCard>

          {/* ── 2. Card contenedor: Contacto / Notas / Adjuntos ────────── */}
          <TPCard bodyClassName="p-3 space-y-3">

            {/* Subcard: Contacto + Dirección */}
            <TPCard title="Contacto y dirección" divider>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Teléfono" value={phoneLine} />
                <Field label="Mail" value={target.email} />
                <Field label="Dirección" value={addressLine} />
                <Field label="Ciudad" value={target.city} />
                <Field label="Provincia" value={target.province} />
                <Field label="País" value={target.country} />
              </div>
            </TPCard>

            {/* Subcard: Notas */}
            <TPCard title="Notas" divider>
              {s(target.notes) ? (
                <div className="whitespace-pre-wrap text-sm text-text leading-relaxed">
                  {s(target.notes)}
                </div>
              ) : (
                <div className="text-sm text-muted italic">Sin observaciones</div>
              )}
            </TPCard>

            {/* Subcard: Adjuntos */}
            <TPCard
              title={
                <div className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted" />
                  <span>Adjuntos</span>
                </div>
              }
              divider
            >
              <TPAttachmentList
                items={attachmentItems}
                loading={loadingAttachments}
                emptyText="Todavía no hay adjuntos."
                onView={(it) => { if (it.url) openInNewTab(it.url); }}
                onDownload={(it) => { if (it.url) download(it.url); }}
              />
            </TPCard>

          </TPCard>

          {/* ── 6. Stock de artículos ────────────────────────────────────── */}
          <TPTablePaginated
            rows={articleStock}
            loading={loadingStock}
            emptyText="Sin stock de artículos registrado."
            countLabel="artículos"
            headerLeft="Stock de artículos"
            colSpan={6}
            renderHead={() => (
              <tr>
                <TPTh>Artículo / Variante</TPTh>
                <TPTh>SKU</TPTh>
                <TPTh className="text-right">Peso unit. ref.</TPTh>
                <TPTh className="text-right">Cantidad</TPTh>
                <TPTh className="text-right">Peso total ref.</TPTh>
                <TPTh className="text-right">Estado</TPTh>
              </tr>
            )}
            renderRow={(row: ArticleStockRow) => {
              const qty = toNum(row.quantity);
              const unitW = toNum(row.variant?.weightOverride ?? row.article.weight);
              const totalW = qty * unitW;
              const reorder = row.variant?.reorderPoint != null
                ? toNum(row.variant.reorderPoint)
                : row.article.reorderPoint != null
                ? toNum(row.article.reorderPoint)
                : null;

              const sku = s(row.variant?.sku || row.article.sku);
              const name = row.variant
                ? `${row.article.name} — ${row.variant.name}`
                : row.article.name;

              return (
                <TPTr key={row.id}>
                  <TPTd className="text-sm text-text">{name}</TPTd>
                  <TPTd className="text-sm text-muted">{sku || "—"}</TPTd>
                  <TPTd className="text-right text-sm text-muted">
                    {unitW > 0 ? `${fmtNumberSmart(unitW)} g` : "—"}
                  </TPTd>
                  <TPTd className="text-right text-sm font-medium text-text">
                    {fmtNumberSmart(qty)}
                  </TPTd>
                  <TPTd className="text-right text-sm text-muted">
                    {unitW > 0 ? `${fmtNumberSmart(totalW)} g` : "—"}
                  </TPTd>
                  <TPTd className="text-right">
                    <TPBadge tone={stockTone(qty, reorder)}>
                      {stockLabel(qty, reorder)}
                    </TPBadge>
                  </TPTd>
                </TPTr>
              );
            }}
          />

          {/* ── 7. Movimientos de metales ───────────────────────────────── */}
          <TPTablePaginated
            rows={movements}
            loading={loadingMovements}
            emptyText="No hay movimientos."
            countLabel="movimientos"
            headerLeft="Últimos movimientos de metales"
            colSpan={4}
            renderHead={() => (
              <tr>
                <TPTh>Fecha</TPTh>
                <TPTh>Tipo</TPTh>
                <TPTh>Usuario</TPTh>
                <TPTh className="text-right">Gramos</TPTh>
              </tr>
            )}
            renderRow={(m: any) => {
              const grams = gramsForMovement(m);
              return (
                <TPTr key={m.id}>
                  <TPTd>{fmtDate(m.effectiveAt)}</TPTd>
                  <TPTd>
                    <TPBadge tone={movementTone(String(m.kind || ""))}>
                      {movementLabel(String(m.kind || ""))}
                    </TPBadge>
                  </TPTd>
                  <TPTd>
                    {s(m.createdBy?.name || m.createdBy?.email) || "—"}
                  </TPTd>
                  <TPTd className="text-right">
                    {fmtNumberSmart(grams)}
                  </TPTd>
                </TPTr>
              );
            }}
          />

          {/* ── 8. Movimientos de artículos ─────────────────────────────── */}
          <TPTablePaginated
            rows={articleMovements}
            loading={loadingArticleMovements}
            emptyText="No hay movimientos de artículos."
            countLabel="movimientos"
            headerLeft="Últimos movimientos de artículos"
            colSpan={5}
            renderHead={() => (
              <tr>
                <TPTh>Fecha</TPTh>
                <TPTh>Código</TPTh>
                <TPTh>Tipo</TPTh>
                <TPTh>Usuario</TPTh>
                <TPTh className="text-right">Piezas</TPTh>
              </tr>
            )}
            renderRow={(m: any) => {
              const totalQty = (m.lines ?? []).reduce(
                (acc: number, l: any) => acc + toNum(l.quantity),
                0
              );
              return (
                <TPTr key={m.id}>
                  <TPTd>{fmtDate(m.effectiveAt)}</TPTd>
                  <TPTd className="font-mono text-xs">{s(m.code) || "—"}</TPTd>
                  <TPTd>
                    <TPBadge tone={movementTone(String(m.kind || ""))}>
                      {movementLabel(String(m.kind || ""))}
                    </TPBadge>
                  </TPTd>
                  <TPTd>
                    {s(m.createdBy?.name || m.createdBy?.email) || "—"}
                  </TPTd>
                  <TPTd className="text-right text-sm">
                    {fmtNumberSmart(totalQty)}
                  </TPTd>
                </TPTr>
              );
            }}
          />

        </div>
      ) : (
        <div className="py-6 text-sm text-muted">—</div>
      )}
    </Modal>
  );
}
