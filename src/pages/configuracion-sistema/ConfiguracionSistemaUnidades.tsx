// tptech-frontend/src/pages/configuracion-sistema/ConfiguracionSistemaUnidades.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Ruler, X } from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPSelect from "../../components/ui/TPSelect";
import { Modal } from "../../components/ui/Modal";
import { TPTd } from "../../components/ui/TPTable";
import { TPTableKit } from "../../components/ui/TPTableKit";

import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";

import {
  listUnits,
  createUnit,
  updateUnit,
  setFavoriteUnit,
  deleteUnit,
  type Unit,
  type UnitType,
} from "../../services/units";

/* =========================
   Tipo / labels / helpers
========================= */
type TabKey = "ALL" | UnitType;

const TYPE_LABELS: Record<UnitType, string> = {
  QUANTITY: "Cantidad",
  WEIGHT:   "Peso",
  LENGTH:   "Longitud",
  VOLUME:   "Volumen",
  OTHER:    "Otro",
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL",      label: "Todas" },
  { key: "QUANTITY", label: "Cantidad" },
  { key: "WEIGHT",   label: "Peso" },
  { key: "LENGTH",   label: "Longitud" },
  { key: "VOLUME",   label: "Volumen" },
  { key: "OTHER",    label: "Otro" },
];

const TYPE_BADGE_CLASS: Record<UnitType, string> = {
  QUANTITY: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  WEIGHT:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  LENGTH:   "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  VOLUME:   "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  OTHER:    "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

function TypeBadge({ type }: { type: UnitType }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      TYPE_BADGE_CLASS[type]
    )}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function SystemBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap">
      Sistema
    </span>
  );
}

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as UnitType[]).map(t => ({
  value: t,
  label: TYPE_LABELS[t],
}));

function norm(s: string) {
  return (s ?? "").toString().toLowerCase().trim();
}

/* =========================
   Página
========================= */
export default function ConfiguracionSistemaUnidades() {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<"NAME" | "CODE" | "TYPE" | "STATUS">("NAME");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { askDelete, dialogProps: deleteDialogProps } = useConfirmDelete();

  // Modal crear/editar — UI simplificada: solo Nombre + Tipo.
  // Code, isActive y sortOrder se mantienen en el payload backend (derivados o preservados).
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [fName, setFName] = useState("");
  // Código interno editable — el operador puede dejarlo vacío y se deriva
  // del nombre vía `slugifyCode`. Cuando edita, conserva el existente.
  const [fCode, setFCode] = useState("");
  const [fCodeTouched, setFCodeTouched] = useState(false);
  const [fType, setFType] = useState<UnitType>("QUANTITY");
  const [formError, setFormError] = useState<string | null>(null);

  /** Deriva un code AUTO desde el nombre (sin acentos, lowercase, alfanumérico).
   *  Sólo se usa cuando el operador no editó el campo Código — al editarlo,
   *  se respeta el case que tipea (via `sanitizeCodeInput`). */
  function slugifyCode(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 40);
  }

  /** Sanitiza el código tipeado por el operador PRESERVANDO el case original
   *  (mayúsculas/minúsculas/mixto). Mantiene letras y números, quita acentos
   *  y caracteres peligrosos. Si el operador escribió "mL" → queda "mL";
   *  "KG" → "KG"; "Pack" → "Pack". El backend valida unicidad. */
  function sanitizeCodeInput(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 40);
  }

  async function refresh() {
    try {
      setErr(null);
      setLoading(true);
      const rows = await listUnits({});
      setItems(rows);
    } catch (e: any) {
      setErr(e?.message || "No se pudieron cargar las unidades.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function toggleSort(key: typeof sortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir(d => (d === "asc" ? "desc" : "asc"));
  }

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      ALL: items.length,
      QUANTITY: 0, WEIGHT: 0, LENGTH: 0, VOLUME: 0, OTHER: 0,
    };
    for (const u of items) c[u.type]++;
    return c;
  }, [items]);

  const visibleRows = useMemo(() => {
    let rows = items;
    if (tab !== "ALL") rows = rows.filter(r => r.type === tab);
    const s = norm(q);
    if (s) rows = rows.filter(r => norm(r.name).includes(s) || norm(r.code).includes(s));

    // Orden por defecto (sortKey=NAME + sortDir=asc, lectura inicial):
    //   1. Favoritas primero
    //   2. Unidades del sistema antes que personalizadas
    //   3. Orden alfabético
    // Cuando el usuario hace click en otra columna o invierte la dirección,
    // se respeta ese sort explícito (sin imponer la prioridad de favoritos).
    const isDefaultSort = sortKey === "NAME" && sortDir === "asc";
    if (isDefaultSort) {
      return [...rows].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.isSystem   !== b.isSystem)   return a.isSystem   ? -1 : 1;
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let primary = 0;
      if (sortKey === "NAME") {
        primary = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      } else if (sortKey === "CODE") {
        primary = a.code.localeCompare(b.code, "es", { sensitivity: "base" });
      } else if (sortKey === "TYPE") {
        primary = a.type.localeCompare(b.type);
      } else if (sortKey === "STATUS") {
        primary = (a.isActive === b.isActive) ? 0 : (a.isActive ? -1 : 1);
      }
      if (primary !== 0) return primary * dir;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * dir;
    });
  }, [items, tab, q, sortKey, sortDir]);

  /* =========================
     Modal handlers
  ========================= */
  function openCreate() {
    setEditing(null);
    setFName("");
    setFCode("");
    setFCodeTouched(false);
    setFType(tab !== "ALL" ? (tab as UnitType) : "QUANTITY");
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setFName(u.name);
    setFCode(u.code ?? "");
    setFCodeTouched(true); // En edit el operador ya tiene un code explícito.
    setFType(u.type);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (savingBusy) return;
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function upsert() {
    const name = fName.trim();
    if (!name) { setFormError("El nombre es obligatorio."); return; }

    // Code:
    //   · Si el operador editó el campo (touched), respetar su valor PRESERVANDO
    //     el case (mayúsc/minúsc/mixto) — solo se sanitiza para quitar acentos
    //     y caracteres no alfanuméricos.
    //   · Si no editó, derivar auto del nombre (lowercase via slugifyCode).
    // Backend valida unicidad y devuelve 409 si colisiona.
    const codeInput = fCode.trim();
    const codeSanitized = fCodeTouched && codeInput.length > 0
      ? sanitizeCodeInput(codeInput) || codeInput
      : (slugifyCode(name) || name);
    if (!codeSanitized) {
      setFormError("El código no puede estar vacío.");
      return;
    }
    const code = codeSanitized;

    try {
      setFormError(null);
      setSavingBusy(true);

      if (editing) {
        await updateUnit(editing.id, {
          name, code, type: fType,
          isActive: editing.isActive,
          sortOrder: editing.sortOrder ?? 0,
        });
      } else {
        await createUnit({
          name, code, type: fType,
          isActive: true,
          sortOrder: 0,
        });
      }

      await refresh();
      closeModal();
    } catch (e: any) {
      const issue = e?.data?.issues?.[0]?.message;
      setFormError(issue || e?.message || "No se pudo guardar.");
    } finally {
      setSavingBusy(false);
    }
  }

  async function toggleActive(u: Unit) {
    try {
      setSavingBusy(true);
      setItems(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x));
      await updateUnit(u.id, { isActive: !u.isActive });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el estado.");
      await refresh();
    } finally {
      setSavingBusy(false);
    }
  }

  async function setFavorite(u: Unit) {
    try {
      setSavingBusy(true);
      const next = !u.isFavorite;
      // Optimista: por tipo, solo una favorita
      setItems(prev => prev.map(x => {
        if (x.type !== u.type) return x;
        if (x.id === u.id) return { ...x, isFavorite: next };
        return next ? { ...x, isFavorite: false } : x;
      }));
      await setFavoriteUnit(u.id, next);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el favorito.");
      await refresh();
    } finally {
      setSavingBusy(false);
    }
  }

  function removeRow(u: Unit) {
    askDelete({
      entityName: "unidad",
      entityLabel: `${u.name} (${u.code})`,
      onDelete: () => deleteUnit(u.id),
      onAfterSuccess: () => refresh(),
    });
  }

  return (
    <TPSectionShell
      title="Unidades"
      subtitle="Administrá unidades de venta, peso, dimensión y volumen."
      icon={<Ruler size={22} />}
    >
      {/* Tabs por tipo — pestañas reales con border-bottom (estilo TPTech).
          Reemplaza los chips redondeados anteriores. Mantiene los mismos
          counts y el mismo handler (setTab) — sólo cambia el styling. */}
      <div className="mb-3 border-b border-border" role="tablist" aria-label="Tipo de unidad">
        <div className="flex flex-wrap gap-1 -mb-px">
          {TABS.map(t => {
            const active = tab === t.key;
            const n = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition border-b-2 -mb-px",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-t",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-text hover:border-border",
                )}
              >
                {t.label}
                <span className={cn(
                  "ml-1.5 text-[10px] tabular-nums",
                  active ? "text-primary/70" : "text-muted/60",
                )}>
                  ({n})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

      <TPTableKit
        rows={visibleRows}
        columns={[
          { key: "name",     label: "Nombre",   canHide: false, sortKey: "NAME" },
          { key: "code",     label: "Código",   sortKey: "CODE" },
          { key: "type",     label: "Tipo",     sortKey: "TYPE" },
          { key: "status",   label: "Estado",   sortKey: "STATUS" },
          { key: "acciones", label: "Acciones", canHide: false, align: "right" },
        ]}
        storageKey="tptech_col_units_v2"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por nombre o código…"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key) => toggleSort(key as typeof sortKey)}
        loading={loading}
        // Estado vacío contextual: si hay búsqueda activa, indica "ningún
        // match"; sino, indica que la pestaña activa no tiene unidades.
        emptyText={
          q.trim().length > 0
            ? "No hay unidades con esos filtros."
            : tab === "ALL"
              ? "Todavía no hay unidades configuradas."
              : `No hay unidades de tipo ${TYPE_LABELS[tab as UnitType].toLowerCase()}.`
        }
        pagination
        countLabel={(n) => `${n} unidad${n === 1 ? "" : "es"}`}
        actions={
          <TPButton
            variant="primary"
            onClick={openCreate}
            disabled={savingBusy}
            iconLeft={<Plus size={15} />}
          >
            Nueva unidad
          </TPButton>
        }
        renderRow={(r: Unit, vis) => (
          <tr key={r.id} className="border-b border-border hover:bg-surface2/40 transition-colors">
            {vis.name && (
              <TPTd>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">{r.name}</span>
                  {r.isSystem && <SystemBadge />}
                </div>
              </TPTd>
            )}
            {vis.code && (
              <TPTd>
                {/* Badge técnico — monospace, legible, secundario al nombre.
                    `min-w` garantiza ancho consistente para codes cortos (g)
                    y largos (pack). Contraste mejorado: bg sólido + texto
                    text/85 (antes era text-muted sobre bg muy translúcido). */}
                <span className="inline-flex items-center justify-center rounded-md border border-border/70 bg-surface2 px-2 py-0.5 font-mono text-[11px] font-semibold text-text/85 tabular-nums min-w-[2.25rem]">
                  {r.code}
                </span>
              </TPTd>
            )}
            {vis.type && (
              <TPTd>
                <TypeBadge type={r.type} />
              </TPTd>
            )}
            {vis.status && (
              <TPTd>
                <TPStatusPill active={r.isActive} activeLabel="Activa" inactiveLabel="Inactiva" />
              </TPTd>
            )}
            {vis.acciones && (
              <TPTd className="text-right">
                <div className={cn(savingBusy && "pointer-events-none opacity-50")}>
                  <TPRowActions
                    onFavorite={() => setFavorite(r)}
                    isFavorite={Boolean(r.isFavorite)}
                    onEdit={() => openEdit(r)}
                    onToggle={() => toggleActive(r)}
                    isActive={r.isActive}
                    onDelete={() => removeRow(r)}
                  />
                </div>
              </TPTd>
            )}
          </tr>
        )}
      />

      <ConfirmDeleteDialog {...deleteDialogProps} />

      {/* ================= Modal Crear/Editar ================= */}
      <Modal
        open={modalOpen}
        title={editing ? "Editar unidad" : "Nueva unidad"}
        maxWidth="sm"
        busy={savingBusy}
        onClose={closeModal}
        onEnter={upsert}
        footer={
          <>
            <TPButton variant="secondary" onClick={closeModal} disabled={savingBusy} iconLeft={<X size={16} />}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={upsert} loading={savingBusy} iconLeft={<Save size={16} />}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
              {formError}
            </div>
          )}

          <TPField label="Nombre" required>
            <TPInput
              value={fName}
              onChange={(v) => { setFName(v); setFormError(null); }}
              placeholder="Ej: Gramo, Centímetro, Par"
              disabled={savingBusy}
            />
          </TPField>

          <TPField
            label="Código"
            hint={
              editing
                ? "Identificador técnico estable. Cambiarlo puede afectar artículos que ya lo usan."
                : "Se autogenera desde el nombre. Podés editarlo (alfanumérico, sin espacios)."
            }
          >
            <TPInput
              value={fCode}
              onChange={(v) => {
                // Sanitiza en vivo PRESERVANDO el case que tipea el operador
                // (mayúsculas/minúsculas/mixto). Solo quita acentos, espacios
                // y caracteres no alfanuméricos. El backend valida unicidad.
                const sanitized = sanitizeCodeInput(v);
                setFCode(sanitized);
                setFCodeTouched(true);
                setFormError(null);
              }}
              placeholder={fName ? (slugifyCode(fName) || "código") : "Ej: g, kg, un, par"}
              disabled={savingBusy}
              // Visualmente técnico (monospace) — consistente con el pill de
              // la columna Código en la tabla.
              className="font-mono"
            />
          </TPField>

          <TPField label="Tipo" required>
            <TPSelect
              value={fType}
              onChange={(v) => setFType(v as UnitType)}
              options={TYPE_OPTIONS}
              disabled={savingBusy}
            />
          </TPField>
        </div>
      </Modal>
    </TPSectionShell>
  );
}
