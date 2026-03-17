// src/pages/configuracion-sistema/ConfiguracionSistemaCorreos.tsx
import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../../lib/api";
import { useMe } from "../../hooks/useMe";
import { TPButton } from "../../components/ui/TPButton";
import { TPSectionShell } from "../../components/ui/TPSectionShell";

import PerfilJoyeriaEmailSection from "../PerfilJoyeria/PerfilJoyeriaEmailSection";
import type { EmailConfigBody, JewelryProfile } from "../PerfilJoyeria/perfilJoyeria.types";
import {
  jewelryToDraft,
  normalizeJewelryResponse,
  pickJewelryFromMe,
} from "../PerfilJoyeria/perfilJoyeria.utils";

export default function ConfiguracionSistemaCorreos() {
  const { me, loading, error, refresh } = useMe();
  const navigate = useNavigate();

  const [serverJewelry, setServerJewelry] = useState<JewelryProfile | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigBody | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hidratar desde el contexto de autenticación
  useEffect(() => {
    const j = pickJewelryFromMe(me);
    if (!j) return;
    setServerJewelry(j as JewelryProfile);
    const d = jewelryToDraft(j);
    setEmailConfig(d.emailConfig);
  }, [me]);

  const setEmailField = useCallback(
    <K extends keyof EmailConfigBody>(key: K, value: EmailConfigBody[K]) => {
      if (!editing) return;
      setEmailConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [editing]
  );

  const onCancel = useCallback(() => {
    if (!serverJewelry) return;
    const d = jewelryToDraft(serverJewelry);
    setEmailConfig(d.emailConfig);
    setEditing(false);
    setMsg(null);
  }, [serverJewelry]);

  const onSave = useCallback(async () => {
    if (!serverJewelry || !emailConfig) return;
    try {
      setSaving(true);
      setMsg(null);

      // Enviamos el payload completo para no pisar campos del resto de la empresa
      const j = serverJewelry;
      const payload = {
        name: j.name,
        phoneCountry: j.phoneCountry,
        phoneNumber: j.phoneNumber,
        street: j.street,
        number: j.number,
        city: j.city,
        province: j.province,
        postalCode: j.postalCode,
        country: j.country,
        logoUrl: j.logoUrl,
        legalName: j.legalName,
        cuit: j.cuit,
        ivaCondition: j.ivaCondition,
        email: j.email,
        website: j.website,
        notes: j.notes,
        ...emailConfig,
      };

      const resp = await apiFetch<any>("/company/me", {
        method: "PATCH",
        body: payload,
        on401: "throw",
      });

      const updated = normalizeJewelryResponse(resp) as JewelryProfile;
      setServerJewelry(updated);
      const d = jewelryToDraft(updated);
      setEmailConfig(d.emailConfig);
      setEditing(false);
      setMsg("Configuración guardada ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [serverJewelry, emailConfig, refresh]);

  if (loading || !emailConfig) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-muted">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
      <TPSectionShell
        title="Correos del sistema"
        subtitle="Remitente, firma, logo y datos de contacto para emails automáticos."
        right={
          !editing ? (
            <>
              <TPButton
                variant="secondary"
                type="button"
                onClick={() => navigate(-1)}
                iconLeft={<ArrowLeft className="h-4 w-4" />}
              >
                Volver
              </TPButton>
              <TPButton
                variant="primary"
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMsg(null);
                }}
                iconLeft={<Pencil className="h-4 w-4" />}
              >
                Editar
              </TPButton>
            </>
          ) : (
            <>
              <TPButton
                variant="secondary"
                type="button"
                onClick={onCancel}
                disabled={saving}
                iconLeft={<X className="h-4 w-4" />}
              >
                Cancelar
              </TPButton>
              <TPButton
                variant="primary"
                type="button"
                onClick={onSave}
                loading={saving}
                disabled={saving}
                iconLeft={!saving ? <Save className="h-4 w-4" /> : undefined}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </TPButton>
            </>
          )
        }
      >
        {msg && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted mb-2">
            {msg}
          </div>
        )}

        <PerfilJoyeriaEmailSection
          emailConfig={emailConfig}
          setEmailField={setEmailField}
          readonly={!editing}
        />
      </TPSectionShell>
    </div>
  );
}
