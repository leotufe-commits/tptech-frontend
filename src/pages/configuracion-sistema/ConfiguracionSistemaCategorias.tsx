import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Save,
  X,
  FolderOpen,
  FolderTree,
  ChevronsDownUp,
  ChevronsUpDown,
  SlidersHorizontal,
  Tags,
} from "lucide-react";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { cn } from "../../components/ui/tp";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { TPField } from "../../components/ui/TPField";
import TPTextarea from "../../components/ui/TPTextarea";
import TPComboFixed from "../../components/ui/TPComboFixed";
import { TPCard } from "../../components/ui/TPCard";
import { Modal } from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableFooter,
} from "../../components/ui/TPTable";
import { TPSearchInput } from "../../components/ui/TPSearchInput";
import { TPColumnPicker, type ColPickerDef } from "../../components/ui/TPColumnPicker";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import { SortArrows } from "../../components/ui/TPSort";
import {
  TPTreeTable,
  type TreeColDef,
  type TreeNodeBase,
} from "../../components/ui/TPTreeTable";

import { toast } from "../../lib/toast";
import { categoriesApi, type CategoryRow } from "../../services/categories";
import { priceListsApi, type PriceListRow } from "../../services/price-lists";
import { CategoryAttributesModal } from "./CategoryAttributesModal";
import { AttributeLibraryModal } from "./AttributeLibraryModal";
import {
  buildCategoryTree,
  flattenVisible,
  searchCategoryTree,
  getRootIds,
  getAllIds,
  getDescendantIds,
  type CategoryNode,
} from "./categorias-tree.helpers";

/* =========================================================
   Column definitions (persisted in localStorage)
========================================================= */
const COL_DEFS: ColPickerDef[] = [
  { key: "name", label: "Nombre", canHide: false },
  { key: "attributes", label: "Atributos" },
  { key: "pricelist", label: "Lista de precios" },
  { key: "subcategories", label: "Sub-categorías" },
  { key: "description", label: "Descripción" },
  { key: "status", label: "Estado" },
  { key: "acciones", label: "Acciones", canHide: false },
];

const COL_LS_KEY = "tptech_col_categories_tree";
const COL_ORDER_LS_KEY = "tptech_col_order_categories_tree";

function loadColVis(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COL_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveColVis(vis: Record<string, boolean>) {
  localStorage.setItem(COL_LS_KEY, JSON.stringify(vis));
}

function loadColOrder(): string[] {
  try {
    const raw = localStorage.getItem(COL_ORDER_LS_KEY);
    return raw ? JSON.parse(raw) : COL_DEFS.map((c) => c.key);
  } catch {
    return COL_DEFS.map((c) => c.key);
  }
}

function saveColOrder(order: string[]) {
  localStorage.setItem(COL_ORDER_LS_KEY, JSON.stringify(order));
}

function v(colVis: Record<string, boolean>, key: string) {
  return colVis[key] !== false;
}

/* =========================================================
   Componente principal
========================================================= */
export default function ConfiguracionSistemaCategorias() {
  /* ---------- datos ---------- */
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------- búsqueda ---------- */
  const [q, setQ] = useState("");

  /* ---------- sorting ---------- */
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /* ---------- visibilidad de columnas ---------- */
  const [colVis, setColVis] = useState<Record<string, boolean>>(loadColVis);
  const [colOrder, setColOrder] = useState<string[]>(loadColOrder);

  function handleColChange(key: string, visible: boolean) {
    setColVis((prev) => {
      const next = { ...prev, [key]: visible };
      saveColVis(next);
      return next;
    });
  }

  function handleColOrderChange(nextOrder: string[]) {
    setColOrder(nextOrder);
    saveColOrder(nextOrder);
  }

  /* ---------- árbol expandido ---------- */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ---------- árbol computado ---------- */
  const tree = useMemo(() => buildCategoryTree(rows, sortDir), [rows, sortDir]);

  useEffect(() => {
    if (tree.length > 0) {
      setExpanded(new Set(getRootIds(tree)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length > 0]);

  /* ---------- filas visibles (árbol aplanado) ---------- */
  const visibleRows = useMemo<CategoryNode[]>(() => {
    const trimmed = q.trim();
    if (trimmed) return searchCategoryTree(tree, trimmed);
    return flattenVisible(tree, expanded);
  }, [tree, expanded, q]);

  /* ---------- helpers de expansión ---------- */
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(getAllIds(tree)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  const isAllExpanded = useMemo(() => {
    const allIds = getAllIds(tree);
    const parentIds = allIds.filter((id) => {
      const found = visibleRows.find((n) => n.id === id);
      return found && found.children.length > 0;
    });
    return parentIds.length > 0 && parentIds.every((id) => expanded.has(id));
  }, [tree, expanded, visibleRows]);

  /* ---------- DnD sensors ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ---------- modales de categoría ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<CategoryNode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  /* ---------- modal de atributos ---------- */
  const [attrsOpen, setAttrsOpen] = useState(false);
  const [attrsTarget, setAttrsTarget] = useState<CategoryRow | null>(null);

  /* ---------- modal biblioteca de atributos ---------- */
  const [libOpen, setLibOpen] = useState(false);

  /* ---------- busy ---------- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  /* ---------- draft del modal de categoría ---------- */
  const [draftName, setDraftName] = useState("");
  const [draftParentId, setDraftParentId] = useState("");
  const [draftDefaultPriceListId, setDraftDefaultPriceListId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editOpen) {
      const t = window.setTimeout(() => {
        nameRef.current?.focus();
        nameRef.current?.select();
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [editOpen]);

  /* ---------- carga inicial ---------- */
  async function load() {
    try {
      setLoading(true);
      const [cats, pls] = await Promise.all([
        categoriesApi.list(),
        priceListsApi.list(),
      ]);
      setRows(cats);
      setPriceLists(pls.filter((pl) => pl.isActive && !pl.deletedAt));
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* ---------- opciones de padre en selector ---------- */
  const parentOptions = useMemo(() => {
    return rows.filter((r) => {
      if (!r.isActive || r.deletedAt !== null) return false;
      if (r.id === editTarget?.id) return false;
      return true;
    });
  }, [rows, editTarget]);

  /* ---------- opciones de padre como árbol con indentación ---------- */
  const parentTreeOptions = useMemo(() => {
    const result: { value: string; label: string }[] = [];
    function traverse(nodes: CategoryNode[]) {
      for (const node of nodes) {
        if (node.isActive && !node.deletedAt && node.id !== editTarget?.id) {
          result.push({
            value: node.id,
            label: "— ".repeat(node.level) + node.name,
          });
        }
        traverse(node.children);
      }
    }
    traverse(tree);
    return result;
  }, [tree, editTarget]);

  /* ---------- abrir modales ---------- */
  function openCreate(defaultParentId?: string) {
    setEditTarget(null);
    setDraftName("");
    setDraftParentId(defaultParentId ?? "");
    setDraftDefaultPriceListId("");
    setDraftDescription("");
    setSubmitted(false);
    setEditOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setEditTarget(row);
    setDraftName(row.name);
    setDraftParentId(row.parentId ?? "");
    setDraftDefaultPriceListId(row.defaultPriceListId ?? "");
    setDraftDescription(row.description ?? "");
    setSubmitted(false);
    setEditOpen(true);
  }

  function openView(row: CategoryNode) {
    setViewTarget(row);
    setViewOpen(true);
  }

  function openDelete(row: CategoryRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  function openAttributes(row: CategoryRow) {
    setAttrsTarget(row);
    setAttrsOpen(true);
  }

  /* ---------- guardar categoría ---------- */
  async function handleSave() {
    setSubmitted(true);
    const name = draftName.trim();
    if (!name) return;

    const payload = {
      name,
      parentId: draftParentId || null,
      defaultPriceListId: draftDefaultPriceListId || null,
      description: draftDescription.trim(),
      sortOrder: editTarget?.sortOrder ?? 0,
      isActive: editTarget?.isActive ?? true,
    };

    try {
      setBusySave(true);
      if (editTarget) {
        await categoriesApi.update(editTarget.id, payload);
        toast.success("Categoría actualizada.");
      } else {
        const created = await categoriesApi.create(payload);
        toast.success("Categoría creada correctamente.");
        if (created.parentId) {
          setExpanded((prev) => new Set([...prev, created.parentId!]));
        }
      }
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---------- toggle activo/inactivo ---------- */
  async function handleToggle(row: CategoryRow) {
    const nextActive = !row.isActive;
    // Al desactivar, marcar visualmente toda la descendencia de inmediato
    const affectedIds = new Set([row.id, ...(!nextActive ? getDescendantIds(rows, row.id) : [])]);
    try {
      setRows((prev) =>
        prev.map((r) => affectedIds.has(r.id) ? { ...r, isActive: nextActive } : r)
      );
      await categoriesApi.toggle(row.id);
      toast.success(row.isActive ? "Categoría desactivada." : "Categoría activada.");
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      await load();
    }
  }

  /* ---------- eliminar ---------- */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setBusyDelete(true);
      await categoriesApi.remove(deleteTarget.id);
      toast.success("Categoría eliminada.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ocurrió un error.");
    } finally {
      setBusyDelete(false);
    }
  }

  /* ---------- drag & drop reorder ---------- */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeNode = visibleRows.find((r) => r.id === activeId);
    const overNode = visibleRows.find((r) => r.id === overId);

    if (!activeNode || !overNode) return;

    if (activeNode.parentId !== overNode.parentId) {
      toast.error("Solo podés reordenar categorías dentro del mismo nivel.");
      return;
    }

    const siblings = visibleRows.filter((r) => r.parentId === activeNode.parentId);
    const oldIndex = siblings.findIndex((r) => r.id === activeId);
    const newIndex = siblings.findIndex((r) => r.id === overId);

    if (oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const orderedIds = reordered.map((r) => r.id);

    setRows((prev) => {
      const next = [...prev];
      reordered.forEach((node, i) => {
        const idx = next.findIndex((r) => r.id === node.id);
        if (idx !== -1) next[idx] = { ...next[idx], sortOrder: i * 10 };
      });
      return next;
    });

    try {
      await categoriesApi.reorder({ parentId: activeNode.parentId, orderedIds });
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar el orden.");
      await load();
    }
  }

  /* ---------- formato fecha ---------- */
  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const isSearching = q.trim().length > 0;

  /* =========================================================
     Definición de columnas para TPTreeTable
  ========================================================= */
  const treeColumnsBase: TreeColDef[] = [
    {
      key: "name",
      visible: v(colVis, "name"),
      header: (
        <button type="button" className="flex items-center gap-1" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          Nombre
          <SortArrows dir={sortDir} active />
        </button>
      ),
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        return (
          <>
            <div
              className={cn(
                "h-7 w-7 shrink-0 grid place-items-center rounded-lg border border-border",
                node.level === 0
                  ? "bg-primary/10 text-primary"
                  : "bg-surface2 text-muted"
              )}
            >
              {node.level === 0 ? (
                <FolderTree size={13} />
              ) : (
                <FolderOpen size={13} />
              )}
            </div>

            <span
              className={cn(
                "text-sm truncate min-w-0",
                node.level === 0 ? "font-medium text-text" : "text-text"
              )}
            >
              {node.name}
            </span>

            <button
              type="button"
              title="Administrar atributos"
              onClick={(e) => {
                e.stopPropagation();
                openAttributes(node);
              }}
              className={cn(
                "shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors",
                (node.attributeCount ?? 0) > 0
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted/35 hover:bg-surface2 hover:text-muted"
              )}
            >
              <Tags size={10} />
              {(node.attributeCount ?? 0) > 0 && (
                <span className="font-medium leading-none">
                  {node.attributeCount}
                </span>
              )}
            </button>
          </>
        );
      },
    },
    {
      key: "attributes",
      visible: v(colVis, "attributes"),
      header: "Atributos",
      className: "hidden md:table-cell",
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        const preview = node.attributePreview ?? [];
        const count = node.attributeCount ?? 0;

        if (count === 0) {
          return <span className="text-sm text-muted">—</span>;
        }

        const hiddenCount = Math.max(0, count - preview.length);
        const text =
          hiddenCount > 0
            ? `${preview.join(", ")} +${hiddenCount}`
            : preview.join(", ");

        return (
          <span
            className="text-sm text-muted truncate max-w-[220px] block"
            title={text}
          >
            {text}
          </span>
        );
      },
    },
    {
      key: "pricelist",
      visible: v(colVis, "pricelist"),
      header: "Lista de precios",
      className: "hidden md:table-cell",
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        return (
          <span className="text-sm text-muted truncate max-w-[160px] block">
            {node.defaultPriceList
              ? node.defaultPriceList.code
                ? `${node.defaultPriceList.name} (${node.defaultPriceList.code})`
                : node.defaultPriceList.name
              : "—"}
          </span>
        );
      },
    },
    {
      key: "subcategories",
      visible: v(colVis, "subcategories"),
      header: "Subcategorías",
      className: "hidden md:table-cell",
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        return (
          <span className="text-sm text-muted">
            {node.childrenCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <FolderOpen size={12} />
                {node.childrenCount}
              </span>
            ) : (
              "—"
            )}
          </span>
        );
      },
    },
    {
      key: "description",
      visible: v(colVis, "description"),
      header: "Descripción",
      className: "hidden lg:table-cell",
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        return node.description ? (
          <span className="text-sm text-muted truncate block max-w-[200px]">{node.description}</span>
        ) : (
          <span className="text-sm text-muted">—</span>
        );
      },
    },
    {
      key: "status",
      visible: v(colVis, "status"),
      header: "Estado",
      className: "hidden md:table-cell",
      renderCell: (raw) => {
        const node = raw as CategoryNode;
        return (
          <TPStatusPill
            active={node.isActive}
            activeLabel="Activa"
            inactiveLabel="Inactiva"
          />
        );
      },
    },
  ];

  const treeColumns = useMemo(() => {
    const map = new Map(treeColumnsBase.map((col) => [col.key, col]));
    const ordered = colOrder
      .map((key) => map.get(key))
      .filter(Boolean) as TreeColDef[];

    const missing = treeColumnsBase.filter((col) => !colOrder.includes(col.key));
    return [...ordered, ...missing];
  }, [treeColumnsBase, colOrder]);

  function renderActions(raw: TreeNodeBase) {
    const node = raw as CategoryNode;
    return (
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        <span className="md:hidden">
          <TPStatusPill
            active={node.isActive}
            activeLabel="Activa"
            inactiveLabel="Inactiva"
          />
        </span>
        <TPRowActions
          onView={() => openView(node)}
          onEdit={() => openEdit(node)}
          onToggle={() => handleToggle(node)}
          isActive={node.isActive}
          onDelete={() => openDelete(node)}
        />
      </div>
    );
  }

  return (
    <TPSectionShell
      title="Categorías y Atributos de Artículos"
      subtitle="Clasificación jerárquica del catálogo"
      icon={<FolderTree size={22} />}
    >
      <TPTableWrap>
        <TPTableHeader
          left={
            <div className="flex items-center gap-2 w-full">
              {!isSearching && tree.some((n) => n.children.length > 0) && (
                <button
                  type="button"
                  title={isAllExpanded ? "Colapsar todo" : "Expandir todo"}
                  onClick={isAllExpanded ? collapseAll : expandAll}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-surface h-9 w-9 text-text hover:bg-surface2/60 transition-colors shrink-0"
                >
                  {isAllExpanded ? (
                    <ChevronsDownUp size={15} />
                  ) : (
                    <ChevronsUpDown size={15} />
                  )}
                </button>
              )}
              <TPColumnPicker
                columns={COL_DEFS}
                visibility={colVis}
                onChange={handleColChange}
                order={colOrder}
                onOrderChange={handleColOrderChange}
              />
              <TPSearchInput
                value={q}
                onChange={setQ}
                placeholder="Buscar categorías…"
                className="h-9 w-full md:w-64"
              />
            </div>
          }
          right={
            <div className="flex items-center gap-2 shrink-0">
              <TPButton
                variant="secondary"
                onClick={() => setLibOpen(true)}
                iconLeft={<SlidersHorizontal size={15} />}
                className="h-9 whitespace-nowrap"
              >
                Biblioteca de atributos
              </TPButton>
              <TPButton
                variant="primary"
                onClick={() => openCreate()}
                iconLeft={<Plus size={16} />}
                className="h-9 whitespace-nowrap shrink-0"
              >
                Nueva categoría
              </TPButton>
            </div>
          }
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <TPTreeTable
            nodes={visibleRows as TreeNodeBase[]}
            columns={treeColumns}
            onRowClick={(node) => openView(node as CategoryNode)}
            renderActions={renderActions}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            draggable
            isSearching={isSearching}
            loading={loading}
            rowClassName={(raw) => !(raw as CategoryNode).isActive ? "opacity-60" : undefined}
            loadingElement={
              <FolderTree size={28} className="animate-pulse text-muted" />
            }
            emptyText={
              isSearching
                ? "No hay categorías que coincidan con esa búsqueda."
                : "Todavía no hay categorías. Creá la primera."
            }
          />
        </DndContext>

        <TPTableFooter>
          {rows.length} {rows.length === 1 ? "categoría" : "categorías"}
          {isSearching && visibleRows.length !== rows.length && (
            <span className="text-muted ml-1">
              ({visibleRows.length} resultado
              {visibleRows.length !== 1 ? "s" : ""})
            </span>
          )}
          {!isSearching && (
            <span className="text-muted ml-2 text-xs">
              · Arrastrá las filas para reordenar
            </span>
          )}
        </TPTableFooter>
      </TPTableWrap>

      <Modal
        open={editOpen}
        title={editTarget ? "Editar categoría" : "Nueva categoría"}
        maxWidth="md"
        busy={busySave}
        onClose={() => !busySave && setEditOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={busySave}
              iconLeft={<X size={16} />}
            >
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busySave} iconLeft={<Save size={16} />}>
              Guardar
            </TPButton>
          </>
        }
      >
        <TPCard title="Información general">
          <div className="space-y-4">
            <TPField
              label="Nombre"
              required
              error={
                submitted && !draftName.trim()
                  ? "El nombre es obligatorio."
                  : null
              }
            >
              <TPInput
                value={draftName}
                onChange={(val) => {
                  setDraftName(val);
                  if (submitted && val.trim()) setSubmitted(false);
                }}
                placeholder="Ej: Anillos"
                disabled={busySave}
                inputRef={nameRef}
              />
            </TPField>

            <TPField
              label="Categoría padre"
              hint="El sistema permite hasta 3 niveles: categoría principal → subcategoría → subcategoría hija."
            >
              <TPComboFixed
                value={draftParentId}
                onChange={(val) => setDraftParentId(val)}
                disabled={busySave}
                searchable
                searchPlaceholder="Buscar categoría…"
                options={[
                  { value: "", label: "Sin padre (categoría raíz)" },
                  ...parentTreeOptions,
                ]}
              />
            </TPField>

            <TPField
              label="Lista de precios por defecto"
              hint="Se aplicará automáticamente a los artículos de esta categoría."
            >
              <TPComboFixed
                value={draftDefaultPriceListId}
                onChange={(val) => setDraftDefaultPriceListId(val)}
                disabled={busySave}
                searchable
                searchPlaceholder="Buscar lista…"
                options={[
                  { value: "", label: "Sin lista asignada" },
                  ...priceLists.map((pl) => ({
                    value: pl.id,
                    label: pl.code ? `${pl.name} (${pl.code})` : pl.name,
                  })),
                ]}
              />
            </TPField>

            <TPField label="Descripción">
              <TPTextarea
                value={draftDescription}
                onChange={setDraftDescription}
                placeholder="Descripción opcional de la categoría…"
                disabled={busySave}
                minH={80}
              />
            </TPField>
          </div>
        </TPCard>
      </Modal>

      <Modal
        open={viewOpen}
        title={viewTarget?.name ?? "Detalle de categoría"}
        maxWidth="sm"
        onClose={() => setViewOpen(false)}
        footer={
          <TPButton variant="secondary" onClick={() => setViewOpen(false)} iconLeft={<X size={16} />}>
            Cerrar
          </TPButton>
        }
      >
        {viewTarget && (
          <div className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Nombre</span>
              <span className="text-text text-right">{viewTarget.name}</span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Categoría padre</span>
              <span className="text-text text-right">
                {viewTarget.parent?.name ?? (
                  <span className="text-muted italic">Sin padre (raíz)</span>
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Lista de precios</span>
              <span className="text-text text-right">
                {viewTarget.defaultPriceList ? (
                  viewTarget.defaultPriceList.code
                    ? `${viewTarget.defaultPriceList.name} (${viewTarget.defaultPriceList.code})`
                    : viewTarget.defaultPriceList.name
                ) : (
                  <span className="text-muted italic">Sin asignar</span>
                )}
              </span>
            </div>

            {/* Atributos con nombres */}
            <div className="flex flex-col gap-1.5 py-2">
              <span className="text-muted font-medium">
                Atributos
                {viewTarget.attributeCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted/70">
                    ({viewTarget.attributeCount})
                  </span>
                )}
              </span>
              {viewTarget.attributeCount === 0 ? (
                <span className="text-muted italic">Sin atributos</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {viewTarget.attributePreview.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-text"
                    >
                      {name}
                    </span>
                  ))}
                  {viewTarget.attributeCount > viewTarget.attributePreview.length && (
                    <span className="inline-flex items-center rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-muted">
                      +{viewTarget.attributeCount - viewTarget.attributePreview.length} más
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sub-categorías con nombres */}
            <div className="flex flex-col gap-1.5 py-2">
              <span className="text-muted font-medium">
                Sub-categorías
                {viewTarget.childrenCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted/70">
                    ({viewTarget.childrenCount})
                  </span>
                )}
              </span>
              {viewTarget.childrenCount === 0 ? (
                <span className="text-muted italic">Sin sub-categorías</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {viewTarget.children.slice(0, 8).map((child) => (
                    <span
                      key={child.id}
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs",
                        child.isActive
                          ? "bg-surface2 text-text"
                          : "bg-surface2/50 text-muted line-through"
                      )}
                    >
                      {child.name}
                    </span>
                  ))}
                  {viewTarget.childrenCount > 8 && (
                    <span className="inline-flex items-center rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-muted">
                      +{viewTarget.childrenCount - 8} más
                    </span>
                  )}
                </div>
              )}
            </div>

            {viewTarget.description && (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-muted font-medium shrink-0">Descripción</span>
                <span className="text-text leading-relaxed">{viewTarget.description}</span>
              </div>
            )}

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Estado</span>
              <TPStatusPill
                active={viewTarget.isActive}
                activeLabel="Activa"
                inactiveLabel="Inactiva"
              />
            </div>

            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted font-medium">Fecha de creación</span>
              <span className="text-text text-right">
                {formatDate(viewTarget.createdAt)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.name ?? ""}"`}
        description={
          deleteTarget && deleteTarget.childrenCount > 0
            ? `Esta categoría tiene ${deleteTarget.childrenCount} sub-categoría${deleteTarget.childrenCount > 1 ? "s" : ""} y no se puede eliminar directamente.`
            : "¿Estás seguro que querés eliminar esta categoría? Esta acción no se puede deshacer."
        }
        confirmText={
          deleteTarget && deleteTarget.childrenCount > 0
            ? "Entendido"
            : "Eliminar"
        }
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          deleteTarget && deleteTarget.childrenCount > 0
            ? () => {
                setDeleteOpen(false);
                setDeleteTarget(null);
              }
            : handleDelete
        }
      />

      <CategoryAttributesModal
        open={attrsOpen}
        categoryId={attrsTarget?.id ?? ""}
        categoryName={attrsTarget?.name ?? ""}
        onClose={() => setAttrsOpen(false)}
        onAttributesChanged={load}
      />

      <AttributeLibraryModal
        open={libOpen}
        onClose={() => setLibOpen(false)}
      />
    </TPSectionShell>
  );
}