// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/InvoiceSettingsModal.tsx
//
// Modal de "Configuracion de vista" del modal de Factura. Vive como
// overlay propio y agrupa todo lo que NO es comercial:
//
//   - Plantilla de vista (BALANCED / CLASSIC / COMPACT / FINANCIAL)
//   - "Mis vistas" — presets nombrados del usuario (CRUD)
//   - Modo personalizar layout (entrar / restaurar)
//   - Visibilidad de cards del aside
//   - Densidad / sticky actions

import React, { useCallback, useState } from "react";
// 2026-05-27 — Removido `Star`: el concepto de "vista favorita" se elimino
// del modal de Configuracion. Las vistas persistidas siguen siendo
// seleccionables (click sobre el nombre) y editables/duplicables/eliminables
// — pero no hay marcado de default visual.
import { Check, Pencil, Trash2, X, LayoutGrid, Copy, Plus } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import TPInput from "../../../components/ui/TPInput";
import {
  ALL_PRESETS,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  type InvoiceViewPreset,
} from "../../../lib/sales/invoiceViewPresets";
import type { NamedLayoutPreset } from "./layout/types";
import type {
  InvoiceUiPreferences,
  InvoiceVisibleCards,
} from "./layout/useInvoiceUiPreferences";

export type InvoiceSettingsModalProps = {
  open: boolean;
  onClose: () => void;

  // Plantilla de vista
  preset: InvoiceViewPreset | null;
  onPresetChange: (next: InvoiceViewPreset) => void;

  // Layout
  onResetLayout: () => void;
  onEnterEditMode: () => void;

  // UI preferences
  uiPreferences: InvoiceUiPreferences;
  onUiPatch: (
    patch:
      | Partial<InvoiceUiPreferences>
      | Partial<{ visibleCards: Partial<InvoiceVisibleCards> }>,
  ) => void;

  // "Mis vistas"
  presets: NamedLayoutPreset[];
  onSavePresetAs: (name: string) => string;
  onApplyPreset: (id: string) => void;
  onRenamePreset: (id: string, name: string) => void;
  onDuplicatePreset: (id: string) => string | null;
  onDeletePreset: (id: string) => void;
  /** @deprecated 2026-05-27 — Concepto de vista "favorita/default" removido
   *  del modal. Prop conservada opcional para back-compat de callers que
   *  todavia la pasen (e.g. `VentasFacturas`). El handler entrante se
   *  ignora; persistencia de `isDefault` en `NamedLayoutPreset` se
   *  mantiene en el shape para no romper layouts guardados, pero no
   *  tiene UI que la modifique. */
  onSetDefaultPreset?: (id: string | null) => void;
};

const VISIBLE_CARD_LABELS: Record<keyof InvoiceVisibleCards, string> = {
  discount: "Descuento global",
  shipping: "Envío",
  coupon: "Cupón de venta",
  totals: "Total del comprobante",
  payments: "Cobro",
  accountImpact: "Impacto en cuenta corriente",
  observations: "Observaciones / Términos / Adjuntos",
};

export function InvoiceSettingsModal(props: InvoiceSettingsModalProps): React.ReactElement {
  const {
    open, onClose, preset, onPresetChange, onResetLayout, onEnterEditMode,
    uiPreferences, onUiPatch, presets, onSavePresetAs, onApplyPreset,
    onRenamePreset, onDuplicatePreset, onDeletePreset,
    // `onSetDefaultPreset` intencionalmente NO destructurado — ver
    // @deprecated en el tipo.
  } = props;

  const [newPresetName, setNewPresetName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleSaveAs = useCallback(() => {
    const name = newPresetName.trim();
    if (!name) return;
    onSavePresetAs(name);
    setNewPresetName("");
  }, [newPresetName, onSavePresetAs]);

  const handleStartRename = useCallback((p: NamedLayoutPreset) => {
    setEditingId(p.id);
    setEditingName(p.name);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (!editingId) return;
    onRenamePreset(editingId, editingName);
    setEditingId(null);
    setEditingName("");
  }, [editingId, editingName, onRenamePreset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuración de vista"
      description="Personalizá layout, plantilla y visibilidad de cards. Solo afecta tu sesión."
      // El X built-in del Modal usa un wrapper custom con menos pulido
      // (sin focus-visible ring + sin scale). Lo ocultamos y montamos
      // un TPIconButton del sistema en `headerRight` para consistencia
      // con el resto de Factura (toolbar layout / botones de cards).
      hideHeaderClose
      headerRight={
        <TPIconButton
          onClick={onClose}
          aria-label="Cerrar configuración"
          title="Cerrar configuración (Esc)"
        >
          <X size={16} aria-hidden />
        </TPIconButton>
      }
      footer={
        <TPButton
          variant="secondary"
          onClick={onClose}
          iconLeft={<X size={14} />}
          className="h-9 text-sm"
          aria-label="Cerrar configuración"
        >
          Cerrar
        </TPButton>
      }
    >
      <div className="space-y-5">
        {/* ── Plantilla de vista ───────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text">Plantilla de vista</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPresetChange(p)}
                className={
                  "flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors "
                  + (preset === p
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/30")
                }
              >
                <span className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-text">{PRESET_LABELS[p]}</span>
                  {preset === p && <Check size={14} className="text-primary" aria-hidden />}
                </span>
                <span className="text-[11px] leading-tight text-muted">
                  {PRESET_DESCRIPTIONS[p]}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Personalizar layout ──────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text">Layout</h3>
          <div className="flex flex-wrap items-center gap-2">
            <TPButton
              variant="secondary"
              onClick={() => {
                onEnterEditMode();
                onClose();
              }}
              iconLeft={<LayoutGrid size={14} />}
              className="h-8 text-xs"
            >
              Personalizar layout
            </TPButton>
            <TPButton
              variant="ghost"
              onClick={onResetLayout}
              className="h-8 text-xs"
            >
              Restaurar diseno del preset
            </TPButton>
          </div>
        </section>

        {/* ── Mis vistas ───────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text">Mis vistas</h3>
          <p className="mb-2 text-[11px] text-muted">
            Guarda el layout actual como una vista nombrada para reusarla luego.
          </p>
          <div className="mb-3 flex items-center gap-2">
            <TPInput
              value={newPresetName}
              onChange={(v) => setNewPresetName(v)}
              placeholder="Nombre de la vista"
              className="h-8 text-xs"
            />
            <TPButton
              variant="secondary"
              onClick={handleSaveAs}
              disabled={!newPresetName.trim()}
              iconLeft={<Plus size={14} />}
              className="h-8 shrink-0 text-xs"
            >
              Guardar
            </TPButton>
          </div>
          {presets.length === 0 ? (
            <p className="text-[11px] italic text-muted">
              No tenes vistas guardadas aun.
            </p>
          ) : (
            <ul className="space-y-1">
              {presets.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5"
                >
                  {editingId === p.id ? (
                    <>
                      <TPInput
                        value={editingName}
                        onChange={(v) => setEditingName(v)}
                        className="h-7 flex-1 text-xs"
                        autoFocus
                      />
                      <TPIconButton
                        onClick={handleCommitRename}
                        title="Guardar nombre"
                        className="h-7 w-7"
                      >
                        <Check size={14} />
                      </TPIconButton>
                      <TPIconButton
                        onClick={() => setEditingId(null)}
                        title="Cancelar"
                        className="h-7 w-7"
                      >
                        <X size={14} />
                      </TPIconButton>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onApplyPreset(p.id)}
                        className="flex-1 truncate text-left text-xs text-text hover:text-primary"
                        title="Aplicar esta vista"
                      >
                        {p.name}
                      </button>
                      {/* 2026-05-27 — Boton "Marcar como vista por defecto"
                          (icono estrella) removido. Las vistas se seleccionan
                          clickeando el nombre (boton de arriba). El concepto
                          de favorito agregaba ruido visual sin beneficio
                          comercial — solo quedan Renombrar / Duplicar /
                          Eliminar como acciones secundarias. */}
                      <TPIconButton
                        onClick={() => handleStartRename(p)}
                        title="Renombrar"
                        className="h-7 w-7"
                      >
                        <Pencil size={14} />
                      </TPIconButton>
                      <TPIconButton
                        onClick={() => onDuplicatePreset(p.id)}
                        title="Duplicar"
                        className="h-7 w-7"
                      >
                        <Copy size={14} />
                      </TPIconButton>
                      <TPIconButton
                        onClick={() => onDeletePreset(p.id)}
                        title="Eliminar"
                        className="h-7 w-7"
                      >
                        <Trash2 size={14} />
                      </TPIconButton>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Visibilidad de cards ─────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text">Cards visibles</h3>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(Object.keys(VISIBLE_CARD_LABELS) as Array<keyof InvoiceVisibleCards>).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <TPCheckbox
                  checked={uiPreferences.visibleCards[k]}
                  onChange={(v) =>
                    onUiPatch({ visibleCards: { [k]: v } as Partial<InvoiceVisibleCards> })
                  }
                />
                <span className="text-xs text-text">{VISIBLE_CARD_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
