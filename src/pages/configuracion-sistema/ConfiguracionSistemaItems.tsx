// tptech-frontend/src/pages/configuracion-sistema/ConfiguracionSistemaItems.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Plus,
  Tag,
  Receipt,
  Phone,
  Building2,
  MapPin,
  Loader2,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPSearchInput } from "../../components/ui/TPSearchInput";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPSelect from "../../components/ui/TPSelect";
import { Modal } from "../../components/ui/Modal";
import { SortArrows } from "../../components/ui/TPSort";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableFooter,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../components/ui/TPTable";

import {
  listCatalog,
  createCatalogItem,
  updateCatalogItem,
  setCatalogItemFavorite,
  type CatalogType,
} from "../../services/catalogs";

import {
  type CatalogGroup,
  type Catalog,
  type Row,
  type RowStatus,
  type SortCol,
  type SortDir,
  catalogHints,
  norm,
  statusRank,
  itemToRow,
} from "./catalogs.config";

/* =========================
   Página
========================= */
export default function ConfiguracionSistemaItems() {
  const catalogs: Catalog[] = useMemo(
    () => [
      {
        key: "DOCUMENT_TYPE",
        title: "Tipos de documento",
        desc: "Tipos de documento para usuarios y clientes.",
        group: "Fiscal",
        icon: <Tag size={18} />,
      },
      {
        key: "IVA_CONDITION",
        title: "Condición de IVA",
        desc: "Catálogo fiscal base (IVA / régimen).",
        group: "Fiscal",
        icon: <Receipt size={18} />,
      },
      {
        key: "PHONE_PREFIX",
        title: "Prefijos telefónicos",
        desc: "Códigos por país para teléfonos (ej: +54).",
        group: "Ubicaciones",
        icon: <Phone size={18} />,
      },
      {
        key: "COUNTRY",
        title: "Países",
        desc: "Listado de países para dirección.",
        group: "Ubicaciones",
        icon: <Building2 size={18} />,
      },
      {
        key: "PROVINCE",
        title: "Provincias / Estados",
        desc: "Divisiones administrativas.",
        group: "Ubicaciones",
        icon: <MapPin size={18} />,
      },
      {
        key: "CITY",
        title: "Ciudades",
        desc: "Localidades / ciudades.",
        group: "Ubicaciones",
        icon: <MapPin size={18} />,
      },
    ],
    []
  );

  const [selected, setSelected] = useState<CatalogType>("IVA_CONDITION");
  const [q, setQ] = useState("");

  const current = catalogs.find((c) => c.key === selected)!;
  const hints = useMemo(() => catalogHints(selected), [selected]);

  const [sortBy, setSortBy] = useState<SortCol>("LABEL");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [rowsByKey, setRowsByKey] = useState<Record<string, Row[]>>({});
  const rowsAll = rowsByKey[selected] ?? [];

  const [loading, setLoading] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleSort(col: SortCol) {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  async function refreshSelected(force = false) {
    try {
      setErr(null);
      setLoading(true);
      const items = await listCatalog(selected, { includeInactive: true, force });
      const rows = items.map(itemToRow);
      setRowsByKey((prev) => ({ ...prev, [selected]: rows }));
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSelected(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filteredRows = useMemo(() => {
    const s = norm(q);
    if (!s) return rowsAll;
    return rowsAll.filter((r) => norm(r.label).includes(s));
  }, [q, rowsAll]);

  const visibleRows = useMemo(() => {
    const arr = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      const fa = a.favorite ? 1 : 0;
      const fb = b.favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;

      if (sortBy === "STATUS") {
        const ra = statusRank(a.status);
        const rb = statusRank(b.status);
        const primary = (ra - rb) * dir;
        if (primary !== 0) return primary;
        return norm(a.label).localeCompare(norm(b.label), "es", { sensitivity: "base" }) * dir;
      }

      const primary = norm(a.label).localeCompare(norm(b.label), "es", { sensitivity: "base" }) * dir;
      if (primary !== 0) return primary;
      return String(a.id).localeCompare(String(b.id)) * dir;
    });

    return arr;
  }, [filteredRows, sortBy, sortDir]);

  const grouped = useMemo(() => {
    const out: Record<CatalogGroup, Catalog[]> = { Fiscal: [], Ubicaciones: [] };
    for (const c of catalogs) out[c.group].push(c);
    return out;
  }, [catalogs]);

  /* =========================
     Modal crear/editar
  ========================= */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fLabel, setFLabel] = useState("");
  const [fStatus, setFStatus] = useState<RowStatus>("Activo");
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setFLabel("");
    setFStatus("Activo");
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(r: Row) {
    setEditingId(r.id);
    setFLabel(r.label || "");
    setFStatus(r.status || "Activo");
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (savingBusy) return;
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  async function upsertRow() {
    const label = String(fLabel || "").trim();
    if (!label) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    const dup = rowsAll.some(
      (r) => r.label.trim().toLowerCase() === label.toLowerCase() && r.id !== editingId
    );
    if (dup) {
      setFormError("Ya existe un ítem con ese nombre en este catálogo.");
      return;
    }

    try {
      setFormError(null);
      setSavingBusy(true);

      if (editingId) {
        await updateCatalogItem(editingId, {
          label,
          isActive: fStatus === "Activo",
        });
      } else {
        await createCatalogItem(selected, label);
        if (fStatus === "Inactivo") {
          await refreshSelected(true);
          const just = (rowsByKey[selected] ?? []).find(
            (x) => x.label.trim().toLowerCase() === label.toLowerCase()
          );
          if (just?.id) await updateCatalogItem(just.id, { isActive: false });
        }
      }

      await refreshSelected(true);
      closeModal();
    } catch (e: any) {
      setFormError(e?.message || "No se pudo guardar.");
    } finally {
      setSavingBusy(false);
    }
  }

  async function toggleActive(r: Row) {
    try {
      setSavingBusy(true);
      const nextStatus: RowStatus = r.status === "Activo" ? "Inactivo" : "Activo";

      setRowsByKey((prev) => ({
        ...prev,
        [selected]: (prev[selected] ?? []).map((x) =>
          x.id === r.id ? { ...x, status: nextStatus } : x
        ),
      }));

      await updateCatalogItem(r.id, { isActive: nextStatus === "Activo" });
      await refreshSelected(true);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el estado.");
      await refreshSelected(true);
    } finally {
      setSavingBusy(false);
    }
  }

  async function setFavorite(r: Row) {
    try {
      setSavingBusy(true);
      const alreadyFav = Boolean(r.favorite);

      setRowsByKey((prev) => {
        const list = prev[selected] ?? [];
        if (alreadyFav) {
          return { ...prev, [selected]: list.map((x) => ({ ...x, favorite: false })) };
        }
        return {
          ...prev,
          [selected]: list.map((x) => ({ ...x, favorite: x.id === r.id })),
        };
      });

      await setCatalogItemFavorite(r.id, !alreadyFav);
      await refreshSelected(true);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el favorito.");
      await refreshSelected(true);
    } finally {
      setSavingBusy(false);
    }
  }

  async function removeRow(r: Row) {
    const ok = window.confirm(
      `¿Eliminar "${r.label}"?\n\nTodavía no está implementado el DELETE en backend. Si querés, lo agregamos (soft delete / isActive=false).`
    );
    if (!ok) return;
  }

  return (
    <TPSectionShell
      title="Ítems del sistema"
      subtitle="Catálogos base usados en combos y selecciones (fiscal, ubicaciones, etc.)."
      icon={<Tag size={22} />}
    >
      <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
        {/* ================= LEFT: Catálogos ================= */}
        <aside
          className="rounded-2xl border border-border bg-card p-4"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Catálogos</div>
              <div className="text-xs text-muted mt-0.5">
                Elegí un combo y gestioná sus ítems.
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {(["Fiscal", "Ubicaciones"] as CatalogGroup[]).map((groupName) => {
              const list = grouped[groupName] || [];
              if (!list.length) return null;

              return (
                <div key={groupName}>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
                    {groupName}
                  </div>

                  <div className="mt-2 space-y-2">
                    {list.map((c) => {
                      const active = c.key === selected;
                      const count = (rowsByKey[c.key] || []).length;

                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            setSelected(c.key);
                            setQ("");
                          }}
                          className={cn(
                            "w-full rounded-2xl border p-3 text-left transition",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                            active
                              ? "border-primary/50 bg-surface2 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                              : "border-border bg-card hover:bg-surface2"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={cn(
                                  "grid h-10 w-10 place-items-center rounded-xl border bg-bg",
                                  active
                                    ? "border-primary/40 text-primary"
                                    : "border-border text-primary"
                                )}
                              >
                                {c.icon}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-text truncate">
                                    {c.title}
                                  </div>
                                  <span className="text-[11px] text-muted">({count})</span>
                                </div>
                                <div className="text-xs text-muted mt-0.5 line-clamp-2">
                                  {c.desc}
                                </div>
                              </div>
                            </div>

                            <ChevronRight
                              size={18}
                              className={cn(
                                "mt-1 shrink-0",
                                active ? "text-text" : "text-muted"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ================= RIGHT ================= */}
        <section className="space-y-3">
          {/* Cabecera del catálogo seleccionado */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-text truncate">
                {current.title}
              </div>
              <div className="text-sm text-muted mt-0.5">{current.desc}</div>
            </div>
            <TPButton
              variant="secondary"
              onClick={() => refreshSelected(true)}
              disabled={loading || savingBusy}
              iconLeft={
                loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Tag size={15} />
                )
              }
              className="shrink-0"
            >
              {loading ? "Cargando…" : "Recargar"}
            </TPButton>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          {/* Tabla */}
          <TPTableWrap>
            <TPTableHeader
              left={
                <TPSearchInput
                  value={q}
                  onChange={setQ}
                  placeholder="Buscar por nombre…"
                  className="w-full md:w-64"
                />
              }
              right={
                <TPButton
                  variant="primary"
                  onClick={openCreate}
                  disabled={savingBusy}
                  iconLeft={<Plus size={15} />}
                >
                  Nuevo ítem
                </TPButton>
              }
            />

            <TPTableXScroll>
              <TPTableElBase responsive="scroll">
                <TPThead>
                  <tr>
                    <TPTh>
                      <button
                        type="button"
                        onClick={() => toggleSort("LABEL")}
                        className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                      >
                        Ítem
                        <SortArrows dir={sortDir} active={sortBy === "LABEL"} />
                      </button>
                    </TPTh>
                    <TPTh className="hidden md:table-cell">
                      <button
                        type="button"
                        onClick={() => toggleSort("STATUS")}
                        className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                      >
                        Estado
                        <SortArrows dir={sortDir} active={sortBy === "STATUS"} />
                      </button>
                    </TPTh>
                    <TPTh className="text-right">Acciones</TPTh>
                  </tr>
                </TPThead>

                <TPTbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                        Cargando…
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <TPEmptyRow
                      colSpan={3}
                      text="No se encontraron ítems con ese filtro."
                    />
                  ) : (
                    visibleRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border hover:bg-surface2/40 transition-colors"
                      >
                        <TPTd>
                          <span className="font-medium text-text">{r.label}</span>
                        </TPTd>
                        <TPTd className="hidden md:table-cell">
                          <TPStatusPill
                            active={r.status === "Activo"}
                            activeLabel="Activo"
                            inactiveLabel="Inactivo"
                          />
                        </TPTd>
                        <TPTd className="text-right">
                          <div
                            className={cn(
                              savingBusy && "pointer-events-none opacity-50"
                            )}
                          >
                            <TPRowActions
                              onFavorite={() => setFavorite(r)}
                              isFavorite={Boolean(r.favorite)}
                              onEdit={() => openEdit(r)}
                              onToggle={() => toggleActive(r)}
                              isActive={r.status === "Activo"}
                              onDelete={() => removeRow(r)}
                            />
                          </div>
                        </TPTd>
                      </tr>
                    ))
                  )}
                </TPTbody>
              </TPTableElBase>
            </TPTableXScroll>

            <TPTableFooter>
              {visibleRows.length} ítem{visibleRows.length === 1 ? "" : "s"}
            </TPTableFooter>
          </TPTableWrap>
        </section>
      </div>

      {/* ================= Modal Crear/Editar ================= */}
      <Modal
        open={modalOpen}
        title={
          editingId
            ? `Editar ítem — ${current.title}`
            : `Nuevo ítem — ${current.title}`
        }
        maxWidth="sm"
        busy={savingBusy}
        onClose={closeModal}
        onEnter={upsertRow}
        footer={
          <>
            <TPButton variant="secondary" onClick={closeModal} disabled={savingBusy}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={upsertRow} loading={savingBusy}>
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

          <TPField label={hints.nameLabel} hint={hints.nameHint}>
            <TPInput
              value={fLabel}
              onChange={(v) => {
                setFLabel(v);
                setFormError(null);
              }}
              placeholder={hints.namePlaceholder}
              disabled={savingBusy}
            />
          </TPField>

          <div className="grid gap-3 md:grid-cols-2">
            <TPField label="Estado" hint={hints.statusHint}>
              <TPSelect
                value={fStatus}
                onChange={(v) => setFStatus(v as RowStatus)}
                options={[
                  { value: "Activo", label: "Activo" },
                  { value: "Inactivo", label: "Inactivo" },
                ]}
                disabled={savingBusy}
              />
            </TPField>

            <div className="rounded-xl border border-border bg-surface2 p-3 text-xs text-muted">
              <div className="font-semibold text-text text-xs mb-1">Favorito ⭐</div>
              Definí un favorito por catálogo. En <b>Perfil de joyería</b>, si el campo está
              vacío al editar/crear, se tomará el favorito como valor inicial.
            </div>
          </div>
        </div>
      </Modal>
    </TPSectionShell>
  );
}
