// src/pages/article-detail/GroupPickerField.tsx
import React, { useState } from "react";
import { ExternalLink, Layers, Plus, X } from "lucide-react";
import TPTableImage from "../../components/ui/TPTableImage";

import { TPField }         from "../../components/ui/TPField";
import { TPButton }        from "../../components/ui/TPButton";
import TPComboFixed        from "../../components/ui/TPComboFixed";
import { ArticleGroupCreateModal } from "../../components/ui/ArticleGroupCreateModal";
import {
  type ArticleGroupRow,
} from "../../services/article-groups";

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
    { value: "", label: "Sin grupo", imageUrl: "" },
    ...groups
      .filter(g => g.isActive && !g.deletedAt)
      .map(g => {
        const parts: string[] = [];
        if (g.selectorLabel) parts.push(g.selectorLabel);
        if (g._count.items > 0) parts.push(`${g._count.items} ítem${g._count.items !== 1 ? "s" : ""}`);
        return {
          value:    g.id,
          label:    g.name,
          imageUrl: g.mainImageUrl,
          sublabel: parts.length > 0 ? parts.join(" · ") : undefined,
        };
      }),
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
              {selectedGroup.mainImageUrl ? (
                <TPTableImage
                  src={selectedGroup.mainImageUrl}
                  sizeClass="w-7 h-7"
                  alt={selectedGroup.name}
                  className="shrink-0"
                />
              ) : (
                <Layers size={13} className="text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{selectedGroup.name}</div>
                {selectedGroup.selectorLabel && (
                  <div className="text-[10px] text-muted/70">{selectedGroup.selectorLabel}</div>
                )}
              </div>
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

      {/* ── Modal real de creación de Grupo de Artículos ─────────────────── */}
      {createOpen && (
        <ArticleGroupCreateModal
          onCreated={(group) => {
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
