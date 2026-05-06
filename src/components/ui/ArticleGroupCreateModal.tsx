// src/components/ui/ArticleGroupCreateModal.tsx
// Modal reutilizable para crear un Grupo de Artículos.
// Usado desde ConfiguracionSistemaGruposArticulos y desde GroupPickerField (modal de artículos).
import React, { useRef, useState } from "react";
import { Camera, Check, ImageIcon, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Modal }       from "./Modal";
import { TPButton }    from "./TPButton";
import { TPField }     from "./TPField";
import TPInput         from "./TPInput";
import TPTextarea      from "./TPTextarea";
import { cn }          from "./tp";
import { toast }       from "../../lib/toast";
import {
  articleGroupsApi,
  type ArticleGroupRow,
  type ArticleGroupPayload,
} from "../../services/article-groups";

interface Props {
  /** Llamado tras crear exitosamente. Recibe el grupo recién creado. */
  onCreated: (group: ArticleGroupRow) => void;
  onClose:   () => void;
}

const EMPTY = { name: "", description: "", selectorLabel: "" };

export function ArticleGroupCreateModal({ onCreated, onClose }: Props) {
  const [draft, setDraft]               = useState(EMPTY);
  const [pending, setPending]           = useState<{ file: File; url: string }[]>([]);
  const [saving,  setSaving]            = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  function set(key: keyof typeof EMPTY, value: string) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function handleClose() {
    pending.forEach(p => URL.revokeObjectURL(p.url));
    onClose();
  }

  // ── Imagen principal ────────────────────────────────────────────────────────
  function uploadMain(file: File) {
    const url = URL.createObjectURL(file);
    setPending(prev => {
      if (prev[0]) URL.revokeObjectURL(prev[0].url);
      return [{ file, url }, ...prev.slice(1)];
    });
  }

  function deleteMain() {
    setPending(prev => {
      if (prev[0]) URL.revokeObjectURL(prev[0].url);
      return prev.slice(1);
    });
  }

  // ── Galería ─────────────────────────────────────────────────────────────────
  function addImage(file: File) {
    if (pending.length >= 5) { toast.error("Máximo 5 imágenes."); return; }
    const url = URL.createObjectURL(file);
    setPending(prev => [...prev, { file, url }]);
  }

  function setMain(idx: number) {
    setPending(prev => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      return [item, ...next];
    });
  }

  function removeImage(idx: number) {
    setPending(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft.name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: ArticleGroupPayload = {
        name:          draft.name.trim(),
        description:   draft.description,
        selectorLabel: draft.selectorLabel.trim(),
        isActive:      true,
      };
      const created = await articleGroupsApi.create(payload);
      for (const p of pending) {
        try { await articleGroupsApi.uploadImage(created.id, p.file); } catch { /* no bloquea */ }
      }
      toast.success("Grupo creado.");
      pending.forEach(p => URL.revokeObjectURL(p.url));
      onCreated(created);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el grupo.");
    } finally {
      setSaving(false);
    }
  }

  const mainSrc = pending[0]?.url ?? null;

  return (
    <Modal open title="Nuevo grupo" onClose={handleClose} maxWidth="3xl" busy={saving} bodyClassName="min-h-[480px]">
      <div className="space-y-4 p-1">

        {/* Imagen principal + galería */}
        <div className="rounded-xl border border-border bg-surface2/30 p-4 flex flex-col items-center gap-3">
          {/* Imagen principal 144×144 */}
          <div className="relative group w-36 h-36 rounded-xl overflow-hidden border border-border bg-surface2 shrink-0">
            {mainSrc ? (
              <>
                <img src={mainSrc} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium cursor-pointer transition-colors">
                    <Camera size={13} /> Cambiar
                    <input type="file" accept="image/*" hidden
                      onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) uploadMain(f); }}
                    />
                  </label>
                  <button type="button" onClick={deleteMain}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-red-500/60 text-white text-xs font-medium transition-colors">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              </>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted hover:text-primary cursor-pointer transition-colors">
                <ImageIcon size={26} className="opacity-40" />
                <span className="text-xs">Subir imagen</span>
                <input type="file" accept="image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) uploadMain(f); }}
                />
              </label>
            )}
          </div>

          {/* Tira de miniaturas */}
          <div className="flex gap-1 flex-wrap justify-center">
            {pending.map((p, idx) => (
              <div key={idx} onClick={() => { if (idx !== 0) setMain(idx); }}
                className={cn(
                  "relative group/t w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                  idx === 0 ? "border-primary cursor-default" : "border-border hover:border-primary/60 cursor-pointer"
                )}>
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                {idx === 0 && (
                  <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3.5 h-3.5 flex items-center justify-center">
                    <Check size={8} className="text-white" strokeWidth={3} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/t:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                  {idx !== 0 && (
                    <button type="button" title="Hacer principal"
                      onClick={(e) => { e.stopPropagation(); setMain(idx); }}
                      className="p-1 rounded text-white hover:text-primary transition-colors">
                      <Check size={11} />
                    </button>
                  )}
                  <button type="button" title="Eliminar"
                    onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                    className="p-1 rounded text-white hover:text-red-400 transition-colors">
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
            {pending.length < 5 && (
              <button type="button" title="Agregar imagen"
                onClick={() => addRef.current?.click()}
                className="w-11 h-11 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary transition-all shrink-0">
                <Plus size={15} strokeWidth={2.5} />
              </button>
            )}
            <input ref={addRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) addImage(f); }}
            />
          </div>
          <span className="text-[10px] text-muted">{pending.length}/5 · PNG, JPG, WebP</span>
        </div>

        <TPField label="Nombre *">
          <TPInput value={draft.name} onChange={(v) => set("name", v)} placeholder="Ej: Anillos de compromiso" autoFocus />
        </TPField>

        <TPField label="Diferencia principal" hint="Define qué cambia entre los artículos. Ej: Medida, Color, Talle, Largo.">
          <TPInput value={draft.selectorLabel} onChange={(v) => set("selectorLabel", v)} placeholder="Ej: Medida" />
        </TPField>

        <TPField label="Descripción" hint="Visible en el detalle del grupo.">
          <TPTextarea value={draft.description} onChange={(v) => set("description", v)} placeholder="Descripción breve del grupo" rows={3} />
        </TPField>

        <div className="flex justify-end gap-2 pt-1">
          <TPButton variant="secondary" iconLeft={<X size={16} />} onClick={handleClose} disabled={saving}>
            Cancelar
          </TPButton>
          <TPButton variant="primary" onClick={handleSave} loading={saving} iconLeft={<Save size={14} />}>
            Crear grupo
          </TPButton>
        </div>
      </div>
    </Modal>
  );
}
