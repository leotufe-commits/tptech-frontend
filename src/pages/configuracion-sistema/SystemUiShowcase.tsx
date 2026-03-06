// tptech-frontend/src/pages/SystemUiShowcase.tsx
import React, { useMemo, useState } from "react";

import { cn } from "../../components/ui/tp";

// UI base
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import ConfirmActionDialog from "../../components/ui/ConfirmActionDialog";
import ConfirmUnsavedChangesDialog from "../../components/ui/ConfirmUnsavedChangesDialog";

import { TPBadge, TPSegmentedPills } from "../../components/ui/TPBadges";
import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { SortArrows } from "../../components/ui/TPSort";

import {
  TPTableWrap,
  TPTable,
  TPThead,
  TPTbody,
  TPTh,
  TPTd,
  TPTr,
  TPEmptyRow,
} from "../../components/ui/TPTable";

// si tu toaster se usa vía helper, ajustá import según tu proyecto
import { toast } from "../../lib/toast";

type DemoCatalogItem = { id: string; label: string; isFavorite?: boolean };

export default function SystemUiShowcase() {
  const [openModal, setOpenModal] = useState(false);
  const [openConfirmDelete, setOpenConfirmDelete] = useState(false);
  const [openConfirmAction, setOpenConfirmAction] = useState(false);
  const [openConfirmUnsaved, setOpenConfirmUnsaved] = useState(false);

  const [segValue, setSegValue] = useState(false);
  const [comboValue, setComboValue] = useState("");

  const catalogItems: DemoCatalogItem[] = useMemo(
    () => [
      { id: "1", label: "Argentina" },
      { id: "2", label: "Uruguay" },
      { id: "3", label: "Chile", isFavorite: true },
      { id: "4", label: "Paraguay" },
    ],
    []
  );

  // TPComboCreatable espera items tipo CatalogItem real.
  // Si tu tipo es distinto, ajustá el shape acá.
  const comboItems: any[] = useMemo(() => {
    return catalogItems.map((x, idx) => ({
      id: x.id,
      label: x.label,
      isActive: true,
      sortOrder: idx,
      isFavorite: !!x.isFavorite,
      type: "COUNTRY", // demo
    }));
  }, [catalogItems]);

  function Section({
    title,
    desc,
    children,
  }: {
    title: string;
    desc?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm">
        <div className="mb-3">
          <div className="text-base font-semibold">{title}</div>
          {desc ? <div className="text-sm text-muted-foreground">{desc}</div> : null}
        </div>
        {children}
      </div>
    );
  }

  function TokenSwatch({ label, varName }: { label: string; varName: string }) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div
          className="h-8 w-8 rounded-lg border border-border"
          style={{ background: `hsl(var(${varName}))` } as any}
          title={varName}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{varName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Catálogo de UI (Apariencia)</h1>
        <p className="text-sm text-muted-foreground">
          Esta pantalla renderiza los componentes reales del sistema para ver qué existe hoy y qué se puede
          personalizar mañana (botones, tablas, pills, radios, densidad, etc.).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* TOKENS / THEME */}
        <Section
          title="Tokens de tema (CSS variables)"
          desc="Swatches de las variables más usadas. Esto define el look general del sistema."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TokenSwatch label="Background" varName="--background" />
            <TokenSwatch label="Foreground" varName="--foreground" />
            <TokenSwatch label="Card" varName="--card" />
            <TokenSwatch label="Border" varName="--border" />
            <TokenSwatch label="Primary" varName="--primary" />
            <TokenSwatch label="Muted" varName="--muted" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => toast.success("Toast de éxito (demo)")}
            >
              Probar toast éxito
            </button>
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => toast.error("Toast de error (demo)")}
            >
              Probar toast error
            </button>
          </div>
        </Section>

        {/* BADGES / PILLS */}
        <Section
          title="Badges / Pills / Segmented"
          desc="Estados y variantes típicas (info/success/warn/danger)."
        >
          <div className="flex flex-wrap gap-2">
            <TPBadge>Default</TPBadge>
            <TPBadge tone="success">Success</TPBadge>
            <TPBadge tone="warning">Warning</TPBadge>
            <TPBadge tone="danger">Danger</TPBadge>
            <TPBadge tone="neutral">Muted</TPBadge>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm text-muted-foreground">Segmented on/off (demo)</div>
            <TPSegmentedPills
              value={segValue}
              onChange={setSegValue}
              labels={{ off: "Deshabilitado", on: "Habilitado" }}
            />
            <div className="mt-2 text-xs text-muted-foreground">Estado: {segValue ? "Habilitado" : "Deshabilitado"}</div>
          </div>
        </Section>

        {/* TABLE */}
        <Section
          title="Tabla (TPTable)"
          desc="Con header, filas, acciones; útil para definir densidad, bordes, zebra, etc."
        >
          <TPTableWrap>
            <TPTable>
              <TPThead>
                <TPTr>
                  <TPTh>Nombre</TPTh>
                  <TPTh className="w-[140px]">Estado</TPTh>
                  <TPTh className="w-[120px] text-right">Acciones</TPTh>
                </TPTr>
              </TPThead>

              <TPTbody>
                <TPTr>
                  <TPTd className="font-medium">Usuario demo</TPTd>
                  <TPTd>
                    <TPBadge tone="success">Activo</TPBadge>
                  </TPTd>
                  <TPTd className="text-right">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-sm hover:bg-muted">
                      <SortArrows />
                      Ordenar
                    </button>
                  </TPTd>
                </TPTr>

                <TPTr>
                  <TPTd className="font-medium">Usuario bloqueado</TPTd>
                  <TPTd>
                    <TPBadge tone="danger">Bloqueado</TPBadge>
                  </TPTd>
                  <TPTd className="text-right">
                    <button className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-muted">
                      Ver
                    </button>
                  </TPTd>
                </TPTr>

                {/* ejemplo tabla vacía */}
                {/* <TPEmptyRow colSpan={3} label="Sin resultados" /> */}
              </TPTbody>
            </TPTable>
          </TPTableWrap>
        </Section>

        {/* COMBOS */}
        <Section
          title="Combos (TPComboCreatable)"
          desc="Muestra placeholder, loading, disabled, y selección actual."
        >
          <div className="grid gap-3">
            <TPComboCreatable
              mode="create"
              label="País (demo)"
              placeholder="Seleccionar…"
              type={"COUNTRY" as any}
              items={comboItems as any}
              loading={false}
              value={comboValue}
              onChange={setComboValue}
              allowCreate
              onCreate={async (label) => {
                toast.success(`Crear item: ${label}`);
              }}
            />

            <TPComboCreatable
              mode="edit"
              label="Disabled (demo)"
              placeholder="No disponible"
              type={"COUNTRY" as any}
              items={comboItems as any}
              loading={false}
              value={comboValue}
              onChange={setComboValue}
              disabled
            />

            <TPComboCreatable
              mode="edit"
              label="Loading (demo)"
              placeholder="Cargando…"
              type={"COUNTRY" as any}
              items={[] as any}
              loading
              value={""}
              onChange={() => {}}
            />

            <div className="text-xs text-muted-foreground">
              value actual: <span className="font-medium text-foreground">{comboValue || "—"}</span>
            </div>
          </div>
        </Section>

        {/* MODALS */}
        <Section title="Modales" desc="Modal base + confirm dialogs del sistema.">
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpenModal(true)}
            >
              Abrir Modal base
            </button>
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpenConfirmAction(true)}
            >
              Abrir ConfirmAction
            </button>
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpenConfirmDelete(true)}
            >
              Abrir ConfirmDelete
            </button>
            <button
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpenConfirmUnsaved(true)}
            >
              Abrir UnsavedChanges
            </button>
          </div>
        </Section>
      </div>

      {/* Modal base */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Modal base (demo)"
        description="Esto sirve para definir: blur, sombra, border, padding, tamaño, etc."
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            Contenido dentro del modal. Probá textos largos, botones, inputs, etc.
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setOpenModal(false)}
            >
              Cerrar
            </button>
            <button
              className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
              onClick={() => {
                toast.success("Acción confirmada (demo)");
                setOpenModal(false);
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirms */}
      <ConfirmActionDialog
        open={openConfirmAction}
        title="ConfirmAction (demo)"
        description="Esto simula una confirmación genérica."
        confirmText="Confirmar"
        cancelText="Cancelar"
        onConfirm={() => {
          toast.success("ConfirmAction OK");
          setOpenConfirmAction(false);
        }}
        onClose={() => setOpenConfirmAction(false)}
      />

      <ConfirmDeleteDialog
        open={openConfirmDelete}
        title="ConfirmDelete (demo)"
        message="Esto simula un borrado."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={() => {
          toast.success("Eliminado (demo)");
          setOpenConfirmDelete(false);
        }}
        onClose={() => setOpenConfirmDelete(false)}
      />

      <ConfirmUnsavedChangesDialog
        open={openConfirmUnsaved}
        title="Cambios sin guardar (demo)"
        description="Simulación de diálogo de cambios sin guardar."
        onDiscard={() => {
          toast.success("Descartado (demo)");
          setOpenConfirmUnsaved(false);
        }}
        onClose={() => setOpenConfirmUnsaved(false)}
      />
    </div>
  );
}
