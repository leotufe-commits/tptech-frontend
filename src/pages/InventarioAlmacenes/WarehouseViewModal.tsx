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
      {active ? "Activa" : "Inactiva"}
    </TPBadge>
  );
}

function FieldCard({ label, value }: { label: string; value?: any }) {
  return (
    <TPCard className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm text-text">{s(value) || "—"}</div>
    </TPCard>
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
  const total =
    m?.lines?.reduce((acc: number, l: any) => acc + Number(l?.grams || 0), 0) ||
    0;

  // OUT / TRANSFER (desde este almacén) lo mostramos negativo (más claro visual)
  // ojo: acá no sabemos el almacén origen/destino sin comparar, así que lo dejamos absoluto por ahora
  return total;
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

  const cityLine =
    s(target?.city) || s(target?.province)
      ? `${s(target?.city)}${
          s(target?.province) ? `, ${s(target?.province)}` : ""
        }`
      : "";

  const postalLine =
    s(target?.postalCode) || s(target?.country)
      ? `${s(target?.postalCode)}${
          s(target?.country) ? `, ${s(target?.country)}` : ""
        }`
      : "";

  const phoneLine =
    s(target?.phoneCountry) || s(target?.phoneNumber)
      ? `${s(target?.phoneCountry)} ${s(target?.phoneNumber)}`.trim()
      : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ver almacén"
      subtitle="Información del almacén (solo lectura)."
      maxWidth="lg"
      footer={
        <div className="flex w-full items-center justify-end">
          <TPButton variant="ghost" onClick={onClose}>
            Cerrar
          </TPButton>
        </div>
      }
    >
      {target ? (
        <div className="space-y-3">
          <TPCard className="p-4">
            <div className="text-xs text-muted">Nombre</div>
            <div className="mt-1 text-base font-semibold text-text">
              {target.name}
            </div>
          </TPCard>

          <TPCard className="p-4">
            <div className="text-xs text-muted">Estado</div>
            <div className="mt-2">
              <StatusPill active={isRowActive(target)} />
            </div>
          </TPCard>

          <FieldCard label="Código" value={target.code} />
          <FieldCard label="A la Atención de" value={target.attn} />
          <FieldCard label="Ubicación (etiqueta)" value={target.location} />

          <TPCard className="p-4">
            <div className="text-xs text-muted">Dirección / Contacto</div>

            <div className="mt-2 space-y-1 text-sm text-text">
              <div>{addressLine || "—"}</div>
              <div>{cityLine || "—"}</div>
              <div>{postalLine || "—"}</div>
              <div>{phoneLine || "—"}</div>
            </div>
          </TPCard>

          <FieldCard
            label="Stock (g)"
            value={fmtNumberSmart(target.stockGrams ?? 0)}
          />

          <FieldCard
            label="Stock (piezas)"
            value={fmtNumberSmart(target.stockPieces ?? 0)}
          />

          <TPCard className="p-4">
            <div className="text-xs text-muted">Notas</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-text">
              {s(target.notes) || "—"}
            </div>
          </TPCard>

          {/* ================= MOVIMIENTOS ================= */}

          <TPCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text">
                Últimos movimientos
              </div>

              <TPButton
                variant="secondary"
                onClick={() => {
                  console.log("Ir a movimientos del almacén", target.id);
                }}
              >
                Ver todos
              </TPButton>
            </div>

            <div className="mt-3">
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
                        <TPTd className="text-sm text-muted">
                          Cargando movimientos…
                        </TPTd>
                        <TPTd>{""}</TPTd>
                        <TPTd>{""}</TPTd>
                        <TPTd>{""}</TPTd>
                      </TPTr>
                    )}

                    {!loadingMovements && movements.length === 0 && (
                      <TPTr>
                        <TPTd className="text-sm text-muted">
                          No hay movimientos.
                        </TPTd>
                        <TPTd>{""}</TPTd>
                        <TPTd>{""}</TPTd>
                        <TPTd>{""}</TPTd>
                      </TPTr>
                    )}

                    {!loadingMovements &&
                      movements.map((m: any) => {
                        const grams = gramsForMovement(m);

                        return (
                          <TPTr
                            key={m.id}
                            className="cursor-pointer hover:bg-surface2/40"
                          >
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
            </div>
          </TPCard>
        </div>
      ) : (
        <div className="py-6 text-sm text-muted">—</div>
      )}
    </Modal>
  );
}