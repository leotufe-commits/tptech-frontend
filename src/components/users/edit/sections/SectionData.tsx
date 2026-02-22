// tptech-frontend/src/components/users/edit/sections/SectionData.tsx
import React from "react";
import { Download, Eye, Loader2, Trash2 } from "lucide-react";

import { cn, Section, formatBytes, safeFileLabel, absUrl } from "../../users.ui";
import type { UserAttachment } from "../../../../services/users";

import { TPCard, InputWithEye } from "../helpers/ui";

// ✅ UI system
import TPInput from "../../../ui/TPInput";
import { TPIconButton } from "../../../ui/TPIconButton";

// combo + hook
import TPComboCreatable from "../../../ui/TPComboCreatable";
import { useCatalog } from "../../../../hooks/useCatalog";
import type { CatalogType } from "../../../../services/catalogs";

type Props = {
  modalMode: "CREATE" | "EDIT";
  modalBusy: boolean;

  // fields
  fEmail: string;
  setFEmail: (v: string) => void;

  fPassword: string;
  setFPassword: (v: string) => void;

  showPassword: boolean;
  setShowPassword: (v: boolean) => void;

  fName: string;
  setFName: (v: string) => void;

  fDocType: string;
  setFDocType: (v: string) => void;
  fDocNumber: string;
  setFDocNumber: (v: string) => void;

  fPhoneCountry: string;
  setFPhoneCountry: (v: string) => void;
  fPhoneNumber: string;
  setFPhoneNumber: (v: string) => void;

  fStreet: string;
  setFStreet: (v: string) => void;
  fNumber: string;
  setFNumber: (v: string) => void;
  fCity: string;
  setFCity: (v: string) => void;
  fProvince: string;
  setFProvince: (v: string) => void;
  fPostalCode: string;
  setFPostalCode: (v: string) => void;
  fCountry: string;
  setFCountry: (v: string) => void;

  fNotes: string;
  setFNotes: (v: string) => void;

  // attachments
  attInputRef: React.RefObject<HTMLInputElement>;
  uploadingAttachments: boolean;
  deletingAttId: string | null;

  attachmentsDraft: File[];
  removeDraftAttachmentByIndex: (idx: number) => void;
  addAttachments: (files: File[]) => Promise<void>;

  filteredSavedAttachments: UserAttachment[];
  handleRemoveSavedAttachment: (id: string) => Promise<void>;

  // ✅ descargar adjunto guardado (con auth)
  handleDownloadSavedAttachment: (att: UserAttachment) => void;

  // ✅ ver adjunto guardado (con auth) - opcional (fallback a window.open)
  handleOpenSavedAttachment?: (att: UserAttachment) => void;

  // previews
  draftKey: (f: File) => string;
  draftPreviewByKey: Record<string, string>;

  // (no usados acá, pero deben existir)
  initialsFrom: (s: string) => string;
  avatarInitialsBase: string;
};

function asCatalogType(t: CatalogType): CatalogType {
  return t;
}

function isLikelyImage(nameOrMime: string) {
  const s = String(nameOrMime || "").toLowerCase();
  return (
    s.startsWith("image/") ||
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

export default function SectionData(props: Props) {
  const {
    modalMode,
    modalBusy,

    fEmail,
    setFEmail,
    fPassword,
    setFPassword,
    showPassword,
    setShowPassword,

    fName,
    setFName,

    fDocType,
    setFDocType,
    fDocNumber,
    setFDocNumber,

    fPhoneCountry,
    setFPhoneCountry,
    fPhoneNumber,
    setFPhoneNumber,

    fStreet,
    setFStreet,
    fNumber,
    setFNumber,
    fCity,
    setFCity,
    fProvince,
    setFProvince,
    fPostalCode,
    setFPostalCode,
    fCountry,
    setFCountry,

    fNotes,
    setFNotes,

    attInputRef,
    uploadingAttachments,
    deletingAttId,
    attachmentsDraft,
    removeDraftAttachmentByIndex,
    addAttachments,

    filteredSavedAttachments,
    handleRemoveSavedAttachment,

    handleDownloadSavedAttachment,
    handleOpenSavedAttachment,

    draftKey,
    draftPreviewByKey,
  } = props;

  const isCreate = modalMode === "CREATE";
  const busyAttachments = modalBusy || uploadingAttachments || Boolean(deletingAttId);

  const hasDraft = attachmentsDraft.length > 0;
  const hasSaved = filteredSavedAttachments.length > 0;

  // catálogos
  const docTypeCat = useCatalog(asCatalogType("DOCUMENT_TYPE"));
  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

  // dropzone state
  const [dragOver, setDragOver] = React.useState(false);

  // ✅ reemplazo de draft
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const [replaceIdx, setReplaceIdx] = React.useState<number | null>(null);

  function openFilePicker() {
    if (busyAttachments) return;
    requestAnimationFrame(() => {
      try {
        attInputRef.current?.click();
      } catch {}
    });
  }

  function openReplacePicker(idx: number) {
    if (busyAttachments) return;
    setReplaceIdx(idx);
    requestAnimationFrame(() => {
      try {
        replaceInputRef.current?.click();
      } catch {}
    });
  }

  async function onPickFiles(files: File[]) {
    if (!files.length) return;
    await addAttachments(files);
  }

  function onViewDraftFile(f: File) {
    try {
      const key = draftKey(f);
      const preview = draftPreviewByKey[key];
      const isImg = Boolean(preview) && isLikelyImage(f.type || f.name);

      const url = isImg && preview ? preview : URL.createObjectURL(f);

      window.open(url, "_blank", "noopener,noreferrer");

      if (!(isImg && preview)) {
        window.setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        }, 60_000);
      }
    } catch {}
  }

  React.useEffect(() => {
    if (!dragOver) return;

    function prevent(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
    }

    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);

    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, [dragOver]);

  function onViewSaved(att: UserAttachment) {
    if (handleOpenSavedAttachment) {
      handleOpenSavedAttachment(att);
      return;
    }
    const url = absUrl((att as any)?.url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <Section title="Cuenta" desc="Email y contraseña inicial.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TPInput
            label="Email"
            value={fEmail}
            onChange={setFEmail}
            placeholder="usuario@correo.com"
            disabled={modalMode === "EDIT" || modalBusy}
            autoComplete="email"
          />
          <div>
            <label className="mb-1 block text-xs text-muted">
              {isCreate ? "Contraseña (opcional)" : "Nueva contraseña (opcional)"}
            </label>

            <InputWithEye
              value={fPassword}
              onChange={setFPassword}
              placeholder={isCreate ? "Si la dejás vacía, queda Inactivo" : "Dejar vacía para no cambiar"}
              disabled={modalBusy}
              show={showPassword}
              setShow={setShowPassword}
              autoComplete="new-password"
            />

            {isCreate ? (
              <p className="mt-1 text-[11px] text-muted">
                Si la contraseña está vacía, el usuario queda <b>Inactivo</b>.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted">(Solo se cambia si escribís una nueva)</p>
            )}
            {modalMode === "EDIT" && <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p>}
          </div>
        </div>
      </Section>

      <Section title="Datos personales" desc="Nombre, documento y dirección.">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-12">
            <TPInput
              label="Nombre y apellido *"
              value={fName}
              onChange={setFName}
              placeholder="Nombre Apellido"
              disabled={modalBusy}
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-muted">Tipo doc.</label>
            <TPComboCreatable
              mode={isCreate ? "create" : "edit"}
              type="DOCUMENT_TYPE"
              items={docTypeCat.items}
              loading={docTypeCat.loading}
              value={fDocType}
              onChange={setFDocType}
              placeholder="DNI / PAS / CUIT"
              disabled={modalBusy}
              allowCreate
              onRefresh={() => void docTypeCat.refresh()}
              onCreate={async (label) => {
                await docTypeCat.createItem(label);
                setFDocType(label);
              }}
            />
          </div>

          <div className="md:col-span-3">
            <TPInput
              label="Nro. doc."
              value={fDocNumber}
              onChange={setFDocNumber}
              placeholder="12345678"
              disabled={modalBusy}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted">Tel. país</label>
            <TPComboCreatable
              mode={isCreate ? "create" : "edit"}
              type="PHONE_PREFIX"
              items={prefixCat.items}
              loading={prefixCat.loading}
              value={fPhoneCountry}
              onChange={setFPhoneCountry}
              placeholder="+54"
              disabled={modalBusy}
              allowCreate
              onRefresh={() => void prefixCat.refresh()}
              onCreate={async (label) => {
                await prefixCat.createItem(label);
                setFPhoneCountry(label);
              }}
            />
          </div>

          <div className="md:col-span-4">
            <TPInput
              label="Teléfono"
              value={fPhoneNumber}
              onChange={setFPhoneNumber}
              placeholder="11 1234 5678"
              disabled={modalBusy}
            />
          </div>

          <div className="md:col-span-12 mt-2">
            <TPCard className="p-4">
              <div className="text-sm font-semibold mb-3">Domicilio</div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <TPInput label="Calle" value={fStreet} onChange={setFStreet} disabled={modalBusy} />
                </div>

                <div className="md:col-span-2">
                  <TPInput label="Número" value={fNumber} onChange={setFNumber} disabled={modalBusy} />
                </div>

                <div className="md:col-span-5">
                  <label className="mb-1 block text-xs text-muted">Ciudad</label>
                  <TPComboCreatable
                    mode={isCreate ? "create" : "edit"}
                    type="CITY"
                    items={cityCat.items}
                    loading={cityCat.loading}
                    value={fCity}
                    onChange={setFCity}
                    placeholder="Ciudad"
                    disabled={modalBusy}
                    allowCreate
                    onRefresh={() => void cityCat.refresh()}
                    onCreate={async (label) => {
                      await cityCat.createItem(label);
                      setFCity(label);
                    }}
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-muted">Provincia</label>
                  <TPComboCreatable
                    mode={isCreate ? "create" : "edit"}
                    type="PROVINCE"
                    items={provCat.items}
                    loading={provCat.loading}
                    value={fProvince}
                    onChange={setFProvince}
                    placeholder="Provincia"
                    disabled={modalBusy}
                    allowCreate
                    onRefresh={() => void provCat.refresh()}
                    onCreate={async (label) => {
                      await provCat.createItem(label);
                      setFProvince(label);
                    }}
                  />
                </div>

                <div className="md:col-span-4">
                  <TPInput label="Código postal" value={fPostalCode} onChange={setFPostalCode} disabled={modalBusy} />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-muted">País</label>
                  <TPComboCreatable
                    mode={isCreate ? "create" : "edit"}
                    type="COUNTRY"
                    items={countryCat.items}
                    loading={countryCat.loading}
                    value={fCountry}
                    onChange={setFCountry}
                    placeholder="País"
                    disabled={modalBusy}
                    allowCreate
                    onRefresh={() => void countryCat.refresh()}
                    onCreate={async (label) => {
                      await countryCat.createItem(label);
                      setFCountry(label);
                    }}
                  />
                </div>
              </div>
            </TPCard>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Notas" desc="Notas internas.">
          {/* ✅ ideal: crear TPTextarea. Por ahora dejamos igual */}
          <textarea
            className="tp-input min-h-[180px]"
            value={fNotes}
            onChange={(e) => setFNotes(e.target.value)}
            placeholder="Notas internas…"
            disabled={modalBusy}
          />
        </Section>

        <Section title="Adjuntos" desc="Archivos del usuario (PDF, imágenes, etc.).">
          <div className="space-y-3">
            <input
              ref={attInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.currentTarget.value = "";
                try {
                  await onPickFiles(files);
                } catch (err) {
                  console.error("Error onChange attachments:", err);
                }
              }}
              disabled={busyAttachments}
            />

            <input
              ref={replaceInputRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const f = (e.target.files && e.target.files[0]) || null;
                e.currentTarget.value = "";
                const idx = replaceIdx;
                setReplaceIdx(null);

                if (!f) return;
                if (idx === null || idx < 0) return;

                try {
                  removeDraftAttachmentByIndex(idx);
                  await onPickFiles([f]);
                } catch (err) {
                  console.error("Error replacing draft attachment:", err);
                }
              }}
              disabled={busyAttachments}
            />

            <div className="rounded-2xl border bg-surface p-3" style={{ borderColor: "var(--border)" }}>
              <div
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(e) => {
                  if (busyAttachments) return;
                  if (e.key === "Enter" || e.key === " ") openFilePicker();
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (busyAttachments) return;
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (busyAttachments) return;
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  if (busyAttachments) return;
                  const files = Array.from(e.dataTransfer.files || []);
                  try {
                    await onPickFiles(files);
                  } catch (err) {
                    console.error("Error onDrop attachments:", err);
                  }
                }}
                className={cn(
                  "w-full rounded-2xl border border-dashed border-border/60 bg-surface",
                  "min-h-[180px] flex flex-col items-center justify-center text-center px-6 py-6",
                  "transition select-none cursor-pointer",
                  dragOver && "!border-primary/60 bg-primary/10",
                  busyAttachments && "opacity-60 pointer-events-none cursor-default"
                )}
                style={{
                  borderColor: dragOver
                    ? "color-mix(in oklab, var(--primary) 60%, var(--border))"
                    : "var(--border)",
                }}
              >
                <div className="text-sm text-text">{uploadingAttachments ? "Subiendo archivos…" : "Click para agregar archivos +"}</div>
                <div className="mt-1 text-[11px] text-muted">{dragOver ? "Soltá para adjuntar" : "También podés arrastrar y soltar acá"}</div>

                {(hasDraft || hasSaved) && (
                  <div className="mt-3 text-[11px] text-muted">
                    {attachmentsDraft.length} pendiente(s) • {filteredSavedAttachments.length} guardado(s)
                  </div>
                )}
              </div>

              {isCreate ? (
                <div className="mt-3 text-[11px] text-muted">
                  En <b>Crear</b>, los adjuntos se asocian al usuario cuando se confirma “Crear”.
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-muted">Podés agregar o eliminar adjuntos cuando quieras.</div>
              )}
            </div>

            {(hasDraft || hasSaved) && (
              <TPCard className="p-3">
                <div className="space-y-3">
                  {hasDraft && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-text">Pendientes</div>

                      <div className="space-y-2">
                        {attachmentsDraft.map((f, idx) => {
                          const key = draftKey(f);
                          const preview = draftPreviewByKey[key];
                          const showImg = Boolean(preview) && isLikelyImage(f.type || f.name);

                          return (
                            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-3 py-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                                  {showImg ? (
                                    <img src={preview} alt={safeFileLabel(f.name)} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full grid place-items-center text-[10px] text-muted">FILE</div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm text-text">{safeFileLabel(f.name)}</div>
                                  <div className="text-[11px] text-muted">{formatBytes(f.size)}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <TPIconButton title="Ver" disabled={busyAttachments} onClick={() => onViewDraftFile(f)}>
                                  <Eye className="h-4 w-4" />
                                </TPIconButton>

                                <TPIconButton title="Reemplazar" disabled={busyAttachments} onClick={() => openReplacePicker(idx)}>
                                  <Download className="h-4 w-4" />
                                </TPIconButton>

                                <TPIconButton title="Eliminar" disabled={busyAttachments} onClick={() => removeDraftAttachmentByIndex(idx)}>
                                  <Trash2 className="h-4 w-4" />
                                </TPIconButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasSaved && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-text">Guardados</div>

                      <div className="space-y-2">
                        {filteredSavedAttachments.map((a) => {
                          const filename = safeFileLabel(a.filename);
                          const busyRow = deletingAttId === a.id || busyAttachments;

                          return (
                            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-text" title={filename}>
                                  {filename}
                                </div>
                                <div className="text-[11px] text-muted">{typeof a.size === "number" ? formatBytes(a.size) : ""}</div>
                              </div>

                              <div className="flex items-center gap-2">
                                <TPIconButton title="Ver" disabled={busyRow} onClick={() => onViewSaved(a)}>
                                  <Eye className="h-4 w-4" />
                                </TPIconButton>

                                <TPIconButton title="Descargar" disabled={busyRow} onClick={() => handleDownloadSavedAttachment(a)}>
                                  <Download className="h-4 w-4" />
                                </TPIconButton>

                                <TPIconButton
                                  title={deletingAttId === a.id ? "Quitando…" : "Eliminar"}
                                  disabled={busyRow}
                                  onClick={() => handleRemoveSavedAttachment(a.id)}
                                >
                                  {deletingAttId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </TPIconButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </TPCard>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}