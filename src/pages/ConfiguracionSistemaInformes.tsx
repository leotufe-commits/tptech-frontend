// tptech-frontend/src/pages/ConfiguracionSistemaItems.tsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Tag,
  Save,
  Receipt,
  Phone,
  Building2,
  MapPin,
  ShieldBan,
  ShieldCheck,
  Star,
} from "lucide-react";

import { SortArrows } from "../components/ui/TPSort";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CatalogKey = "TAX_CONDITION" | "PHONE_PREFIX" | "COUNTRY" | "PROVINCE" | "CITY";
type CatalogGroup = "Ubicaciones" | "Fiscal";

type Catalog = {
  key: CatalogKey;
  title: string;
  desc: string;
  group: CatalogGroup;
  icon: React.ReactNode;
};

type RowStatus = "Activo" | "Inactivo";

type Row = {
  id: string;
  name: string;
  code?: string;
  status: RowStatus;
  updatedAt?: string;
  favorite?: boolean; // ✅ favorito (solo 1 por catálogo)
};

function nowLabel() {
  return "hoy";
}

/* =========================
   Helpers: hints dinámicos por catálogo
========================= */
function catalogHints(key: CatalogKey) {
  switch (key) {
    case "TAX_CONDITION":
      return {
        modalSubtitle: "Definí una condición impositiva para usar en facturación y perfiles.",
        nameLabel: "Nombre",
        namePlaceholder: "Ej: Responsable Inscripto",
        nameHint: "Se verá en el sistema como opción del combo.",
        codeLabel: "Código (opcional)",
        codePlaceholder: "Ej: RI",
        codeHint: "Código corto para reportes/listados.",
        statusHint: "Desactivá para ocultar la opción sin borrar historial.",
      };

    case "PHONE_PREFIX":
      return {
        modalSubtitle: "Definí un prefijo para teléfonos (por país o región).",
        nameLabel: "País / Región",
        namePlaceholder: "Ej: Argentina",
        nameHint: "Nombre visible en el selector de prefijos.",
        codeLabel: "Prefijo (opcional)",
        codePlaceholder: "Ej: +54",
        codeHint: "Recomendado: incluye el “+”.",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    case "COUNTRY":
      return {
        modalSubtitle: "Definí un país para direcciones y datos fiscales.",
        nameLabel: "País",
        namePlaceholder: "Ej: Argentina",
        nameHint: "Nombre visible en el combo de país.",
        codeLabel: "Código (opcional)",
        codePlaceholder: "Ej: AR",
        codeHint: "Sugerido: ISO 2 letras.",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    case "PROVINCE":
      return {
        modalSubtitle: "Definí una provincia/estado para direcciones.",
        nameLabel: "Provincia / Estado",
        namePlaceholder: "Ej: Buenos Aires",
        nameHint: "Nombre visible en el combo de provincia/estado.",
        codeLabel: "Código (opcional)",
        codePlaceholder: "Ej: BA",
        codeHint: "Útil para abreviaturas y listados.",
        statusHint: "Desactivá para ocultarla del selector.",
      };

    case "CITY":
      return {
        modalSubtitle: "Definí una ciudad/localidad para direcciones y contacto.",
        nameLabel: "Ciudad / Localidad",
        namePlaceholder: "Ej: La Plata",
        nameHint: "Nombre visible en el combo de ciudad.",
        codeLabel: "Código (opcional)",
        codePlaceholder: "Ej: LP",
        codeHint: "Opcional: abreviatura interna.",
        statusHint: "Desactivá para ocultarla del selector.",
      };

    default:
      return {
        modalSubtitle: "Completá los campos y guardá.",
        nameLabel: "Nombre",
        namePlaceholder: "Ej: Nombre",
        nameHint: "Nombre visible en el sistema.",
        codeLabel: "Código (opcional)",
        codePlaceholder: "Ej: COD",
        codeHint: "Código corto para identificar.",
        statusHint: "Podés desactivar sin borrar.",
      };
  }
}

/* =========================
   UI: Pill / Badge
========================= */
function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "off";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "off"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : "border-border bg-surface2 text-muted";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

/* =========================
   UI: Modal (local)
========================= */
function ModalShell({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onMouseDown={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-[9999] grid place-items-center p-4">
        <div
          className="w-full max-w-[520px] rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{title}</div>
              <div className="mt-0.5 text-xs text-muted">{subtitle || "Completá los campos y guardá."}</div>
            </div>

            <button
              type="button"
              className="tp-btn-secondary h-10 w-10 !p-0 grid place-items-center"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4">{children}</div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* =========================
   Sort helpers
========================= */
type SortCol = "NAME" | "CODE" | "STATUS";
type SortDir = "asc" | "desc";

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function statusRank(s: RowStatus) {
  // para que "Activo" quede antes que "Inactivo" cuando ordenás por estado asc
  return s === "Activo" ? 0 : 1;
}

/* =========================
   Página
========================= */
export default function ConfiguracionSistemaItems() {
  const catalogs: Catalog[] = useMemo(
    () => [
      {
        key: "TAX_CONDITION",
        title: "Condición impositiva",
        desc: "Catálogo fiscal base (IVA / régimen).",
        group: "Fiscal",
        icon: <Receipt size={18} />,
      },
      {
        key: "PHONE_PREFIX",
        title: "Prefijos telefónicos",
        desc: "Códigos por país para teléfonos.",
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

  const [data, setData] = useState<Record<CatalogKey, Row[]>>(() => ( {
    TAX_CONDITION: [
      { id: "1", name: "Responsable Inscripto", code: "RI", status: "Activo", updatedAt: nowLabel(), favorite: true },
      { id: "2", name: "Monotributo", code: "MONO", status: "Activo", updatedAt: nowLabel(), favorite: false },
      { id: "3", name: "Consumidor Final", code: "CF", status: "Activo", updatedAt: nowLabel(), favorite: false },
    ],
    PHONE_PREFIX: [
      { id: "1", name: "Argentina", code: "+54", status: "Activo", updatedAt: nowLabel(), favorite: true },
      { id: "2", name: "Uruguay", code: "+598", status: "Activo", updatedAt: nowLabel(), favorite: false },
    ],
    COUNTRY: [{ id: "1", name: "Argentina", code: "AR", status: "Activo", updatedAt: nowLabel(), favorite: true }],
    PROVINCE: [
      { id: "1", name: "Buenos Aires", code: "BA", status: "Activo", updatedAt: nowLabel(), favorite: true },
      { id: "2", name: "Córdoba", code: "CB", status: "Activo", updatedAt: nowLabel(), favorite: false },
    ],
    CITY: [
      { id: "1", name: "CABA", code: "CABA", status: "Activo", updatedAt: nowLabel(), favorite: true },
      { id: "2", name: "La Plata", code: "LP", status: "Activo", updatedAt: nowLabel(), favorite: false },
    ],
  } ) );

  const [selected, setSelected] = useState<CatalogKey>("TAX_CONDITION");
  const [q, setQ] = useState("");

  const current = catalogs.find((c) => c.key === selected)!;
  const rowsAll = data[selected] ?? [];

  const hints = useMemo(() => catalogHints(selected), [selected]);

  const [sortBy, setSortBy] = useState<SortCol>("NAME");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: SortCol) {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  const filteredRows = useMemo(() => {
    const s = norm(q);
    if (!s) return rowsAll;

    return rowsAll.filter((r) => norm(r.name).includes(s) || norm(r.code).includes(s));
  }, [q, rowsAll]);

  // ✅ siempre mostrar ordenado (por defecto: alfabético asc por Nombre)
  const visibleRows = useMemo(() => {
    const arr = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      let ak = "";
      let bk = "";

      if (sortBy === "NAME") {
        ak = norm(a.name);
        bk = norm(b.name);
      } else if (sortBy === "CODE") {
        ak = norm(a.code || "");
        bk = norm(b.code || "");
      } else {
        // STATUS
        const ra = statusRank(a.status);
        const rb = statusRank(b.status);
        const primary = (ra - rb) * dir;
        if (primary !== 0) return primary;
        ak = norm(a.name);
        bk = norm(b.name);
      }

      const primary = ak.localeCompare(bk, "es", { sensitivity: "base" }) * dir;
      if (primary !== 0) return primary;

      // tie-break estable
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

  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fStatus, setFStatus] = useState<RowStatus>("Activo");
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setFName("");
    setFCode("");
    setFStatus("Activo");
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(r: Row) {
    setEditingId(r.id);
    setFName(r.name || "");
    setFCode(r.code || "");
    setFStatus(r.status || "Activo");
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function upsertRow() {
    const name = String(fName || "").trim();
    const code = String(fCode || "").trim();

    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    setData((prev) => {
      const list = Array.isArray(prev[selected]) ? [...prev[selected]] : [];

      const dup = list.some((r) => r.name.trim().toLowerCase() === name.toLowerCase() && r.id !== editingId);
      if (dup) {
        setFormError("Ya existe un ítem con ese nombre en este catálogo.");
        return prev;
      }

      if (editingId) {
        const idx = list.findIndex((r) => r.id === editingId);
        if (idx >= 0) list[idx] = { ...list[idx], name, code: code || undefined, status: fStatus, updatedAt: nowLabel() };
      } else {
        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        list.unshift({
          id,
          name,
          code: code || undefined,
          status: fStatus,
          updatedAt: nowLabel(),
          favorite: false,
        });
      }

      return { ...prev, [selected]: list };
    });

    closeModal();
  }

  function toggleActive(r: Row) {
    setData((prev) => {
      const list = Array.isArray(prev[selected]) ? [...prev[selected]] : [];
      const idx = list.findIndex((x) => x.id === r.id);
      if (idx < 0) return prev;

      const nextStatus: RowStatus = list[idx].status === "Activo" ? "Inactivo" : "Activo";
      list[idx] = { ...list[idx], status: nextStatus, updatedAt: nowLabel() };

      return { ...prev, [selected]: list };
    });
  }

  // ✅ solo 1 favorito por catálogo (tabla actual) + ✅ se puede deseleccionar
  function setFavorite(r: Row) {
    setData((prev) => {
      const list = Array.isArray(prev[selected]) ? [...prev[selected]] : [];
      const idx = list.findIndex((x) => x.id === r.id);
      if (idx < 0) return prev;

      const alreadyFav = Boolean(list[idx].favorite);

      // si ya era favorito -> deselecciona (todos quedan false)
      if (alreadyFav) {
        const next = list.map((x) => ({ ...x, favorite: false }));
        return { ...prev, [selected]: next };
      }

      // si no era favorito -> setea solo este como true
      const next = list.map((x) => ({ ...x, favorite: false }));
      next[idx] = { ...next[idx], favorite: true, updatedAt: nowLabel() };

      return { ...prev, [selected]: next };
    });
  }

  function removeRow(r: Row) {
    const ok = window.confirm(`¿Eliminar "${r.name}"?\n\nEsto es una demo mock. Luego lo conectamos al backend con confirmación real.`);
    if (!ok) return;

    setData((prev) => {
      const list = Array.isArray(prev[selected]) ? prev[selected].filter((x) => x.id !== r.id) : [];
      return { ...prev, [selected]: list };
    });
  }

  // “mock” de paginación (igual estilo Users)
  const page = 1;
  const totalPages = 1;

  // ✅ columnas (mantenemos tu layout original)
  const tableCols = "grid-cols-[1fr,120px,120px,140px]"; // Ítem | Código | Estado | Acciones

  return (
    <div className="p-6">
      <div className="mb-5">
        <div className="text-sm text-muted">Configuración del sistema</div>
        <h1 className="text-2xl font-bold text-text">Ítems del sistema</h1>
        <div className="mt-1 text-sm text-muted">Catálogos base usados en combos y selecciones (fiscal, ubicaciones, etc.).</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
        {/* ================= LEFT: Catálogos (sin buscador) ================= */}
        <aside className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Catálogos</div>
              <div className="text-xs text-muted mt-0.5">Elegí un combo y gestioná sus ítems.</div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {(["Fiscal", "Ubicaciones"] as CatalogGroup[]).map((groupName) => {
              const list = grouped[groupName] || [];
              if (!list.length) return null;

              return (
                <div key={groupName}>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide px-1">{groupName}</div>

                  <div className="mt-2 space-y-2">
                    {list.map((c) => {
                      const active = c.key === selected;
                      const count = (data[c.key] || []).length;

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
                                  active ? "border-primary/40 text-primary" : "border-border text-primary"
                                )}
                              >
                                {c.icon}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-text truncate">{c.title}</div>
                                  <span className="text-[11px] text-muted">({count})</span>
                                </div>
                                <div className="text-xs text-muted mt-0.5 line-clamp-2">{c.desc}</div>
                              </div>
                            </div>

                            <ChevronRight size={18} className={cn("mt-1 shrink-0", active ? "text-text" : "text-muted")} />
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
          {/* Header (con borde) + buscador + botón alineados */}
          <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 text-left">
                {/* ✅ título y descripción alineados a la izquierda */}
                <div className="text-lg font-bold text-text truncate text-left">{current.title}</div>
                <div className="text-sm text-muted mt-0.5 text-left">{current.desc}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[520px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre / código…"
                  className={cn(
                    "w-full h-10 rounded-xl border border-border bg-bg text-text pl-9 pr-3 text-sm",
                    "focus:outline-none focus:ring-4 focus:ring-primary/20"
                  )}
                />
              </div>

              <div className="flex items-center justify-end">
                <button type="button" className={cn("tp-btn-primary h-10 inline-flex items-center gap-2")} onClick={openCreate}>
                  <Plus size={16} />
                  Nuevo ítem
                </button>
              </div>
            </div>
          </div>

          {/* Tabla estilo Users */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
            {/* header */}
            <div className={cn("grid gap-0 border-b border-border bg-surface2 px-5 py-3 text-[11px] font-semibold text-muted", tableCols)}>
              <div className="uppercase tracking-wide text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:opacity-90"
                  onClick={() => toggleSort("NAME")}
                  title="Ordenar por ítem"
                >
                  Ítem
                  <SortArrows dir={sortDir} active={sortBy === "NAME"} />
                </button>
              </div>

              {/* ✅ header alineado a la izquierda (como el contenido) */}
              <div className="uppercase tracking-wide text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:opacity-90"
                  onClick={() => toggleSort("CODE")}
                  title="Ordenar por código"
                >
                  Código
                  <SortArrows dir={sortDir} active={sortBy === "CODE"} />
                </button>
              </div>

              {/* ✅ header alineado a la izquierda (como el contenido) */}
              <div className="uppercase tracking-wide text-left">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:opacity-90"
                  onClick={() => toggleSort("STATUS")}
                  title="Ordenar por estado"
                >
                  Estado
                  <SortArrows dir={sortDir} active={sortBy === "STATUS"} />
                </button>
              </div>

              <div className="uppercase tracking-wide text-right">Acciones</div>
            </div>

            {visibleRows.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface2 text-primary">
                  <Tag size={20} />
                </div>
                <div className="text-base font-semibold text-text">Sin resultados</div>
                <div className="mx-auto mt-1 max-w-[560px] text-sm text-muted">
                  No se encontraron ítems con ese filtro. Probá otra búsqueda o creá uno nuevo.
                </div>
                <div className="mt-4">
                  <button type="button" className="tp-btn-primary inline-flex items-center gap-2" onClick={openCreate}>
                    <Plus size={16} />
                    Nuevo ítem
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleRows.map((r) => {
                  const isFav = Boolean(r.favorite);

                  return (
                    <div key={r.id} className="px-5 py-4 hover:bg-surface2 transition">
                      <div className={cn("grid items-center gap-4", tableCols)}>
                        {/* Ítem */}
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 rounded-xl -ml-2 px-2 py-1"
                          title="Editar"
                        >
                          <div className="font-semibold text-text truncate">{r.name}</div>
                          <div className="text-xs text-muted mt-0.5">Actualizado: {r.updatedAt || "—"}</div>
                        </button>

                        {/* Código */}
                        <div className="min-w-0 text-left">
                          <span className="text-sm font-semibold text-text truncate block">{r.code || "—"}</span>
                        </div>

                        {/* Estado */}
                        <div className="min-w-0 text-left">
                          <Pill tone={r.status === "Activo" ? "ok" : "off"}>{r.status}</Pill>
                        </div>

                        {/* ✅ Acciones: Favorito (primero) / Editar / Activar-Inactivar / Eliminar */}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                            title={isFav ? "Quitar favorito" : "Marcar como favorito"}
                            onClick={() => setFavorite(r)}
                          >
                            <Star size={16} className={cn("stroke-current", isFav ? "fill-current text-yellow-400" : "fill-transparent text-text/80")} />
                          </button>

                          <button
                            type="button"
                            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                            title="Editar"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                            title={r.status === "Activo" ? "Desactivar" : "Activar"}
                            onClick={() => toggleActive(r)}
                          >
                            {r.status === "Activo" ? <ShieldBan size={16} /> : <ShieldCheck size={16} />}
                          </button>

                          <button
                            type="button"
                            className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                            title="Eliminar"
                            onClick={() => removeRow(r)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* footer estilo Users */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted">
              <div>
                {visibleRows.length} ítem{visibleRows.length === 1 ? "" : "s"}
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center" disabled title="Anterior">
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <div className="min-w-[48px] text-center font-semibold text-text">
                  {page} / {totalPages}
                </div>
                <button type="button" className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center" disabled title="Siguiente">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= Modal Crear/Editar ================= */}
      <ModalShell
        open={modalOpen}
        title={editingId ? `Editar ítem — ${current.title}` : `Nuevo ítem — ${current.title}`}
        subtitle={hints.modalSubtitle}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="tp-btn-secondary h-10 inline-flex items-center gap-2" onClick={closeModal}>
              <X size={16} />
              Cancelar
            </button>

            <button type="button" className="tp-btn-primary h-10 inline-flex items-center gap-2" onClick={upsertRow}>
              <Save size={16} />
              Guardar
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">{formError}</div>
        )}

        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">{hints.nameLabel}</label>
            <input
              value={fName}
              onChange={(e) => {
                setFName(e.target.value);
                setFormError(null);
              }}
              className={cn(
                "w-full h-10 rounded-xl border border-border bg-bg text-text px-3 text-sm",
                "focus:outline-none focus:ring-4 focus:ring-primary/20"
              )}
              placeholder={hints.namePlaceholder}
              autoFocus
            />
            <div className="mt-1 text-xs text-muted">{hints.nameHint}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">{hints.codeLabel}</label>
              <input
                value={fCode}
                onChange={(e) => setFCode(e.target.value)}
                className={cn(
                  "w-full h-10 rounded-xl border border-border bg-bg text-text px-3 text-sm",
                  "focus:outline-none focus:ring-4 focus:ring-primary/20"
                )}
                placeholder={hints.codePlaceholder}
              />
              <div className="mt-1 text-xs text-muted">{hints.codeHint}</div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Estado</label>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as RowStatus)}
                className={cn(
                  "w-full h-10 rounded-xl border border-border bg-bg text-text px-3 text-sm",
                  "focus:outline-none focus:ring-4 focus:ring-primary/20"
                )}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
              <div className="mt-1 text-xs text-muted">{hints.statusHint}</div>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
