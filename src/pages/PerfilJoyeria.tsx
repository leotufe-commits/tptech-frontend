import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMe, type Jewelry } from "../hooks/useMe";

/* ================== TIPOS ================== */

type ExistingBody = {
  name: string; // Nombre de Fantasía

  phoneCountry: string;
  phoneNumber: string;

  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

type CompanyBody = {
  logoUrl: string;

  legalName: string; // Razón social
  cuit: string;
  ivaCondition: string;
  email: string;
  website: string;

  notes: string;
  attachments: File[];
};

type UpdatePayload = ExistingBody & {
  logoUrl?: string;
  legalName?: string;
  cuit?: string;
  ivaCondition?: string;
  email?: string;
  website?: string;
  notes?: string;
};

/* ================== UTILS ================== */

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

/* ================== COMPONENTE ================== */

export default function PerfilJoyeria() {
  const { me, loading, error, refresh } = useMe();
  const jewelry = me?.jewelry ?? null;

  const [existing, setExisting] = useState<ExistingBody | null>(null);
  const [company, setCompany] = useState<CompanyBody | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!jewelry) return;
    const j: any = jewelry;

    setExisting({
      name: j.name || "",
      phoneCountry: j.phoneCountry || "",
      phoneNumber: j.phoneNumber || "",
      street: j.street || "",
      number: j.number || "",
      city: j.city || "",
      province: j.province || "",
      postalCode: j.postalCode || "",
      country: j.country || "",
    });

    setCompany({
      logoUrl: j.logoUrl || "",
      legalName: j.legalName || "",
      cuit: j.cuit || "",
      ivaCondition: j.ivaCondition || "",
      email: j.email || "",
      website: j.website || "",
      notes: j.notes || "",
      attachments: [],
    });
  }, [jewelry?.id]);

  const canSave = useMemo(
    () => !!existing && !!company && existing.name.trim().length > 0,
    [existing, company]
  );

  function setExistingField<K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) {
    setExisting((p) => (p ? { ...p, [key]: value } : p));
  }

  function setCompanyField<K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) {
    setCompany((p) => (p ? { ...p, [key]: value } : p));
  }

  function onPickAttachments(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setCompany((p) => (p ? { ...p, attachments: [...p.attachments, ...arr] } : p));
  }

  function removeAttachment(i: number) {
    setCompany((p) =>
      p ? { ...p, attachments: p.attachments.filter((_, idx) => idx !== i) } : p
    );
  }

  async function onSave() {
    if (!existing || !company) return;
    setMsg(null);

    try {
      setSaving(true);

      const payload: UpdatePayload = {
        ...existing,
        logoUrl: company.logoUrl.trim(),
        legalName: company.legalName.trim(),
        cuit: company.cuit.trim(),
        ivaCondition: company.ivaCondition.trim(),
        email: company.email.trim(),
        website: company.website.trim(),
        notes: company.notes,
      };

      await apiFetch<Jewelry>("/auth/me/jewelry", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setMsg("Guardado correctamente ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-[color:var(--muted)]">Cargando...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Error: {error}</div>;
  if (!jewelry || !existing || !company) return null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-xl font-semibold text-text">Datos de la empresa</h2>

      {msg && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{
            border: "1px solid var(--border)",
            background: "var(--card)",
            boxShadow: "var(--shadow)",
          }}
        >
          {msg}
        </div>
      )}

      <div
        className="mt-6 rounded-2xl p-6"
        style={{ border: "1px solid var(--border)", background: "var(--card)", boxShadow: "var(--shadow)" }}
      >
        {/* HEADER */}
        <div className="flex items-center gap-5">
          <div
            className="h-20 w-20 rounded-2xl grid place-items-center text-xs"
            style={{ border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 80%, var(--bg))", color: "var(--muted)" }}
          >
            SIN LOGO
          </div>

          <div>
            <div className="text-2xl font-semibold text-text">{existing.name}</div>
            {company.legalName && (
              <div className="text-sm text-[color:var(--muted)]">{company.legalName}</div>
            )}
          </div>
        </div>

        {/* COLUMNAS */}
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            <Field label="Razón social">
              <input
                className="tp-input"
                value={company.legalName}
                onChange={(e) => setCompanyField("legalName", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <Field label="Condición de IVA">
                  <select
                    className="tp-input"
                    value={company.ivaCondition}
                    onChange={(e) => setCompanyField("ivaCondition", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Responsable Inscripto">Responsable Inscripto</option>
                    <option value="Monotributo">Monotributo</option>
                    <option value="Exento">Exento</option>
                    <option value="Consumidor Final">Consumidor Final</option>
                  </select>
                </Field>
              </div>

              <div className="col-span-8">
                <Field label="CUIT">
                  <input
                    className="tp-input"
                    value={company.cuit}
                    onChange={(e) => setCompanyField("cuit", onlyDigits(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Field label="Sitio web">
              <input
                className="tp-input"
                value={company.website}
                onChange={(e) => setCompanyField("website", e.target.value)}
              />
            </Field>
          </div>

          {/* DERECHA */}
          <div className="space-y-4">
            <Field label="Nombre de Fantasía">
              <input
                className="tp-input"
                value={existing.name}
                onChange={(e) => setExistingField("name", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <Field label="Prefijo">
                  <input
                    className="tp-input"
                    value={existing.phoneCountry}
                    onChange={(e) => setExistingField("phoneCountry", e.target.value)}
                  />
                </Field>
              </div>

              <div className="col-span-8">
                <Field label="Teléfono">
                  <input
                    className="tp-input"
                    value={existing.phoneNumber}
                    onChange={(e) => setExistingField("phoneNumber", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <Field label="Correo electrónico">
              <input
                className="tp-input"
                value={company.email}
                onChange={(e) => setCompanyField("email", e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* DOMICILIO */}
        <div
          className="mt-6 rounded-2xl p-5"
          style={{
            background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
            border: "1px solid var(--border)",
          }}
        >
          <div className="font-semibold text-sm mb-4 text-text">Domicilio</div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <Field label="Calle">
                <input
                  className="tp-input"
                  value={existing.street}
                  onChange={(e) => setExistingField("street", e.target.value)}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Número">
                <input
                  className="tp-input"
                  value={existing.number}
                  onChange={(e) => setExistingField("number", e.target.value)}
                />
              </Field>
            </div>

            <div className="md:col-span-5">
              <Field label="Ciudad">
                <input
                  className="tp-input"
                  value={existing.city}
                  onChange={(e) => setExistingField("city", e.target.value)}
                />
              </Field>
            </div>

            <div className="md:col-span-4">
              <Field label="Provincia">
                <input
                  className="tp-input"
                  value={existing.province}
                  onChange={(e) => setExistingField("province", e.target.value)}
                />
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field label="Código Postal">
                <input
                  className="tp-input"
                  value={existing.postalCode}
                  onChange={(e) => setExistingField("postalCode", e.target.value)}
                />
              </Field>
            </div>

            <div className="md:col-span-5">
              <Field label="País">
                <input
                  className="tp-input"
                  value={existing.country}
                  onChange={(e) => setExistingField("country", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* NOTAS + ADJUNTOS */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-2xl p-5"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div className="font-semibold text-sm mb-3 text-text">Notas</div>
            <textarea
              className="tp-input min-h-[160px]"
              value={company.notes}
              onChange={(e) => setCompanyField("notes", e.target.value)}
            />
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div className="font-semibold text-sm mb-3 text-text">Adjuntos</div>

            <label className="block cursor-pointer">
              <div
                className="min-h-[160px] flex items-center justify-center border border-dashed rounded-2xl"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
                  color: "var(--muted)",
                }}
              >
                Seleccionar archivos
              </div>

              <input
                type="file"
                multiple
                hidden
                onChange={(e) => onPickAttachments(e.target.files)}
              />
            </label>

            {/* (opcional) lista de adjuntos, si querés mostrarla después */}
          </div>
        </div>
      </div>

      {/* ✅ BOTÓN GUARDA: ahora sigue el theme */}
      <div className="mt-8 flex justify-center">
        <button onClick={onSave} disabled={!canSave || saving} className="tp-btn-primary px-10 py-4">
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

/* ================== FIELD ================== */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[color:var(--muted)]">{label}</label>
      {children}
    </div>
  );
}
