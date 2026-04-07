// src/components/categories/CreateCategoryModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, X } from "lucide-react";

import { Modal }        from "../ui/Modal";
import { TPButton }     from "../ui/TPButton";
import { TPCard }       from "../ui/TPCard";
import { TPField }      from "../ui/TPField";
import TPInput          from "../ui/TPInput";
import TPTextarea       from "../ui/TPTextarea";
import TPComboFixed     from "../ui/TPComboFixed";
import { toast }        from "../../lib/toast";
import { categoriesApi, type CategoryRow } from "../../services/categories";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama con el id y nombre de la categoría recién creada */
  onCreated: (id: string, name: string) => void;
  /** Lista de categorías existentes para el selector de padre */
  categories: CategoryRow[];
  /** Pre-rellena el selector de padre con la categoría actualmente seleccionada */
  initialParentId?: string;
}

export function CreateCategoryModal({
  open,
  onClose,
  onCreated,
  categories,
  initialParentId,
}: Props) {
  const [name, setName]               = useState("");
  const [parentId, setParentId]       = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted]     = useState(false);
  const [busy, setBusy]               = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reiniciar al abrir
  useEffect(() => {
    if (open) {
      setName("");
      setParentId(initialParentId ?? "");
      setDescription("");
      setSubmitted(false);
      window.setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, initialParentId]);

  // Árbol de opciones para el selector de categoría padre
  const parentOptions = useMemo(() => {
    const byParent = new Map<string | null, CategoryRow[]>();
    for (const c of categories) {
      if (!c.isActive || c.deletedAt) continue;
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const result: { value: string; label: string }[] = [
      { value: "", label: "Sin padre (categoría raíz)" },
    ];
    function traverse(pid: string | null, level: number) {
      for (const c of byParent.get(pid) ?? []) {
        result.push({ value: c.id, label: "— ".repeat(level) + c.name });
        traverse(c.id, level + 1);
      }
    }
    traverse(null, 0);
    return result;
  }, [categories]);

  async function handleSave() {
    setSubmitted(true);
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      setBusy(true);
      const created = await categoriesApi.create({
        name: trimmedName,
        parentId: parentId || null,
        description: description.trim(),
        sortOrder: 0,
        isActive: true,
      });
      toast.success(`Categoría "${trimmedName}" creada.`);
      onCreated(created.id, trimmedName);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al crear la categoría.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Nueva categoría"
      maxWidth="sm"
      busy={busy}
      onClose={() => !busy && onClose()}
      onEnter={handleSave}
      footer={
        <>
          <TPButton
            variant="secondary"
            onClick={onClose}
            disabled={busy}
            iconLeft={<X size={16} />}
          >
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={handleSave}
            loading={busy}
            iconLeft={<Save size={16} />}
          >
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
            error={submitted && !name.trim() ? "El nombre es obligatorio." : null}
          >
            <TPInput
              value={name}
              onChange={(v) => {
                setName(v);
                if (submitted && v.trim()) setSubmitted(false);
              }}
              placeholder="Ej: Anillos"
              disabled={busy}
              inputRef={nameRef}
            />
          </TPField>

          <TPField
            label="Categoría padre"
            hint="Dejá vacío para crear como categoría principal."
          >
            <TPComboFixed
              value={parentId}
              onChange={setParentId}
              disabled={busy}
              searchable
              searchPlaceholder="Buscar categoría…"
              options={parentOptions}
            />
          </TPField>

          <TPField label="Descripción">
            <TPTextarea
              value={description}
              onChange={setDescription}
              placeholder="Descripción opcional…"
              disabled={busy}
              minH={72}
            />
          </TPField>
        </div>
      </TPCard>
    </Modal>
  );
}

export default CreateCategoryModal;
