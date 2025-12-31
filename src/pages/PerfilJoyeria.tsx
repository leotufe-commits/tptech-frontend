import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMe, type Jewelry } from "../hooks/useMe";

type ExistingBody = {
  name: string; // Nombre de Fantasía
  firstName: string;
  lastName: string;
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

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

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
      name: jewelry.name,
      firstName: jewelry.firstName,
      lastName: jewelry.lastName,
      phoneCountry: jewelry.phoneCountry,
      phoneNumber: jewelry.phoneNumber,

      street: jewelry.street,
      number: jewelry.number,
      city: jewelry.city,
      province: jewelry.province,
      postalCode: jewelry.postalCode,
      country: jewelry.country,
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
    () => !!existing && !!company && (existing.name || "").trim().length > 0,
    [existing, company]
  );

  function setExistingField<K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) {
    setExisting((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setCompanyField<K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) {
    setCompany((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function onPickAttachments(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setCompany((prev) => (prev ? { ...prev, attachments: [...prev.attachments, ...arr] } : prev));
  }

  function removeAttachment(i: number) {
    setCompany((prev) => {
      if (!prev) return prev;
      return { ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) };
    });
  }

  async function onSave() {
    if (!existing || !company) return;
    setMsg(null);

    try {
      setSaving(true);

      const payload: UpdatePayload = {
        ...existing,
        logoUrl: company.logoUrl?.trim(),
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

      setMsg("Guardado ✅ (Adjuntos aún no se suben al servidor)");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-zinc-500">Cargando...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Error: {error}</div>;

  if (!jewelry) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Datos de la empresa</h2>
        <p className="mt-2 text-sm text-zinc-600">Este usuario no tiene una joyería asociada.</p>
      </div>
    );
  }

  if (!existing || !company) return null;

  const displayName = existing.name || "Joyería";

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-xl font-semibold text-zinc-900">Datos de la empresa</h2>

      {msg && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          {msg}
        </div>
      )}

      {/* RECUADRO PRINCIPAL (incluye notas + adjuntos) */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {/* Encabezado: logo + nombre grande */}
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt="Logo"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-[11px] font-semibold text-zinc-400">
                SIN LOGO
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-2xl font-semibold text-zinc-900">{displayName}</div>
          </div>
        </div>

        {/* Columnas */}
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Columna 1 (swap: Fantasía arriba, Razón social abajo) */}
          <div className="space-y-4">
            <Field label="Nombre de Fantasía">
              <input
                className="tp-input"
                value={existing.name}
                onChange={(e) => setExistingField("name", e.target.value)}
              />
            </Field>

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
                    <option value="No responsable">No responsable</option>
                  </select>
                </Field>
              </div>

              <div className="col-span-8">
                <Field label="CUIT">
                  <input
                    className="tp-input"
                    value={company.cuit}
                    onChange={(e) => setCompanyField("cuit", onlyDigits(e.target.value))}
                    placeholder="20123456789"
                  />
                </Field>
              </div>
            </div>

            <Field label="Correo electrónico">
              <input
                className="tp-input"
                value={company.email}
                onChange={(e) => setCompanyField("email", e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </Field>
          </div>

          {/* Columna 2 */}
          <div className="space-y-4">
            <Field label="Apellido">
              <input
                className="tp-input"
                value={existing.lastName}
                onChange={(e) => setExistingField("lastName", e.target.value)}
              />
            </Field>

            <Field label="Nombre">
              <input
                className="tp-input"
                value={existing.firstName}
                onChange={(e) => setExistingField("firstName", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <Field label="Prefijo">
                  <input
                    className="tp-input"
                    value={existing.phoneCountry}
                    onChange={(e) => setExistingField("phoneCountry", e.target.value)}
                    placeholder="+54"
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

            <Field label="Sitio web">
              <input
                className="tp-input"
                value={company.website}
                onChange={(e) => setCompanyField("website", e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        {/* DOMICILIO */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold text-zinc-900">Domicilio</div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
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

        {/* NOTAS + ADJUNTOS dentro del recuadro principal */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* NOTAS */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-zinc-900">Notas</div>
            <textarea
              className="tp-input mt-3 min-h-[160px]"
              value={company.notes}
              onChange={(e) => setCompanyField("notes", e.target.value)}
              placeholder="Escribí notas internas..."
            />
          </div>

          {/* ADJUNTOS centrado */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-zinc-900">Adjuntos</div>

            <label className="mt-3 block cursor-pointer">
              {/* ✅ misma altura que notas */}
              <div className="min-h-[160px] rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 flex items-center justify-center text-center">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Seleccionar archivos</div>
                  <div className="mt-1 text-xs text-zinc-500">PDF, imágenes, etc.</div>
                </div>
              </div>

              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickAttachments(e.target.files)}
              />
            </label>

            {company.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {company.attachments.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">{f.name}</div>
                      <div className="text-xs text-zinc-500">{fmtBytes(f.size)}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTÓN ABAJO CENTRADO */}
      <div className="mt-8 flex items-center justify-center">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="rounded-xl bg-orange-500 px-8 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-600">{label}</label>
      {children}
    </div>
  );
}
