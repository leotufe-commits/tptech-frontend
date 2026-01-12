import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ================== SELECT (idéntico a ThemeSwitcher) ================== */

type SelectOption = { value: string; label: string };

function TpSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => options.find((o) => o.value === value), [options, value]);

  // Cerrar al click fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ESC cierra
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }

  // ---- Portal positioning ----
  const r = btnRef.current?.getBoundingClientRect();
  const viewportPad = 10;
  const gap = 8;

  const width = r?.width ?? 320;
  const leftWanted = r?.left ?? viewportPad;
  const left = clamp(leftWanted, viewportPad, window.innerWidth - viewportPad - width);

  const maxH = 320;
  const spaceBelow = window.innerHeight - viewportPad - (r?.bottom ?? 0);
  const spaceAbove = (r?.top ?? 0) - viewportPad;
  const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;

  const topDown = clamp(
    (r?.bottom ?? 0) + gap,
    viewportPad,
    window.innerHeight - viewportPad - maxH
  );
  const topUp = clamp(
    (r?.top ?? 0) - gap - maxH,
    viewportPad,
    window.innerHeight - viewportPad - maxH
  );
  const top = openDown ? topDown : topUp;

  const menu = open ? (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 10000 }}
        onMouseDown={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={menuRef}
        role="listbox"
        aria-label="Selector"
        style={{
          position: "fixed",
          left,
          top,
          width,
          maxHeight: maxH,
          zIndex: 10001,
        }}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tp-scroll overflow-auto" style={{ maxHeight: maxH }}>
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors",
              value === ""
                ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
                : "text-text hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
            )}
          >
            {placeholder}
          </button>

          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
                    : "text-text hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn("tp-input text-left cursor-pointer select-none relative !py-2 !px-3 !pr-9")}
        title={current?.label ?? placeholder}
      >
        <span className="text-sm">{current?.label ?? placeholder}</span>

        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open ? createPortal(menu, document.body) : null}
    </div>
  );
}

/* ================== COMPONENTE ================== */

export default function PerfilJoyeria() {
  const { me, loading, error, refresh } = useMe();
  const jewelry = me?.jewelry ?? null;

  const [existing, setExisting] = useState<ExistingBody | null>(null);
  const [company, setCompany] = useState<CompanyBody | null>(null);

  // ✅ Logo real (archivo + preview)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

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

    // Reset logo local cuando cambia joyería
    setLogoFile(null);
    setLogoPreview("");
  }, [jewelry?.id]);

  // Cleanup preview url
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

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

  function onPickLogo(file: File | null) {
    if (!file) return;

    // Validación básica (ajustable)
    const okType = /^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/i.test(file.type);
    if (!okType) {
      setMsg("El logo debe ser una imagen (png/jpg/webp/gif/svg).");
      return;
    }

    // 5MB (ajustable)
    if (file.size > 5 * 1024 * 1024) {
      setMsg("El logo no puede superar 5MB.");
      return;
    }

    setMsg(null);

    // revoke anterior
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function onPickAttachments(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);

    // (opcional) limitar tamaño / tipos
    const filtered = arr.filter((f) => f.size <= 20 * 1024 * 1024); // 20MB
    setCompany((p) => (p ? { ...p, attachments: [...p.attachments, ...filtered] } : p));
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
        // ⚠️ dejamos esto por compatibilidad con tu backend actual
        logoUrl: company.logoUrl.trim(),
        legalName: company.legalName.trim(),
        cuit: company.cuit.trim(),
        ivaCondition: company.ivaCondition.trim(),
        email: company.email.trim(),
        website: company.website.trim(),
        notes: company.notes,
      };

      const hasFiles = !!logoFile || (company.attachments?.length ?? 0) > 0;

      if (hasFiles) {
        // ✅ multipart/form-data (requiere backend + apiFetch compatible)
        const fd = new FormData();
        fd.append("data", JSON.stringify(payload));
        if (logoFile) fd.append("logo", logoFile);
        company.attachments.forEach((f) => fd.append("attachments", f));

        await apiFetch<any>("/auth/me/jewelry", {
          method: "PUT",
          body: fd as any,
        });
      } else {
        // ✅ JSON (como hoy)
        await apiFetch<any>("/auth/me/jewelry", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      setMsg("Guardado correctamente ✅");
      await refresh();

      // limpiar adjuntos locales después de guardar
      setCompany((p) => (p ? { ...p, attachments: [] } : p));
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-[color:var(--muted)]">Cargando...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Error: {error}</div>;
  if (!jewelry || !existing || !company) return null;

  const ivaOptions: SelectOption[] = [
    { value: "Responsable Inscripto", label: "Responsable Inscripto" },
    { value: "Monotributo", label: "Monotributo" },
    { value: "Exento", label: "Exento" },
    { value: "Consumidor Final", label: "Consumidor Final" },
  ];

  const headerLogoSrc = logoPreview || company.logoUrl || "";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
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
        className="mt-6 rounded-2xl p-4 sm:p-6"
        style={{
          border: "1px solid var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
        }}
      >
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          {/* LOGO */}
          <div className="flex items-center gap-3">
            <div
              className="h-20 w-20 rounded-2xl grid place-items-center overflow-hidden"
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                color: "var(--muted)",
              }}
            >
              {headerLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headerLogoSrc}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs">SIN LOGO</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="inline-flex">
                <span className="sr-only">Subir logo</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
                />
                <span className="tp-btn-primary px-4 py-2 text-sm cursor-pointer select-none">
                  {headerLogoSrc ? "Cambiar logo" : "Subir logo"}
                </span>
              </label>

              {(logoFile || company.logoUrl) && (
                <button
                  type="button"
                  className="text-xs text-muted underline underline-offset-2 self-start"
                  onClick={() => {
                    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
                    setLogoFile(null);
                    setLogoPreview("");
                    // si querés “quitar” en backend, lo resolvemos cuando veamos el controller
                    // por ahora solo limpiamos el preview local
                  }}
                >
                  Quitar (local)
                </button>
              )}
            </div>
          </div>

          {/* TITULOS */}
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-text truncate">{existing.name}</div>
            {company.legalName && (
              <div className="text-sm text-[color:var(--muted)] truncate">{company.legalName}</div>
            )}
          </div>
        </div>

        {/* COLUMNAS */}
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            <Field label="Razón social">
              <input
                className="tp-input"
                value={company.legalName}
                onChange={(e) => setCompanyField("legalName", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <Field label="Condición de IVA">
                  <TpSelect
                    value={company.ivaCondition}
                    onChange={(v) => setCompanyField("ivaCondition", v)}
                    options={ivaOptions}
                    placeholder="Seleccionar..."
                  />
                </Field>
              </div>

              <div className="sm:col-span-7">
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

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <Field label="Prefijo">
                  <input
                    className="tp-input"
                    value={existing.phoneCountry}
                    onChange={(e) => setExistingField("phoneCountry", e.target.value)}
                  />
                </Field>
              </div>

              <div className="sm:col-span-8">
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
          className="mt-6 rounded-2xl p-4 sm:p-5"
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
            className="rounded-2xl p-4 sm:p-5"
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
            className="rounded-2xl p-4 sm:p-5"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <div className="font-semibold text-sm mb-3 text-text">Adjuntos</div>

            <label className="block cursor-pointer">
              <div
                className="min-h-[120px] sm:min-h-[160px] flex items-center justify-center border border-dashed rounded-2xl"
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

            {/* ✅ lista */}
            {company.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {company.attachments.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                    style={{
                      border: "1px solid var(--border)",
                      background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-text truncate">{f.name}</div>
                      <div className="text-xs text-muted">{formatBytes(f.size)}</div>
                    </div>

                    <button
                      type="button"
                      className="text-xs text-muted underline underline-offset-2 shrink-0"
                      onClick={() => removeAttachment(idx)}
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

      {/* BOTÓN */}
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
