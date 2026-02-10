import React from "react";

import { cn, Section, formatBytes, safeFileLabel, absUrl } from "../../users.ui";
import type { UserAttachment } from "../../../../services/users";

import { TPCard, InputWithEye } from "../helpers/ui";

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

  // ✅ NUEVO: descargar adjunto guardado
  handleDownloadSavedAttachment: (att: UserAttachment) => void;

  // previews
  draftKey: (f: File) => string;
  draftPreviewByKey: Record<string, string>;
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

    // ✅ NUEVO
    handleDownloadSavedAttachment,

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

  async function onPickFiles(files: File[]) {
    if (!files.length) return;

    // ✅ CLAVE: evitar unhandled rejection (puede tumbar UI y “parecer” logout)
    try {
      await addAttachments(files);
    } catch (e) {
      console.error("Error subiendo adjuntos:", e);
      // Acá idealmente mostrar toast; por ahora no rompemos el modal/UI.
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Cuenta" desc="Email y contraseña inicial.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input
              className="tp-input"
              value={fEmail}
              onChange={(e) => setFEmail(e.target.value)}
              placeholder="usuario@correo.com"
              disabled={modalMode === "EDIT" || modalBusy}
              autoComplete="email"
            />
            {modalMode === "EDIT" && (
              <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p>
            )}
          </div>

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
          </div>
        </div>
      </Section>

      <Section title="Datos personales" desc="Nombre, documento y dirección.">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-12">
            <label className="mb-1 block text-xs text-muted">Nombre y apellido *</label>
            <input
              className="tp-input"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
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
            <label className="mb-1 block text-xs text-muted">Nro. doc.</label>
            <input
              className="tp-input"
              value={fDocNumber}
              onChange={(e) => setFDocNumber(e.target.value)}
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
            <label className="mb-1 block text-xs text-muted">Teléfono</label>
            <input
              className="tp-input"
              value={fPhoneNumber}
              onChange={(e) => setFPhoneNumber(e.target.value)}
              placeholder="11 1234 5678"
              disabled={modalBusy}
            />
          </div>

          <div className="md:col-span-12 mt-2">
            <TPCard className="p-4">
              <div className="text-sm font-semibold mb-3">Domicilio</div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="mb-1 block text-xs text-muted">Calle</label>
                  <input
                    className="tp-input"
                    value={fStreet}
                    onChange={(e) => setFStreet(e.target.value)}
                    disabled={modalBusy}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-muted">Número</label>
                  <input
                    className="tp-input"
                    value={fNumber}
                    onChange={(e) => setFNumber(e.target.value)}
                    disabled={modalBusy}
                  />
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
                  <label className="mb-1 block text-xs text-muted">Código postal</label>
                  <input
                    className="tp-input"
                    value={fPostalCode}
                    onChange={(e) => setFPostalCode(e.target.value)}
                    disabled={modalBusy}
                  />
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
            {/* input hidden */}
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

            {/* panel (mismo look tp-input) */}
            <div className="rounded-2xl border bg-surface p-3" style={{ borderColor: "var(--border)" }}>
              {/* dropzone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => !busyAttachments && attInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (busyAttachments) return;
                  if (e.key === "Enter" || e.key === " ") attInputRef.current?.click();
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
                  "transition",
                  dragOver && "!border-primary/60 bg-primary/10",
                  busyAttachments && "opacity-60 pointer-events-none"
                )}
                style={{
                  borderColor: dragOver
                    ? "color-mix(in oklab, var(--primary) 60%, var(--border))"
                    : "var(--border)",
                }}
              >
                <div className="text-sm text-text">
                  {uploadingAttachments ? "Subiendo archivos…" : "Click para agregar archivos +"}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {dragOver ? "Soltá para adjuntar" : "También podés arrastrar y soltar acá"}
                </div>

                {(hasDraft || hasSaved) && (
                  <div className="mt-3 text-[11px] text-muted">
                    {attachmentsDraft.length} pendiente(s) • {filteredSavedAttachments.length} guardado(s)
                  </div>
                )}
              </div>

              {/* nota create/edit */}
              {isCreate ? (
                <div className="mt-3 text-[11px] text-muted">
                  En <b>Crear</b>, los adjuntos se asocian al usuario cuando se confirma “Crear”.
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-muted">Podés agregar o eliminar adjuntos cuando quieras.</div>
              )}
            </div>

            {/* list */}
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
                            <div
                              key={key}
                              className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2"
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                                {showImg ? (
                                  <img
                                    src={preview}
                                    alt={safeFileLabel(f.name)}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full grid place-items-center text-[10px] text-muted">
                                    FILE
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-text">{safeFileLabel(f.name)}</div>
                                <div className="text-[11px] text-muted">{formatBytes(f.size)}</div>
                              </div>

                              <button
                                type="button"
                                className={cn("tp-btn-secondary !px-3 !py-1 text-xs")}
                                onClick={() => removeDraftAttachmentByIndex(idx)}
                                disabled={busyAttachments}
                              >
                                Quitar
                              </button>
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
                          const url = absUrl(a.url);
                          const busyRow = deletingAttId === a.id || busyAttachments;

                          return (
                            <div
                              key={a.id}
                              className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-sm text-primary underline"
                                  title={safeFileLabel(a.filename)}
                                >
                                  {safeFileLabel(a.filename)}
                                </a>
                                <div className="text-[11px] text-muted">
                                  {typeof a.size === "number" ? formatBytes(a.size) : ""}
                                </div>
                              </div>

                              {/* ✅ NUEVO: Descargar */}
                              <button
                                type="button"
                                className={cn("tp-btn-secondary !px-3 !py-1 text-xs")}
                                onClick={() => handleDownloadSavedAttachment(a)}
                                disabled={busyRow}
                                title="Descargar"
                              >
                                Descargar
                              </button>

                              <button
                                type="button"
                                className={cn("tp-btn-secondary !px-3 !py-1 text-xs")}
                                onClick={() => handleRemoveSavedAttachment(a.id)}
                                disabled={busyRow}
                              >
                                {deletingAttId === a.id ? "Quitando…" : "Eliminar"}
                              </button>
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
