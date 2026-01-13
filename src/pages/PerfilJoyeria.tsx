// tptech-frontend/src/pages/PerfilJoyeria.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";

/* ================== TIPOS ================== */

type ExistingBody = {
  name: string;
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

  legalName: string;
  cuit: string;
  ivaCondition: string;
  email: string;
  website: string;

  notes: string;
};

type JewelryAttachment = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt?: string;
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

function safeFileLabel(name: string) {
  return String(name || "").trim() || "Archivo";
}

/** Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend. */
function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

function pickJewelryFromMe(me: any) {
  return (me as any)?.jewelry ?? null;
}

function jewelryToDraft(j: any): { existing: ExistingBody; company: CompanyBody } {
  return {
    existing: {
      name: j?.name || "",
      phoneCountry: j?.phoneCountry || "",
      phoneNumber: j?.phoneNumber || "",
      street: j?.street || "",
      number: j?.number || "",
      city: j?.city || "",
      province: j?.province || "",
      postalCode: j?.postalCode || "",
      country: j?.country || "",
    },
    company: {
      logoUrl: j?.logoUrl || "",
      legalName: j?.legalName || "",
      cuit: j?.cuit || "",
      ivaCondition: j?.ivaCondition || "",
      email: j?.email || "",
      website: j?.website || "",
      notes: j?.notes || "",
    },
  };
}

function buildPayload(existing: ExistingBody, company: CompanyBody): UpdatePayload {
  return {
    ...existing,
    logoUrl: company.logoUrl?.trim() || "",
    legalName: company.legalName?.trim() || "",
    cuit: company.cuit?.trim() || "",
    ivaCondition: company.ivaCondition?.trim() || "",
    email: company.email?.trim() || "",
    website: company.website?.trim() || "",
    notes: company.notes ?? "",
  };
}

/** ✅ Normaliza respuesta backend: puede venir { jewelry: {...} } o directo {...} */
function normalizeJewelryResponse(resp: any) {
  return resp?.jewelry ?? resp;
}

/** ✅ logs solo en dev */
function devLog(...args: any[]) {
  try {
    if (import.meta.env.DEV) console.log(...args);
  } catch {}
}

/* ================== SELECT ================== */

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

  const topDown = clamp((r?.bottom ?? 0) + gap, viewportPad, window.innerHeight - viewportPad - maxH);
  const topUp = clamp((r?.top ?? 0) - gap - maxH, viewportPad, window.innerHeight - viewportPad - maxH);
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
        style={{ position: "fixed", left, top, width, maxHeight: maxH, zIndex: 10001 }}
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
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
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
  const jewelryFromContext = pickJewelryFromMe(me);

  const [serverJewelry, setServerJewelry] = useState<any>(null);

  const [existing, setExisting] = useState<ExistingBody | null>(null);
  const [company, setCompany] = useState<CompanyBody | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);

  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoImgLoading, setLogoImgLoading] = useState(false);

  const attInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!jewelryFromContext) return;

    setServerJewelry(jewelryFromContext);

    if (!existing || !company || !dirty) {
      const d = jewelryToDraft(jewelryFromContext);
      setExisting(d.existing);
      setCompany(d.company);
      if (!dirty) setMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jewelryFromContext?.id, jewelryFromContext?.updatedAt]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const savedAttachments: JewelryAttachment[] = useMemo(() => {
    const arr = (serverJewelry?.attachments ?? []) as JewelryAttachment[];
    return Array.isArray(arr) ? arr : [];
  }, [serverJewelry?.attachments]);

  const canSave = useMemo(() => {
    return !!existing && !!company && existing.name.trim().length > 0;
  }, [existing, company]);

  function setExistingField<K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) {
    setDirty(true);
    setExisting((p) => (p ? { ...p, [key]: value } : p));
  }

  function setCompanyField<K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) {
    if (key !== "logoUrl") setDirty(true);
    setCompany((p) => (p ? { ...p, [key]: value } : p));
  }

  async function uploadLogoInstant(file: File) {
    if (!existing || !company) return;

    const okType = /^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/i.test(file.type);
    if (!okType) {
      setMsg("El logo debe ser una imagen (png/jpg/webp/gif/svg).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg("El logo no puede superar 5MB.");
      return;
    }

    setMsg(null);

    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);

    try {
      setUploadingLogo(true);

      const fd = new FormData();
      fd.append("data", JSON.stringify(buildPayload(existing, company)));
      fd.append("logo", file);

      const resp = await apiFetch<any>("/auth/me/jewelry", {
        method: "PUT",
        body: fd as any,
      });

      const updated = normalizeJewelryResponse(resp);

      setServerJewelry(updated);

      const newLogo = updated?.logoUrl || "";
      setCompany((p) => (p ? { ...p, logoUrl: newLogo } : p));

      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
      setLogoPreview("");

      setMsg("Logo actualizado ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function deleteLogoInstant() {
    try {
      setMsg(null);
      setDeletingLogo(true);

      await apiFetch("/auth/me/jewelry/logo", { method: "DELETE" });

      setCompany((p) => (p ? { ...p, logoUrl: "" } : p));
      setServerJewelry((p: any) => (p ? { ...p, logoUrl: "" } : p));

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview("");

      setMsg("Logo eliminado ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo eliminar el logo.");
    } finally {
      setDeletingLogo(false);
    }
  }

  // ✅ FIX PROFESIONAL:
  // - Recibe File[] (snapshot) para evitar FileList "live" que se vacía al limpiar el input
  async function uploadAttachmentsInstant(files: File[]) {
    if (!files.length || !existing || !company) return;

    const arr = files;

    // ✅ Diagnóstico (solo dev): evidencia de qué llegó del input
    devLog("[ATTACH] received count:", arr.length);
    try {
      if (import.meta.env.DEV) {
        console.table(
          arr.map((f) => ({
            name: f.name,
            type: f.type,
            sizeBytes: f.size,
            sizeMB: Number((f.size / 1024 / 1024).toFixed(2)),
          }))
        );
      }
    } catch {}

    const MAX = 20 * 1024 * 1024;

    const rejected = arr.filter((f) => f.size > MAX);
    const filtered = arr.filter((f) => f.size <= MAX);

    if (filtered.length === 0) {
      if (rejected.length > 0) {
        const detail = rejected
          .map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
          .join(", ");
        setMsg(`No se pudieron adjuntar los archivos: ${detail}. Máximo permitido: 20 MB por archivo.`);
      } else {
        setMsg("No se recibió ningún archivo desde el selector. Volvé a intentar y revisá la consola.");
      }
      return;
    }

    try {
      setMsg(null);
      setUploadingAttachments(true);

      const fd = new FormData();
      fd.append("data", JSON.stringify(buildPayload(existing, company)));
      filtered.forEach((f) => fd.append("attachments", f));

      devLog("[ATTACH] uploading:", filtered.map((f) => f.name));

      const resp = await apiFetch<any>("/auth/me/jewelry", {
        method: "PUT",
        body: fd as any,
      });

      const updated = normalizeJewelryResponse(resp);

      setServerJewelry(updated);

      setMsg(
        rejected.length > 0
          ? `Adjuntos cargados ✅ (Se omitieron: ${rejected.map((f) => f.name).join(", ")} por superar 20 MB).`
          : "Adjuntos cargados ✅"
      );

      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "No se pudieron subir los adjuntos.");
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function deleteSavedAttachment(id: string) {
    try {
      setMsg(null);
      setDeletingAttId(id);

      await apiFetch(`/auth/me/jewelry/attachments/${id}`, { method: "DELETE" });

      setServerJewelry((p: any) =>
        p ? { ...p, attachments: (p.attachments ?? []).filter((a: any) => a.id !== id) } : p
      );

      setMsg("Adjunto eliminado ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo eliminar el adjunto.");
    } finally {
      setDeletingAttId(null);
    }
  }

  async function onSave() {
    if (!existing || !company) return;

    try {
      setMsg(null);
      setSaving(true);

      const payload = buildPayload(existing, company);

      const resp = await apiFetch<any>("/auth/me/jewelry", {
        method: "PUT",
        body: payload,
      });

      const updated = normalizeJewelryResponse(resp);

      setServerJewelry(updated);

      const d = jewelryToDraft(updated);
      setExisting(d.existing);
      setCompany(d.company);

      setDirty(false);
      setMsg("Guardado correctamente ✅");

      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-[color:var(--muted)]">Cargando...</div>
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

  if (!serverJewelry || !existing || !company) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="text-sm text-[color:var(--muted)]">Cargando datos de la empresa...</div>
      </div>
    );
  }

  const ivaOptions: SelectOption[] = [
    { value: "Responsable Inscripto", label: "Responsable Inscripto" },
    { value: "Monotributo", label: "Monotributo" },
    { value: "Exento", label: "Exento" },
    { value: "Consumidor Final", label: "Consumidor Final" },
  ];

  const headerLogoSrc = logoPreview || absUrl(company.logoUrl || "");
  const hasLogo = !!headerLogoSrc;

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
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.currentTarget.value = "";
                if (f) uploadLogoInstant(f);
              }}
            />

            <div className="relative group">
              <button
                type="button"
                className={cn(
                  "h-20 w-20 rounded-2xl grid place-items-center relative overflow-hidden",
                  "focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                )}
                style={{
                  border: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                  color: "var(--muted)",
                }}
                title={hasLogo ? "Editar logo" : "Agregar logo"}
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo || deletingLogo}
              >
                {hasLogo ? (
                  <>
                    {(uploadingLogo || logoImgLoading) && (
                      <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.22)" }}>
                        <div
                          className="h-7 w-7 rounded-full border-2 border-white/40 border-t-white animate-spin"
                          aria-label="Cargando logo"
                        />
                      </div>
                    )}

                    <img
                      src={headerLogoSrc}
                      alt="Logo"
                      className="h-full w-full object-cover"
                      onLoad={() => setLogoImgLoading(false)}
                      onError={() => setLogoImgLoading(false)}
                      onLoadStart={() => setLogoImgLoading(true)}
                    />
                  </>
                ) : (
                  <span className="text-2xl leading-none select-none">+</span>
                )}

                <div
                  className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    "grid place-items-center"
                  )}
                  style={{ background: "rgba(0,0,0,0.28)" }}
                  aria-hidden="true"
                >
                  <span className="text-white text-[11px] px-2 text-center leading-tight">
                    {uploadingLogo ? "SUBIENDO…" : hasLogo ? "EDITAR" : "AGREGAR"}
                  </span>
                </div>
              </button>

              {hasLogo && (
                <button
                  type="button"
                  onClick={() => {
                    if (!deletingLogo && !uploadingLogo) deleteLogoInstant();
                  }}
                  className={cn(
                    "absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center",
                    "opacity-0 group-hover:opacity-100 transition-opacity"
                  )}
                  style={{
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    backdropFilter: "blur(6px)",
                  }}
                  title="Eliminar logo"
                  aria-label="Eliminar logo"
                  disabled={deletingLogo || uploadingLogo}
                >
                  <span className="text-[11px] leading-none">{deletingLogo ? "…" : "✕"}</span>
                </button>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-2xl font-semibold text-text truncate">{existing.name}</div>
              {company.legalName && (
                <div className="text-sm text-[color:var(--muted)] truncate">{company.legalName}</div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNAS */}
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Razón social">
              <input className="tp-input" value={company.legalName} onChange={(e) => setCompanyField("legalName", e.target.value)} />
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
                  <input className="tp-input" value={company.cuit} onChange={(e) => setCompanyField("cuit", onlyDigits(e.target.value))} />
                </Field>
              </div>
            </div>

            <Field label="Sitio web">
              <input className="tp-input" value={company.website} onChange={(e) => setCompanyField("website", e.target.value)} />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Nombre de Fantasía">
              <input className="tp-input" value={existing.name} onChange={(e) => setExistingField("name", e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <Field label="Prefijo">
                  <input className="tp-input" value={existing.phoneCountry} onChange={(e) => setExistingField("phoneCountry", e.target.value)} />
                </Field>
              </div>

              <div className="sm:col-span-8">
                <Field label="Teléfono">
                  <input className="tp-input" value={existing.phoneNumber} onChange={(e) => setExistingField("phoneNumber", e.target.value)} />
                </Field>
              </div>
            </div>

            <Field label="Correo electrónico">
              <input className="tp-input" value={company.email} onChange={(e) => setCompanyField("email", e.target.value)} />
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
                <input className="tp-input" value={existing.street} onChange={(e) => setExistingField("street", e.target.value)} />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Número">
                <input className="tp-input" value={existing.number} onChange={(e) => setExistingField("number", e.target.value)} />
              </Field>
            </div>

            <div className="md:col-span-5">
              <Field label="Ciudad">
                <input className="tp-input" value={existing.city} onChange={(e) => setExistingField("city", e.target.value)} />
              </Field>
            </div>

            <div className="md:col-span-4">
              <Field label="Provincia">
                <input className="tp-input" value={existing.province} onChange={(e) => setExistingField("province", e.target.value)} />
              </Field>
            </div>

            <div className="md:col-span-3">
              <Field label="Código Postal">
                <input className="tp-input" value={existing.postalCode} onChange={(e) => setExistingField("postalCode", e.target.value)} />
              </Field>
            </div>

            <div className="md:col-span-5">
              <Field label="País">
                <input className="tp-input" value={existing.country} onChange={(e) => setExistingField("country", e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        {/* NOTAS + ADJUNTOS */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="font-semibold text-sm mb-3 text-text">Notas</div>
            <textarea className="tp-input min-h-[160px]" value={company.notes} onChange={(e) => setCompanyField("notes", e.target.value)} />
          </div>

          <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="font-semibold text-sm mb-3 text-text flex items-center justify-between">
              <span>Adjuntos</span>
              {uploadingAttachments && <span className="text-xs text-muted">Subiendo…</span>}
            </div>

            <button
              type="button"
              className="block w-full cursor-pointer"
              onClick={() => attInputRef.current?.click()}
              disabled={uploadingAttachments}
            >
              <div
                className="min-h-[120px] sm:min-h-[160px] flex items-center justify-center border border-dashed rounded-2xl"
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
              onChange={(e) => {
                // ✅ snapshot ANTES de limpiar el input (FileList puede ser "live")
                const picked = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                uploadAttachmentsInstant(picked);
              }}
            />

            {savedAttachments.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-[color:var(--muted)] mb-2">Guardados</div>
                <div className="space-y-2">
                  {savedAttachments.map((a) => {
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
                                <a
                                  className="underline underline-offset-2"
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Abrir
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={cn("h-8 w-8 rounded-full grid place-items-center", "opacity-0 group-hover:opacity-100 transition-opacity")}
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                          title="Eliminar adjunto"
                          aria-label="Eliminar adjunto"
                          disabled={busy}
                          onClick={() => {
                            if (!busy) deleteSavedAttachment(a.id);
                          }}
                        >
                          <span className="text-xs">{busy ? "…" : "✕"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {savedAttachments.length === 0 && !uploadingAttachments && (
              <div className="mt-3 text-xs text-muted">Todavía no hay adjuntos.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button onClick={onSave} disabled={!canSave || saving} className="tp-btn-primary px-10 py-4">
          {saving ? "Guardando..." : dirty ? "Guardar cambios" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[color:var(--muted)]">{label}</label>
      {children}
    </div>
  );
}
