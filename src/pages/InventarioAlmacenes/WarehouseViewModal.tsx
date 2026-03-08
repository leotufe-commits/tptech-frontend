import React, { useEffect, useState } from "react";

import Modal from "../../components/ui/Modal";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import {
  TPTableWrap,
  TPTable,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
} from "../../components/ui/TPTable";

import { TPBadge } from "../../components/ui/TPBadges";

import type { WarehouseRow } from "./types";
import { isRowActive, s } from "./warehouses.utils";
import { fmtNumberSmart } from "../../lib/format";
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
    case "IN":
      return "success";
    case "OUT":
      return "danger";
    case "TRANSFER":
      return "info";
    case "ADJUST":
      return "warning";
    default:
      return "neutral";
  }
}

function gramsForMovement(m: any) {
  return (
    m?.lines?.reduce((acc: number, l: any) => acc + Number(l?.grams || 0), 0) || 0
  );
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
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    if (!open || !target?.id) return;

    async function load() {
      try {
        setLoadingMovements(true);
        const data = await warehousesApi.getMovements(target!.id);
        setMovements(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        setMovements([]);
      } finally {
        setLoadingMovements(false);
      }
    }

    load();
  }, [open, target?.id]);

  const addressLine =
    s(target?.street) || s(target?.number)
      ? `${s(target?.street)} ${s(target?.number)}`.trim()
      : "";

  const phoneLine =
    s(target?.phoneCountry) || s(target?.phoneNumber)
      ? `${s(target?.phoneCountry)} ${s(target?.phoneNumber)}`.trim()
      : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={s(target?.name) || "Ver almacén"}
      subtitle="Información del almacén (solo lectura)."
      maxWidth="2xl"
      footer={
        <div className="flex w-full items-center justify-end">
          <TPButton variant="ghost" onClick={onClose}>
            Cerrar
          </TPButton>
        </div>
      }
    >
      {target ? (
        <div className="space-y-4">
          {/* Estado + Stock */}
          <TPCard className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted mb-1">Estado</div>
                <StatusPill active={isRowActive(target)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Stock (gramos)</div>
                <div className="text-sm font-semibold text-text">
                  {fmtNumberSmart(target.stockGrams ?? 0)} g
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">Stock (piezas)</div>
                <div className="text-sm font-semibold text-text">
                  {fmtNumberSmart(target.stockPieces ?? 0)}
                </div>
              </div>
            </div>
          </TPCard>

          {/* Contacto */}
          <TPCard className="p-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Contacto
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Teléfono" value={phoneLine} />
              <Field label="Mail" value={target.email} />
            </div>
          </TPCard>

          {/* Dirección */}
          <TPCard className="p-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Dirección
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Dirección" value={addressLine} />
              <Field label="Ciudad" value={target.city} />
              <Field label="Provincia" value={target.province} />
              <Field label="País" value={target.country} />
            </div>
          </TPCard>

          {/* Notas */}
          {s(target.notes) ? (
            <TPCard className="p-4">
              <div className="text-xs text-muted mb-0.5">Notas</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-text">
                {s(target.notes)}
              </div>
            </TPCard>
          ) : null}

          {/* Movimientos */}
          <TPCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-text">
                Últimos movimientos
              </div>
            </div>

            <TPTableWrap>
              <TPTable>
                <TPThead>
                  <TPTr>
                    <TPTh>Fecha</TPTh>
                    <TPTh>Tipo</TPTh>
                    <TPTh>Usuario</TPTh>
                    <TPTh className="text-right">Gramos</TPTh>
                  </TPTr>
                </TPThead>

                <TPTbody>
                  {loadingMovements && (
                    <TPTr>
                      <TPTd className="text-sm text-muted">Cargando movimientos…</TPTd>
                      <TPTd>{""}</TPTd>
                      <TPTd>{""}</TPTd>
                      <TPTd>{""}</TPTd>
                    </TPTr>
                  )}

                  {!loadingMovements && movements.length === 0 && (
                    <TPTr>
                      <TPTd className="text-sm text-muted">No hay movimientos.</TPTd>
                      <TPTd>{""}</TPTd>
                      <TPTd>{""}</TPTd>
                      <TPTd>{""}</TPTd>
                    </TPTr>
                  )}

                  {!loadingMovements &&
                    movements.map((m: any) => {
                      const grams = gramsForMovement(m);

                      return (
                        <TPTr key={m.id} className="cursor-pointer hover:bg-surface2/40">
                          <TPTd>{fmtDate(m.effectiveAt)}</TPTd>

                          <TPTd>
                            <TPBadge tone={movementTone(String(m.kind || ""))}>
                              {s(m.kind) || "—"}
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
                    })}
                </TPTbody>
              </TPTable>
            </TPTableWrap>
          </TPCard>
        </div>
      ) : (
        <div className="py-6 text-sm text-muted">—</div>
      )}
    </Modal>
  );
}
