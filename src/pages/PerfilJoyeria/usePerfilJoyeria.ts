// src/pages/PerfilJoyeria/usePerfilJoyeria.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiFetch } from "../../lib/api";
import { useMe } from "../../hooks/useMe";

import { listCatalog, createCatalogItem, type CatalogItem, type CatalogType } from "../../services/catalogs";

import type { CompanyBody, ExistingBody, JewelryAttachment, JewelryProfile } from "./perfilJoyeria.types";

import { absUrl, buildPayload, devLog, getInitials, jewelryToDraft, normalizeJewelryResponse, pickJewelryFromMe } from "./perfilJoyeria.utils";

const JEWELRY_LOGO_EVENT = "tptech:jewelry_logo_changed";

function notifyLogoChanged(logoUrl: string) {
  try {
    window.dispatchEvent(
      new CustomEvent(JEWELRY_LOGO_EVENT, {
        detail: { logoUrl: String(logoUrl || "") },
      })
    );
  } catch {
    // no-op
  }
}

type CatsState = Partial<Record<CatalogType, CatalogItem[]>>;

export function usePerfilJoyeria() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isEditMode = searchParams.get("edit") === "1";

  const { me, loading, error, refresh } = useMe();
  const jewelryFromContext = pickJewelryFromMe(me) as JewelryProfile | null;

  const [serverJewelry, setServerJewelry] = useState<JewelryProfile | null>(null);

  const [existing, setExisting] = useState<ExistingBody | null>(null);
  const [company, setCompany] = useState<CompanyBody | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);

  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null!);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoImgLoading, setLogoImgLoading] = useState(false);

  const attInputRef = useRef<HTMLInputElement>(null!);

  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);

  // ================== CATALOGS ==================
  const [cats, setCats] = useState<CatsState>({});
  const [catLoading, setCatLoading] = useState<Record<string, boolean>>({});

  const busyAny = useMemo(() => {
    return saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
  }, [saving, uploadingLogo, deletingLogo, uploadingAttachments, deletingAttId]);

  const savedAttachments: JewelryAttachment[] = useMemo(() => {
    const arr = (serverJewelry?.attachments ?? []) as JewelryAttachment[];
    return Array.isArray(arr) ? arr : [];
  }, [serverJewelry?.attachments]);

  const canSave = useMemo(() => {
    return !!existing && !!company && existing.name.trim().length > 0;
  }, [existing, company]);

  const ensureCatalog = useCallback(async (type: CatalogType, force = false) => {
    const k = String(type);

    let shouldFetch = true;
    setCatLoading((prev) => {
      if (prev[k]) {
        shouldFetch = false;
        return prev;
      }
      return { ...prev, [k]: true };
    });
    if (!shouldFetch) return;

    try {
      const items = await listCatalog(type, { force });
      setCats((p) => ({ ...p, [type]: items }));
    } catch (e: any) {
      setMsg(e?.message || "No se pudo cargar un catálogo.");
    } finally {
      setCatLoading((p) => ({ ...p, [k]: false }));
    }
  }, []);

  const createAndRefresh = useCallback(
    async (type: CatalogType, label: string) => {
      try {
        await createCatalogItem(type, label);
        await ensureCatalog(type, true);
        setMsg(`Agregado “${label}” ✅`);
      } catch (e: any) {
        setMsg(e?.message || "No se pudo agregar el ítem al catálogo.");
      }
    },
    [ensureCatalog]
  );

  // ================== HIDRATACIÓN ==================
  useEffect(() => {
    if (!jewelryFromContext) return;

    setServerJewelry(jewelryFromContext);

    const d = jewelryToDraft(jewelryFromContext);
    setExisting(d.existing);
    setCompany(d.company);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jewelryFromContext?.id, jewelryFromContext?.updatedAt]);

  // precarga de catálogos al entrar en EDIT
  useEffect(() => {
    if (!isEditMode) return;
    ensureCatalog("IVA_CONDITION");
    ensureCatalog("PHONE_PREFIX");
    ensureCatalog("CITY");
    ensureCatalog("PROVINCE");
    ensureCatalog("COUNTRY");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const goToViewMode = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const goToEditMode = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
    setSearchParams(next, { replace: true });
    setMsg(null);
  }, [searchParams, setSearchParams]);

  const setExistingField = useCallback(
    <K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) => {
      if (!isEditMode) return;
      setDirty(true);
      setExisting((p) => (p ? { ...p, [key]: value } : p));
    },
    [isEditMode]
  );

  const setCompanyField = useCallback(
    <K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) => {
      if (!isEditMode) return;
      if (key !== "logoUrl") setDirty(true);
      setCompany((p) => (p ? { ...p, [key]: value } : p));
    },
    [isEditMode]
  );

  const resetToServerValues = useCallback(() => {
    if (!serverJewelry) return;
    const d = jewelryToDraft(serverJewelry);

    setExisting(d.existing);
    setCompany(d.company);
    setDirty(false);
    setMsg(null);

    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview("");
  }, [serverJewelry, logoPreview]);

  const onBackOrCancel = useCallback(() => {
    if (busyAny) return;

    if (isEditMode) {
      if (!dirty) {
        resetToServerValues();
        goToViewMode();
        return;
      }
      setConfirmUnsavedOpen(true);
      return;
    }

    navigate(-1);
  }, [busyAny, isEditMode, dirty, resetToServerValues, goToViewMode, navigate]);

  const onSave = useCallback(async () => {
    if (!existing || !company || !isEditMode) return;

    try {
      setMsg(null);
      setSaving(true);

      const payload = buildPayload(existing, company);

      const resp = await apiFetch<any>("/company/me", {
        method: "PATCH",
        body: payload,
        on401: "throw",
      });

      const updated = normalizeJewelryResponse(resp) as JewelryProfile;
      setServerJewelry(updated);

      const d = jewelryToDraft(updated);
      setExisting(d.existing);
      setCompany(d.company);

      setDirty(false);
      setMsg("Guardado correctamente ✅");

      await refresh();
      goToViewMode();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [existing, company, isEditMode, refresh, goToViewMode]);

  const uploadLogoInstant = useCallback(
    async (file: File) => {
      if (!isEditMode) return;
      if (!file) return;

      const isImg = String(file.type || "").startsWith("image/");
      if (!isImg) {
        setMsg("El logo debe ser una imagen.");
        return;
      }

      if (busyAny) return;

      try {
        setMsg(null);
        setUploadingLogo(true);

        if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
        const blobUrl = URL.createObjectURL(file);
        setLogoPreview(blobUrl);

        const fd = new FormData();
        fd.append("logo", file);

        const resp = await apiFetch<any>("/company/me/logo", {
          method: "POST",
          body: fd as any,
          timeoutMs: 60_000,
          on401: "throw",
        });

        const updated = normalizeJewelryResponse(resp) as JewelryProfile;
        setServerJewelry(updated);

        const d = jewelryToDraft(updated);
        setExisting(d.existing);
        setCompany(d.company);

        devLog("[DBG LOGO] 1/upload resp logoUrl:", updated?.logoUrl);
        notifyLogoChanged(String(updated?.logoUrl || ""));
        devLog("[DBG LOGO] 2/event dispatched, calling refresh()");
        // Refresca AuthContext para que sidebar y favicon lean el logo actualizado
        refresh().then(() => {
          devLog("[DBG LOGO] 5/refresh() done");
        }).catch(() => {});
        setMsg("Logo actualizado ✅");
      } catch (e: any) {
        devLog("uploadLogoInstant error", e);
        setMsg(e?.message || "No se pudo subir el logo.");

        if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
        setLogoPreview("");
      } finally {
        setUploadingLogo(false);
      }
    },
    [isEditMode, busyAny, logoPreview, refresh]
  );

  const deleteLogoInstant = useCallback(async () => {
    if (!isEditMode) return;
    if (busyAny) return;

    const prevCompanyLogo = String(company?.logoUrl || "");
    const prevServerLogo = String(serverJewelry?.logoUrl || "");

    try {
      setMsg(null);
      setDeletingLogo(true);

      setCompany((p) => (p ? { ...p, logoUrl: "" } : p));
      setServerJewelry((p) => (p ? { ...p, logoUrl: "" } : p));

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview("");

      notifyLogoChanged("");

      await apiFetch<{ ok: boolean }>("/company/me/logo", {
        method: "DELETE",
        timeoutMs: 30_000,
        on401: "throw",
      });

      refresh().catch(() => {});
      setMsg("Logo eliminado ✅");
    } catch (e: any) {
      devLog("deleteLogoInstant error", e);
      setMsg(e?.message || "No se pudo eliminar el logo.");

      setCompany((p) => (p ? { ...p, logoUrl: prevCompanyLogo } : p));
      setServerJewelry((p) => (p ? { ...p, logoUrl: prevServerLogo } : p));
      notifyLogoChanged(prevCompanyLogo);
    } finally {
      setDeletingLogo(false);
    }
  }, [isEditMode, busyAny, company?.logoUrl, serverJewelry?.logoUrl, logoPreview, refresh]);

  const uploadAttachmentsInstant = useCallback(
    async (files: File[]) => {
      const list = Array.from(files || []);
      if (!list.length) return;

      if (busyAny) return;

      const MAX = 20 * 1024 * 1024;
      const okFiles = list.filter((f) => f.size <= MAX);
      const rejected = list.filter((f) => f.size > MAX);

      if (!okFiles.length) {
        const detail = rejected.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join(", ");
        setMsg(rejected.length ? `No se pudieron adjuntar: ${detail}. Máximo: 20 MB por archivo.` : "No se recibió ningún archivo.");
        return;
      }

      try {
        setMsg(null);
        setUploadingAttachments(true);

        const fd = new FormData();
        okFiles.forEach((f) => fd.append("attachments", f));

        const resp = await apiFetch<any>("/company/me/attachments", {
          method: "POST",
          body: fd as any,
          timeoutMs: 120_000,
          on401: "throw",
        });

        const updated = normalizeJewelryResponse(resp) as JewelryProfile;
        setServerJewelry(updated);

        setMsg(
          rejected.length
            ? `Adjuntados ${okFiles.length} archivo(s). Se omitieron ${rejected.length} por tamaño.`
            : "Adjuntos cargados ✅"
        );
        refresh().catch(() => {});
      } catch (e: any) {
        devLog("uploadAttachmentsInstant error", e);
        setMsg(e?.message || "No se pudieron subir los adjuntos.");
      } finally {
        setUploadingAttachments(false);
      }
    },
    [busyAny, refresh]
  );

  const deleteSavedAttachment = useCallback(
    async (id: string) => {
      const attId = String(id || "").trim();
      if (!attId) return;

      if (busyAny) return;

      const prev = savedAttachments;

      setServerJewelry((p) => ({
        ...(p || ({} as JewelryProfile)),
        attachments: (Array.isArray(p?.attachments) ? p.attachments : []).filter((a) => String((a as any)?.id) !== attId),
      }));

      try {
        setDeletingAttId(attId);

        await apiFetch("/company/me/attachments/" + encodeURIComponent(attId), {
          method: "DELETE",
          timeoutMs: 30_000,
          on401: "throw",
        });

        setMsg("Adjunto eliminado ✅");
        refresh().catch(() => {});
      } catch (e: any) {
        devLog("deleteSavedAttachment error", e);
        setMsg(e?.message || "No se pudo eliminar el adjunto.");
        setServerJewelry((p) => ({ ...(p || ({} as JewelryProfile)), attachments: prev }));
      } finally {
        setDeletingAttId(null);
      }
    },
    [isEditMode, busyAny, savedAttachments, refresh]
  );

  // ✅ para el header (logo preview + server)
  const headerLogoSrc = useMemo(() => {
    const server = String(company?.logoUrl || "").trim();
    return (logoPreview || (server ? absUrl(server) : "")) as string;
  }, [logoPreview, company?.logoUrl]);

  const hasLogo = Boolean(headerLogoSrc);

  const initials = getInitials(existing?.name || company?.legalName || "TPTech");
  const readonly = !isEditMode;
  const allowCreate = isEditMode;

  const phone = `${String(existing?.phoneCountry || "").trim()} ${String(existing?.phoneNumber || "").trim()}`.trim();

  const addressLine = [existing?.street, existing?.number].filter(Boolean).join(" ");
  const addressMeta = [existing?.city, existing?.province, existing?.postalCode, existing?.country].filter(Boolean).join(" • ");

  const catIva = cats["IVA_CONDITION"] ?? [];
  const catPrefix = cats["PHONE_PREFIX"] ?? [];
  const catCity = cats["CITY"] ?? [];
  const catProvince = cats["PROVINCE"] ?? [];
  const catCountry = cats["COUNTRY"] ?? [];

  return {
    isEditMode,
    goToViewMode,
    goToEditMode,
    onBackOrCancel,

    loading,
    error,
    refresh,

    serverJewelry,
    existing,
    company,

    dirty,
    saving,
    msg,

    confirmUnsavedOpen,
    setConfirmUnsavedOpen,

    logoInputRef,
    logoPreview,
    logoImgLoading,
    setLogoImgLoading,
    uploadingLogo,
    deletingLogo,

    uploadLogoInstant,
    deleteLogoInstant,

    attInputRef,
    uploadingAttachments,
    deletingAttId,

    uploadAttachmentsInstant,
    deleteSavedAttachment,

    catIva,
    catPrefix,
    catCity,
    catProvince,
    catCountry,
    catLoading,
    ensureCatalog,
    createAndRefresh,

    setExistingField,
    setCompanyField,
    resetToServerValues,
    onSave,
    setMsg,

    savedAttachments,
    canSave,
    headerLogoSrc,
    hasLogo,
    busyAny,
    initials,
    readonly,
    allowCreate,
    phone,
    addressLine,
    addressMeta,
  };
}