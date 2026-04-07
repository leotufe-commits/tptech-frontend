// src/pages/article-detail/GroupPickerField.tsx
import React, { useState } from "react";
import { ExternalLink, Layers, Plus, Save, X } from "lucide-react";

import { Modal }           from "../../components/ui/Modal";
import { TPField }         from "../../components/ui/TPField";
import TPInput             from "../../components/ui/TPInput";
import { TPButton }        from "../../components/ui/TPButton";
import TPComboFixed        from "../../components/ui/TPComboFixed";
import { toast }           from "../../lib/toast";
import {
  articleGroupsApi,
  type ArticleGroupRow,
  type ArticleGroupPayload,
} from "../../services/article-groups";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ===========================================================================
// GroupPickerField — selector de grupo con chip, limpiar y crear inline
// ===========================================================================
interface GroupPickerFieldProps {
  value: string;                                       // groupId o ""
  onChange: (id: string) => void;
  groups: ArticleGroupRow[];
  onGroupCreated: (group: ArticleGroupRow) => void;   // para agregar al estado local
}

export default function GroupPickerField({
  value,
  onChange,
  groups,
  onGroupCreated,
}: GroupPickerFieldProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const selectedGroup = value ? (groups.find(g => g.id === value) ?? null) : null;

  const groupOptions = [
    { value: "", label: "Sin grupo" },
    ...groups
      .filter(g => g.isActive && !g.deletedAt)
      .map(g => ({ value: g.id, label: g.name })),
  ];

  return (
    <>
      <TPField
        label="Grupo comercial"
        hint="Permite presentar artículos juntos en web o catálogo (ej: mismo modelo en distintos tamaños o materiales). No afecta stock ni precio."
        labelRight={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-0.5 text-primary hover:underline leading-none"
          >
            <Plus size={11} />
            Nuevo
          </button>
        }
      >
        {selectedGroup ? (
          // ── Chip: grupo asignado ─────────────────────────────────────────
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 min-w-0">
              <Layers size={13} className="text-primary shrink-0" />
              <span className="flex-1 min-w-0 text-sm font-medium text-text truncate">
                {selectedGroup.name}
              </span>
              {selectedGroup.selectorLabel && (
                <span className="text-[11px] text-muted/80 shrink-0">
                  {selectedGroup.selectorLabel}
                </span>
              )}
              <a
                href="/configuracion-sistema/grupos-articulos"
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-primary transition-colors shrink-0"
                title="Ver grupo en configuración"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={12} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
              title="Quitar del grupo"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          // ── Selector: sin grupo ──────────────────────────────────────────
          <TPComboFixed
            value={value}
            onChange={onChange}
            options={groupOptions}
            searchable
          />
        )}
      </TPField>

      {/* ── Mini modal: crear grupo nuevo ──────────────────────────────────── */}
      {createOpen && (
        <CreateGroupModal
          onSave={(group) => {
            onGroupCreated(group);
            onChange(group.id);
            setCreateOpen(false);
          }}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

// ===========================================================================
// CreateGroupModal — formulario mínimo: nombre + selectorLabel
// ===========================================================================
interface CreateGroupModalProps {
  onSave: (group: ArticleGroupRow) => void;
  onClose: () => void;
}

function CreateGroupModal({ onSave, onClose }: CreateGroupModalProps) {
  const [name,          setName]          = useState("");
  const [selectorLabel, setSelectorLabel] = useState("");
  const [saving,        setSaving]        = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: ArticleGroupPayload = {
        name:          name.trim(),
        slug:          slugify(name.trim()),
        selectorLabel: selectorLabel.trim(),
      };
      const created = await articleGroupsApi.create(payload);
      toast.success("Grupo creado y asignado al artículo.");
      onSave(created);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el grupo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Nuevo grupo comercial" onClose={onClose} maxWidth="sm">
      <div className="space-y-4 p-1">
        <p className="text-xs text-muted">
          El grupo se creará y se asignará automáticamente a este artículo.
          Después podés editar el resto de los campos desde{" "}
          <a
            href="/configuracion-sistema/grupos-articulos"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Configuración → Grupos de artículos
          </a>.
        </p>

        <TPField label="Nombre *">
          <TPInput
            value={name}
            onChange={setName}
            placeholder="Ej: Anillos de compromiso"
            autoFocus
          />
        </TPField>

        <TPField
          label="Etiqueta del selector"
          hint='Cómo se llama la dimensión que diferencia a cada artículo dentro del grupo. Ej: "Ancho", "Talle", "Material".'
        >
          <TPInput
            value={selectorLabel}
            onChange={setSelectorLabel}
            placeholder="Ej: Ancho"
          />
        </TPField>

        <div className="flex justify-end gap-2 pt-1">
          <TPButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={handleSave}
            loading={saving}
            iconLeft={<Save size={14} />}
          >
            Crear y asignar
          </TPButton>
        </div>
      </div>
    </Modal>
  );
}
