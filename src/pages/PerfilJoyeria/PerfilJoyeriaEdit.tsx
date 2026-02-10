import React from "react";
import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { Field } from "./perfilJoyeria.ui";
import { absUrl, cn, formatBytes, onlyDigits, safeFileLabel } from "./perfilJoyeria.utils";

import type { CatalogItem, CatalogType } from "../../services/catalogs";
import type { ExistingBody, CompanyBody, JewelryAttachment } from "./perfilJoyeria.types";

type Props = {
  existing: ExistingBody;
  company: CompanyBody;
  readonly: boolean;

  allowCreate: boolean;

  // setters
  setExistingField: <K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) => void;
  setCompanyField: <K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) => void;

  // catalogs
  catIva: CatalogItem[];
  catPrefix: CatalogItem[];
  catCity: CatalogItem[];
  catProvince: CatalogItem[];
  catCountry: CatalogItem[];
  catLoading: Record<string, boolean>;
  ensureCatalog: (type: CatalogType, force?: boolean) => Promise<void>;
  createAndRefresh: (type: CatalogType, label: string) => Promise<void>;

  // attachments
  attInputRef: React.RefObject<HTMLInputElement>;
  uploadingAttachments: boolean;
  deletingAttId: string | null;
  uploadAttachmentsInstant: (files: File[]) => Promise<void>;
  deleteSavedAttachment: (id: string) => Promise<void>;
  savedAttachments: JewelryAttachment[];
};

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

/**
 * Textos de ayuda "más claritos":
 * - Mantiene look suave en claro/oscuro sin depender de clases Tailwind específicas.
 */
function HelpText(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("text-[11px] leading-snug", props.className)}
      style={{
        color: "color-mix(in oklab, var(--muted) 70%, var(--text))",
      }}
    >
      {props.children}
    </div>
  );
}

export default function PerfilJoyeriaEdit(p: Props) {
  const busyAttachments = p.readonly || p.uploadingAttachments || Boolean(p.deletingAttId);
  const hasSaved = (p.savedAttachments || []).length > 0;

  const [dragOver, setDragOver] = React.useState(false);

  async function onPickFiles(files: File[]) {
    const list = Array.from(files || []);
    if (!list.length) return;
    await p.uploadAttachmentsInstant(list);
  }

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* COLUMNAS */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* IZQUIERDA */}
        <div className="space-y-4">
          <Field label="Razón social">
            <input
              className="tp-input"
              value={p.company.legalName}
              onChange={(e) => p.setCompanyField("legalName", e.target.value)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <Field label="Condición de IVA">
                <TPComboCreatable
                  mode="edit"
                  type="IVA_CONDITION"
                  items={p.catIva}
                  loading={!!p.catLoading["IVA_CONDITION"]}
                  onRefresh={() => p.ensureCatalog("IVA_CONDITION")}
                  value={p.company.ivaCondition}
                  onChange={(v) => p.setCompanyField("ivaCondition", v)}
                  allowCreate={p.allowCreate}
                  onCreate={(label) => p.createAndRefresh("IVA_CONDITION", label)}
                  disabled={p.readonly}
                  placeholder="Condición de IVA…"
                />
              </Field>
            </div>

            <div className="sm:col-span-7">
              <Field label="CUIT">
                <input
                  className="tp-input"
                  value={p.company.cuit}
                  onChange={(e) => p.setCompanyField("cuit", onlyDigits(e.target.value))}
                  readOnly={p.readonly}
                  disabled={p.readonly}
                />
              </Field>
            </div>
          </div>

          <Field label="Sitio web">
            <input
              className="tp-input"
              value={p.company.website}
              onChange={(e) => p.setCompanyField("website", e.target.value)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </Field>
        </div>

        {/* DERECHA */}
        <div className="space-y-4">
          <Field label="Nombre de Fantasía">
            <input
              className="tp-input"
              value={p.existing.name}
              onChange={(e) => p.setExistingField("name", e.target.value)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
              </Field>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <Field label="Prefijo">
                <TPComboCreatable
                  mode="edit"
                  type="PHONE_PREFIX"
                  items={p.catPrefix}
                  loading={!!p.catLoading["PHONE_PREFIX"]}
                  onRefresh={() => p.ensureCatalog("PHONE_PREFIX")}
                  value={p.existing.phoneCountry}
                  onChange={(v) => p.setExistingField("phoneCountry", v)}
                  allowCreate={p.allowCreate}
                  onCreate={(label) => p.createAndRefresh("PHONE_PREFIX", label)}
                  disabled={p.readonly}
                  placeholder="Ej: AR +54"
                />
                  </Field>
            </div>

            <div className="sm:col-span-8">
              <Field label="Teléfono">
                <input
                  className="tp-input"
                  value={p.existing.phoneNumber}
                  onChange={(e) => p.setExistingField("phoneNumber", e.target.value)}
                  readOnly={p.readonly}
                  disabled={p.readonly}
                />
                  </Field>
            </div>
          </div>

          <Field label="Correo electrónico">
            <input
              className="tp-input"
              value={p.company.email}
              onChange={(e) => p.setCompanyField("email", e.target.value)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </Field>
        </div>
      </div>

      {/* DOMICILIO */}
      <div className="mt-6 rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="font-semibold text-sm mb-4">Domicilio</div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <Field label="Calle">
              <input
                className="tp-input"
                value={p.existing.street}
                onChange={(e) => p.setExistingField("street", e.target.value)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Número">
              <input
                className="tp-input"
                value={p.existing.number}
                onChange={(e) => p.setExistingField("number", e.target.value)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </Field>
          </div>

          <div className="md:col-span-5">
            <Field label="Ciudad">
              <TPComboCreatable
                mode="edit"
                type="CITY"
                items={p.catCity}
                loading={!!p.catLoading["CITY"]}
                onRefresh={() => p.ensureCatalog("CITY")}
                value={p.existing.city}
                onChange={(v) => p.setExistingField("city", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("CITY", label)}
                disabled={p.readonly}
                placeholder="Ciudad"
              />
            </Field>
          </div>

          <div className="md:col-span-4">
            <Field label="Provincia">
              <TPComboCreatable
                mode="edit"
                type="PROVINCE"
                items={p.catProvince}
                loading={!!p.catLoading["PROVINCE"]}
                onRefresh={() => p.ensureCatalog("PROVINCE")}
                value={p.existing.province}
                onChange={(v) => p.setExistingField("province", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("PROVINCE", label)}
                disabled={p.readonly}
                placeholder="Provincia"
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Código Postal">
              <input
                className="tp-input"
                value={p.existing.postalCode}
                onChange={(e) => p.setExistingField("postalCode", e.target.value)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </Field>
          </div>

          <div className="md:col-span-5">
            <Field label="País">
              <TPComboCreatable
                mode="edit"
                type="COUNTRY"
                items={p.catCountry}
                loading={!!p.catLoading["COUNTRY"]}
                onRefresh={() => p.ensureCatalog("COUNTRY")}
                value={p.existing.country}
                onChange={(v) => p.setExistingField("country", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("COUNTRY", label)}
                disabled={p.readonly}
                placeholder="País"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* NOTAS + ADJUNTOS */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-semibold text-sm mb-3">Notas</div>
          <textarea
            className="tp-input min-h-[160px]"
            value={p.company.notes}
            onChange={(e) => p.setCompanyField("notes", e.target.value)}
            readOnly={p.readonly}
            disabled={p.readonly}
          />
          <HelpText className="mt-2">Podés dejar aclaraciones internas sobre la empresa.</HelpText>
        </div>

        <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-semibold text-sm mb-3">Adjuntos</div>

          <div className="space-y-3">
            {/* input hidden */}
            <input
              ref={p.attInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.currentTarget.value = "";
                if (busyAttachments) return;
                await onPickFiles(files);
              }}
              disabled={busyAttachments}
            />

            {/* panel (mismo look tp-input / bordes grises var(--border)) */}
            <div
              className="rounded-2xl p-3"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
              }}
            >
              {/* dropzone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => !busyAttachments && p.attInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (busyAttachments) return;
                  if (e.key === "Enter" || e.key === " ") p.attInputRef.current?.click();
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
                  await onPickFiles(files);
                }}
                className={cn(
                  "w-full rounded-2xl border border-dashed",
                  "min-h-[160px] flex flex-col items-center justify-center text-center px-6 py-6",
                  "transition",
                  busyAttachments && "opacity-60 pointer-events-none"
                )}
                style={{
                  borderColor: dragOver ? "color-mix(in oklab, var(--primary) 60%, var(--border))" : "var(--border)",
                  background: dragOver ? "color-mix(in oklab, var(--primary) 10%, var(--card))" : "var(--surface)",
                  color: "var(--muted)",
                }}
              >
                <div className="text-sm" style={{ color: "var(--text)" }}>
                  {p.uploadingAttachments ? "Subiendo archivos…" : "Click para agregar archivos +"}
                </div>

                <HelpText className="mt-1">
                  {dragOver ? "Soltá para adjuntar" : "También podés arrastrar y soltar acá"}
                </HelpText>

                {hasSaved && (
                  <HelpText className="mt-3">{p.savedAttachments.length} guardado(s)</HelpText>
                )}
              </div>

              <HelpText className="mt-3">Podés agregar o eliminar adjuntos cuando quieras.</HelpText>
            </div>

            {/* list */}
            {hasSaved && (
              <div className="rounded-2xl p-3" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="space-y-2">
                  <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    Guardados
                  </div>

                  <div className="space-y-2">
                    {p.savedAttachments.map((a: any) => {
                      const id = String(a?.id ?? "");
                      const filename = safeFileLabel(a?.filename ?? a?.name ?? "Archivo");
                      const url = absUrl(String(a?.url ?? ""));
                      const mime = String(a?.mimeType ?? a?.mimetype ?? a?.type ?? "");
                      const isImg = isLikelyImage(mime || filename);
                      const busyRow = p.deletingAttId === id || busyAttachments;

                      return (
                        <div
                          key={id || filename}
                          className="flex items-center gap-3 rounded-xl px-3 py-2"
                          style={{
                            border: "1px solid var(--border)",
                            background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
                          }}
                        >
                          <div
                            className="h-10 w-10 shrink-0 overflow-hidden rounded-lg grid place-items-center"
                            style={{
                              border: "1px solid var(--border)",
                              background: "color-mix(in oklab, var(--card) 86%, var(--bg))",
                            }}
                          >
                            {isImg && url ? (
                              <img src={url} alt={filename} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                                DOC
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-sm text-primary underline"
                                title={filename}
                              >
                                {filename}
                              </a>
                            ) : (
                              <div className="truncate text-sm" style={{ color: "var(--text)" }} title={filename}>
                                {filename}
                              </div>
                            )}

                            <HelpText className="mt-0.5">
                              {typeof a?.size === "number" ? formatBytes(a.size) : ""}
                            </HelpText>
                          </div>

                          <button
                            type="button"
                            className={cn("tp-btn-secondary !px-3 !py-1 text-xs")}
                            onClick={() => p.deleteSavedAttachment(id)}
                            disabled={busyRow || !id}
                            title="Eliminar"
                          >
                            {p.deletingAttId === id ? "Quitando…" : "Eliminar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!hasSaved && !p.uploadingAttachments ? (
              <HelpText>Todavía no hay adjuntos.</HelpText>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
