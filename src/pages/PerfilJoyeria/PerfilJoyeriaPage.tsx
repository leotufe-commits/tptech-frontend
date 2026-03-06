// src/pages/PerfilJoyeria/PerfilJoyeriaPage.tsx
import React from "react";
import { Pencil, Save, Loader2, X, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ConfirmUnsavedChangesDialog from "../../components/ui/ConfirmUnsavedChangesDialog";
import { TPButton } from "../../components/ui/TPButton";
import TPFocusTrap from "../../components/ui/TPFocusTrap";
import TPAvatarUploader from "../../components/ui/TPAvatarUploader";

import { usePerfilJoyeria } from "./usePerfilJoyeria";
import { cardBase, cn, valueOrDash } from "./perfilJoyeria.utils";

import PerfilJoyeriaView from "./PerfilJoyeriaView";
import PerfilJoyeriaEdit from "./PerfilJoyeriaEdit";

/* =========================
   Small UI helpers
========================= */

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>;
}

function StatusLine({
  icon,
  children,
  tone = "muted",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "danger";
}) {
  const cls = tone === "danger" ? "text-red-600" : "text-[color:var(--muted)]";
  return (
    <div className={cn("text-sm flex items-center gap-2", cls)}>
      {icon ? icon : null}
      {children}
    </div>
  );
}

/* =========================
   Page
========================= */

export default function PerfilJoyeriaPage() {
  const p = usePerfilJoyeria();
  const nav = useNavigate();

  if (p.loading) {
    return (
      <Shell>
        <StatusLine icon={<Loader2 className="h-4 w-4 animate-spin" />}>
          Cargando...
        </StatusLine>
      </Shell>
    );
  }

  if (p.error) {
    return (
      <Shell>
        <StatusLine tone="danger">Error: {p.error}</StatusLine>
      </Shell>
    );
  }

  if (!p.serverJewelry || !p.existing || !p.company) {
    return (
      <Shell>
        <StatusLine>Cargando datos de la empresa...</StatusLine>
      </Shell>
    );
  }

  const titleMain = String(p.company.legalName || "").trim() || "Empresa";
  const subtitle = String(p.existing.name || "").trim();

  const logoBusy = p.uploadingLogo || p.deletingLogo;

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

        {!p.isEditMode ? (
          <div className="flex items-center gap-2">
            <TPButton
              variant="secondary"
              type="button"
              onClick={() => nav(-1)}
              iconLeft={<ChevronLeft className="h-4 w-4" />}
            >
              Volver
            </TPButton>

            <TPButton
              variant="primary"
              type="button"
              onClick={p.goToEditMode}
              iconLeft={<Pencil className="h-4 w-4" />}
            >
              Editar
            </TPButton>
          </div>
        ) : null}
      </div>

      {p.msg ? (
        <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card)_92%,var(--bg))] px-4 py-3 text-sm text-muted">
          {p.msg}
        </div>
      ) : null}

      {/* Summary */}
      <div className={cn(cardBase("p-4"))}>
        <div className="flex items-start gap-4">

          {/* Logo */}
          <div className="shrink-0">
            <TPAvatarUploader
              src={p.company.logoUrl}
              name={p.existing.name}
              email={undefined}
              size={80}
              rounded="xl"
              disabled={p.busyAny}
              loading={logoBusy}

              /* ✅ SOLO muestra acciones cuando se está editando */
              showActions={p.isEditMode}

              onError={(msg) => p.setMsg(msg)}

              addLabel="Agregar"
              editLabel="Editar"
              deleteLabel="Eliminar logo"

              onUpload={async (file) => {
                if (!p.isEditMode) return;
                await p.uploadLogoInstant(file);
              }}

              onDelete={async () => {
                if (!p.isEditMode) return;
                await p.deleteLogoInstant();
              }}

              frameClassName={cn(
                "border border-border",
                "bg-card",
                "hover:border-border/80"
              )}

              imgClassName="object-contain p-1"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xl truncate">
              {titleMain}
            </div>

            <div className="text-sm text-muted truncate">
              {valueOrDash(subtitle)}
            </div>
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
                  tabIndex={9998}
                  variant="secondary"
                  onClick={p.onBackOrCancel}
                  iconLeft={<X className="h-4 w-4" />}
                >
                  Cancelar
                </TPButton>

                <TPButton
                  tabIndex={9999}
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