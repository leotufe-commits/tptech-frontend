import React from "react";
import { Pencil, Save, Loader2, X, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ConfirmUnsavedChangesDialog from "../../components/ui/ConfirmUnsavedChangesDialog";
import { TPButton } from "../../components/ui/TPButton";
import TPFocusTrap from "../../components/ui/TPFocusTrap";

import { usePerfilJoyeria } from "./usePerfilJoyeria";
import { absUrl, cardBase, cn, valueOrDash } from "./perfilJoyeria.utils";

import PerfilJoyeriaView from "./PerfilJoyeriaView";
import PerfilJoyeriaEdit from "./PerfilJoyeriaEdit";

export default function PerfilJoyeriaPage() {
  const p = usePerfilJoyeria();
  const nav = useNavigate();

  if (p.loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-[color:var(--muted)] flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando...
        </div>
      </div>
    );
  }

  if (p.error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-red-600">Error: {p.error}</div>
      </div>
    );
  }

  if (!p.serverJewelry || !p.existing || !p.company) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-[color:var(--muted)]">Cargando datos de la empresa...</div>
      </div>
    );
  }

  const companyLogoUrl = String(p.company.logoUrl || "").trim();
  const headerLogoSrc = p.logoPreview ? p.logoPreview : companyLogoUrl ? absUrl(companyLogoUrl) : "";
  const hasLogo = Boolean(headerLogoSrc);

  const titleMain = String(p.company.legalName || "").trim() || "Empresa";
  const subtitle = String(p.existing.name || "").trim();

  return (
    <div className={cn("mx-auto max-w-6xl p-4 sm:p-6 space-y-4")}>
      <ConfirmUnsavedChangesDialog
        open={p.confirmUnsavedOpen}
        busy={p.busyAny}
        onClose={() => p.setConfirmUnsavedOpen(false)}
        onDiscard={() => {
          p.setConfirmUnsavedOpen(false);
          p.resetToServerValues();
          p.goToViewMode();
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Dashboard / Configuración</div>
          <h1 className="text-2xl font-semibold truncate">Empresa</h1>
        </div>

        {!p.isEditMode && (
          <div className="flex items-center gap-2">
            <TPButton
              variant="secondary"
              type="button"
              onClick={() => nav(-1)}
              iconLeft={<ChevronLeft className="h-4 w-4" />}
            >
              Volver
            </TPButton>

            <TPButton variant="primary" type="button" onClick={p.goToEditMode} iconLeft={<Pencil className="h-4 w-4" />}>
              Editar
            </TPButton>
          </div>
        )}
      </div>

      {p.msg && (
        <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card)_92%,var(--bg))] px-4 py-3 text-sm text-muted">
          {p.msg}
        </div>
      )}

      {/* Summary */}
      <div className={cn(cardBase("p-4"))}>
        <div className="flex items-start gap-4">
          <div className="relative group shrink-0">
            <input
              ref={p.logoInputRef}
              type="file"
              accept="image/*"
              hidden
              disabled={p.readonly}
              onChange={(e) => {
                if (p.readonly) return;
                const f = e.target.files?.[0] ?? null;
                e.currentTarget.value = "";
                if (f) p.uploadLogoInstant(f);
              }}
            />

            <button
              type="button"
              tabIndex={p.isEditMode ? -1 : 0} // ✅ en edición no entra al TAB
              className={cn(
                "h-20 w-20 rounded-2xl grid place-items-center relative overflow-hidden",
                "focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]",
                p.readonly ? "cursor-default" : "cursor-pointer"
              )}
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                color: "var(--muted)",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!p.readonly) p.logoInputRef.current?.click();
              }}
              disabled={p.readonly || p.uploadingLogo || p.deletingLogo}
            >
              {hasLogo ? (
                <>
                  {(p.uploadingLogo || p.logoImgLoading) && (
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.22)" }}
                    >
                      <div className="h-7 w-7 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    </div>
                  )}

                  <img
                    src={headerLogoSrc}
                    alt="Logo"
                    className="h-full w-full object-cover"
                    onLoad={() => p.setLogoImgLoading(false)}
                    onError={() => p.setLogoImgLoading(false)}
                    onLoadStart={() => p.setLogoImgLoading(true)}
                  />
                </>
              ) : (
                <span className="text-lg font-extrabold tracking-tight text-text select-none">{p.initials}</span>
              )}
            </button>

            {!p.readonly && hasLogo && !p.isEditMode && (
              <button
                type="button"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full grid place-items-center shadow-sm"
                style={{
                  border: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--card) 86%, var(--bg))",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  p.deleteLogoInstant();
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xl truncate">{titleMain}</div>
            <div className="text-sm text-muted truncate">{valueOrDash(subtitle)}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      {!p.isEditMode ? (
        <PerfilJoyeriaView
          existingName={p.existing.name}
          company={p.company}
          phone={p.phone}
          addressLine={p.addressLine}
          addressMeta={p.addressMeta}
          savedAttachments={p.savedAttachments}
        />
      ) : (
        <TPFocusTrap active={p.isEditMode}>
          <div>
            <PerfilJoyeriaEdit
              existing={p.existing}
              company={p.company}
              readonly={p.readonly}
              allowCreate={p.allowCreate}
              setExistingField={p.setExistingField}
              setCompanyField={p.setCompanyField}
              catIva={p.catIva}
              catPrefix={p.catPrefix}
              catCity={p.catCity}
              catProvince={p.catProvince}
              catCountry={p.catCountry}
              catLoading={p.catLoading}
              ensureCatalog={p.ensureCatalog}
              createAndRefresh={p.createAndRefresh}
              attInputRef={p.attInputRef}
              uploadingAttachments={p.uploadingAttachments}
              deletingAttId={p.deletingAttId}
              uploadAttachmentsInstant={p.uploadAttachmentsInstant}
              deleteSavedAttachment={p.deleteSavedAttachment}
              savedAttachments={p.savedAttachments}
            />

            <div className="pt-2">
              <div className="flex items-center justify-end gap-3">
                <TPButton
                  tabIndex={9998} // ✅ después de Adjuntos
                  variant="secondary"
                  onClick={p.onBackOrCancel}
                  iconLeft={<X className="h-4 w-4" />}
                >
                  Cancelar
                </TPButton>

                <TPButton
                  tabIndex={9999} // ✅ último
                  variant="primary"
                  loading={p.saving}
                  disabled={!p.canSave}
                  onClick={p.onSave}
                  iconLeft={!p.saving ? <Save className="h-4 w-4" /> : undefined}
                >
                  {p.saving ? "Guardando…" : "Guardar cambios"}
                </TPButton>
              </div>
            </div>
          </div>
        </TPFocusTrap>
      )}
    </div>
  );
}