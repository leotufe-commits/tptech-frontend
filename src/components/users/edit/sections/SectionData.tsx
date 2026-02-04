import React from "react";

import { cn, Section, formatBytes, safeFileLabel, absUrl } from "../../users.ui";
import type { UserAttachment } from "../../../../services/users";

import { TPCard, InputWithEye } from "../helpers/ui";

// ✅ nuevo: combo + hook
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

  // previews
  draftKey: (f: File) => string;
  draftPreviewByKey: Record<string, string>;
};

function asCatalogType(t: CatalogType): CatalogType {
  return t;
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

    draftKey,
    draftPreviewByKey,
  } = props;

  const busyAttachments = modalBusy || uploadingAttachments || Boolean(deletingAttId);

  // ✅ Catálogos (combos globales por joyería/tenant)
  // ⚠️ DOCUMENT_TYPE requiere backend/prisma (ver abajo). Igual dejamos el combo listo.
  const docTypeCat = useCatalog(asCatalogType("DOCUMENT_TYPE"));
  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

  return (
    <div className="space-y-4">
      <Section title="Cuenta" desc="Email y contraseña inicial.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input
              className="tp-input"
              value={fEmail}
              onChange={(e) => setFEmail(e.target.value)}
              placeholder="usuario@correo.com"
              disabled={modalMode === "EDIT" || modalBusy}
              autoComplete="email"
            />
            {modalMode === "EDIT" ? <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p> : null}
          </div>

          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-muted">
              {modalMode === "CREATE" ? "Contraseña (opcional)" : "Nueva contraseña (opcional)"}
            </label>

            <InputWithEye
              value={fPassword}
              onChange={setFPassword}
              placeholder={modalMode === "CREATE" ? "Si la dejás vacía, queda Inactivo" : "Dejar vacía para no cambiar"}
              disabled={modalBusy}
              show={showPassword}
              setShow={setShowPassword}
              autoComplete="new-password"
            />

            {modalMode === "CREATE" ? (
              <p className="mt-1 text-[11px] text-muted">
                Si la contraseña está vacía, el usuario queda <b>Inactivo</b> (PENDING en backend).
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted">(Solo se cambia si escribís una nueva)</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Datos personales" desc="Nombre, documento y dirección (como Empresa).">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-12">
            <label className="mb-1 block text-xs text-muted">Nombre y apellido *</label>
            <input className="tp-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nombre Apellido" disabled={modalBusy} />
          </div>

          {/* ✅ Tipo doc: combo global (requiere DOCUMENT_TYPE en backend/prisma) */}
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-muted">Tipo doc.</label>
            <TPComboCreatable
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
            {/* opcional: mostrar error si no existe el catálogo en backend */}
            {docTypeCat.error ? <div className="mt-1 text-[11px] text-red-600">{docTypeCat.error}</div> : null}
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-muted">Nro. doc.</label>
            <input className="tp-input" value={fDocNumber} onChange={(e) => setFDocNumber(e.target.value)} placeholder="12345678" disabled={modalBusy} />
          </div>

          {/* ✅ Prefijo país: combo global */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted">Tel. país</label>
            <TPComboCreatable
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
            {prefixCat.error ? <div className="mt-1 text-[11px] text-red-600">{prefixCat.error}</div> : null}
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs text-muted">Teléfono</label>
            <input className="tp-input" value={fPhoneNumber} onChange={(e) => setFPhoneNumber(e.target.value)} placeholder="11 1234 5678" disabled={modalBusy} />
          </div>

          <div className="md:col-span-12 mt-2">
            <TPCard className="p-4">
              <div className="text-sm font-semibold mb-3">Domicilio</div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="mb-1 block text-xs text-muted">Calle</label>
                  <input className="tp-input" value={fStreet} onChange={(e) => setFStreet(e.target.value)} placeholder="Calle" disabled={modalBusy} />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-muted">Número</label>
                  <input className="tp-input" value={fNumber} onChange={(e) => setFNumber(e.target.value)} placeholder="123" disabled={modalBusy} />
                </div>

                {/* ✅ Ciudad: combo global */}
                <div className="md:col-span-5">
                  <label className="mb-1 block text-xs text-muted">Ciudad</label>
                  <TPComboCreatable
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
                  {cityCat.error ? <div className="mt-1 text-[11px] text-red-600">{cityCat.error}</div> : null}
                </div>

                {/* ✅ Provincia: combo global */}
                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-muted">Provincia</label>
                  <TPComboCreatable
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
                  {provCat.error ? <div className="mt-1 text-[11px] text-red-600">{provCat.error}</div> : null}
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-muted">Código postal</label>
                  <input className="tp-input" value={fPostalCode} onChange={(e) => setFPostalCode(e.target.value)} placeholder="1012" disabled={modalBusy} />
                </div>

                {/* ✅ País: combo global */}
                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-muted">País</label>
                  <TPComboCreatable
                    type="COUNTRY"
                    items={countryCat.items}
                    loading={countryCat.loading}
                    value={fCountry}
                    onChange={setFCountry}
                    placeholder="Argentina"
                    disabled={modalBusy}
                    allowCreate
                    onRefresh={() => void countryCat.refresh()}
                    onCreate={async (label) => {
                      await countryCat.createItem(label);
                      setFCountry(label);
                    }}
                  />
                  {countryCat.error ? <div className="mt-1 text-[11px] text-red-600">{countryCat.error}</div> : null}
                </div>
              </div>
            </TPCard>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Notas" desc="Notas internas.">
          <textarea className="tp-input min-h-[180px]" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Notas internas…" disabled={modalBusy} />
        </Section>

        <Section title="Adjuntos" desc="Archivos del usuario (PDF, imágenes, etc.).">
          <div className="space-y-3">
            <button
              type="button"
              className={cn("block w-full cursor-pointer", busyAttachments && "opacity-60")}
              onClick={() => {
                if (busyAttachments) return;
                attInputRef.current?.click();
              }}
              disabled={busyAttachments}
            >
              <div
                className="min-h-[180px] flex items-center justify-center border border-dashed rounded-2xl"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
                  color: "var(--muted)",
                }}
              >
                {uploadingAttachments ? "Subiendo…" : "Click para agregar archivos +"}
              </div>
            </button>

            <input
              ref={attInputRef}
              type="file"
              multiple
              hidden
              disabled={busyAttachments}
              onChange={(e) => {
                const picked = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                if (!picked.length) return;
                if (busyAttachments) return;
                void addAttachments(picked);
              }}
            />

            {attachmentsDraft.length > 0 && (
              <div>
                <div className="text-xs text-[color:var(--muted)] mb-2">Seleccionados</div>
                <div className="space-y-2">
                  {attachmentsDraft.map((f, idx) => {
                    const isImg = String((f as any)?.type || "").startsWith("image/");
                    const k = draftKey(f);
                    const previewUrl = isImg ? draftPreviewByKey[k] : "";

                    return (
                      <div
                        key={k}
                        className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                        style={{
                          border: "1px solid var(--border)",
                          background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isImg && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={safeFileLabel(f.name)}
                              className="h-10 w-10 rounded-lg object-cover border"
                              style={{ borderColor: "var(--border)" }}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--muted)",
                                background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                              }}
                            >
                              DOC
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-sm text-text truncate">{safeFileLabel(f.name)}</div>
                            <div className="text-xs text-muted">{formatBytes(f.size)}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={cn(
                            "h-8 w-8 rounded-full grid place-items-center",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            (modalBusy || uploadingAttachments) && "opacity-60"
                          )}
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                          title="Quitar del borrador"
                          aria-label="Quitar del borrador"
                          disabled={modalBusy || uploadingAttachments}
                          onClick={() => removeDraftAttachmentByIndex(idx)}
                        >
                          <span className="text-xs">✕</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {modalMode === "EDIT" && filteredSavedAttachments.length > 0 && (
              <div>
                <div className="text-xs text-[color:var(--muted)] mb-2">Guardados</div>
                <div className="space-y-2">
                  {filteredSavedAttachments.map((a: any) => {
                    const busy = deletingAttId === a.id;
                    const url = absUrl(a.url || "");
                    const isImg = String(a.mimeType || "").startsWith("image/");

                    return (
                      <div
                        key={a.id}
                        className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                        style={{
                          border: "1px solid var(--border)",
                          background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isImg && url ? (
                            <img
                              src={url}
                              alt={safeFileLabel(a.filename)}
                              className="h-10 w-10 rounded-lg object-cover border"
                              style={{ borderColor: "var(--border)" }}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--muted)",
                                background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                              }}
                            >
                              DOC
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-sm text-text truncate">{safeFileLabel(a.filename)}</div>
                            <div className="text-xs text-muted flex gap-2">
                              <span className="truncate">{formatBytes(a.size)}</span>
                              {url && (
                                <a className="underline underline-offset-2" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                  Abrir
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={cn("h-8 w-8 rounded-full grid place-items-center", "opacity-0 group-hover:opacity-100 transition-opacity", busy && "opacity-60")}
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                          title="Eliminar adjunto"
                          aria-label="Eliminar adjunto"
                          disabled={busy}
                          onClick={() => void handleRemoveSavedAttachment(String(a.id))}
                        >
                          <span className="text-xs">{busy ? "…" : "✕"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {attachmentsDraft.length === 0 &&
            (modalMode !== "EDIT" || filteredSavedAttachments.length === 0) &&
            !uploadingAttachments ? (
              <div className="text-xs text-muted">Todavía no hay adjuntos.</div>
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
