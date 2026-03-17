// src/pages/InventarioArticulos.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPButton } from "../components/ui/TPButton";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPRowActions } from "../components/ui/TPRowActions";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { toast } from "../lib/toast";
import {
  articlesApi,
  type ArticleRow,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  STOCK_MODE_LABELS,
} from "../services/articles";

/* =========================================================
   Columnas
========================================================= */
const COL_DEFS: TPColDef[] = [
  { key: "code",      label: "Código",     sortKey: "code",   canHide: false },
  { key: "name",      label: "Nombre",     sortKey: "name" },
  { key: "category",  label: "Categoría" },
  { key: "status",    label: "Estado",     sortKey: "status" },
  { key: "stockMode", label: "Modo stock", visible: false },
  { key: "actions",   label: "",           canHide: false, align: "right" },
];

/* =========================================================
   Componente
========================================================= */
export default function InventarioArticulos() {
  const navigate = useNavigate();

  const [rows, setRows]         = useState<ArticleRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [q, setQ]               = useState("");
  const [sortKey, setSortKey]   = useState("code");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");
  const [busyFav, setBusyFav]   = useState<string | null>(null);

  async function load(search = q) {
    setLoading(true);
    try {
      const res = await articlesApi.list({ q: search || undefined, take: 200 });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar artículos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name")   return a.name.localeCompare(b.name) * dir;
      if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
      return a.code.localeCompare(b.code) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function toggleFav(row: ArticleRow) {
    setBusyFav(row.id);
    try {
      const updated = await articlesApi.favorite(row.id);
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isFavorite: updated.isFavorite } : r))
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar favorito.");
    } finally {
      setBusyFav(null);
    }
  }

  return (
    <TPSectionShell
      title="Artículos"
      subtitle={`${total} artículo${total !== 1 ? "s" : ""}`}
      icon={<Package size={20} />}
      right={
        <TPButton onClick={() => navigate("/articulos/nuevo")}>
          + Nuevo artículo
        </TPButton>
      }
    >
      <TPTableKit
        rows={sorted}
        columns={COL_DEFS}
        storageKey="tptech_col_articles"
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por código o nombre…"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        loading={loading}
        onRowClick={(row) => navigate(`/articulos/${row.id}`)}
        countLabel={(n) => `${n} artículo${n !== 1 ? "s" : ""}`}
        renderRow={(row, vis) => (
          <TPTr key={row.id}>
            {vis.code && (
              <TPTd className="font-mono font-semibold text-text">
                {row.code}
              </TPTd>
            )}
            {vis.name && <TPTd>{row.name}</TPTd>}
            {vis.category && (
              <TPTd className="text-muted">{row.category?.name ?? "—"}</TPTd>
            )}
            {vis.status && (
              <TPTd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ARTICLE_STATUS_COLORS[row.status]}`}
                >
                  {ARTICLE_STATUS_LABELS[row.status]}
                </span>
              </TPTd>
            )}
            {vis.stockMode && (
              <TPTd className="text-muted text-xs">
                {STOCK_MODE_LABELS[row.stockMode]}
              </TPTd>
            )}
            {vis.actions && (
              <TPTd>
                <TPRowActions
                  onView={() => navigate(`/articulos/${row.id}`)}
                  onFavorite={() => toggleFav(row)}
                  isFavorite={row.isFavorite}
                  busyFavorite={busyFav === row.id}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />
    </TPSectionShell>
  );
}
