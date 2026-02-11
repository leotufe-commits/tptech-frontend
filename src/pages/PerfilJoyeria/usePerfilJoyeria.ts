// src/pages/perfilJoyeria/usePerfilJoyeria.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiFetch } from "../../lib/api";
import { useMe } from "../../hooks/useMe";

import {
  listCatalog,
  createCatalogItem,
  type CatalogItem,
  type CatalogType,
} from "../../services/catalogs";

import type { CompanyBody, ExistingBody, JewelryAttachment } from "./perfilJoyeria.types";
import {
  absUrl,
  buildPayload,
  devLog,
  getInitials,
  jewelryToDraft,
  normalizeJewelryResponse,
  pickJewelryFromMe,
} from "./perfilJoyeria.utils";

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

export function usePerfilJoyeria() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isEditMode = searchParams.get("edit") === "1";

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

  const logoInputRef = useRef<HTMLInputElement>(null!);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoImgLoading, setLogoImgLoading] = useState(false);

  const attInputRef = useRef<HTMLInputElement>(null!);

  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);

  // ================== CATALOGS ==================
  const [catIva, setCatIva] = useState<CatalogItem[]>([]);
  const [catPrefix, setCatPrefix] = useState<CatalogItem[]>([]);
  const [catCity, setCatCity] = useState<CatalogItem[]>([]);
  const [catProvince, setCatProvince] = useState<CatalogItem[]>([]);
  const [catCountry, setCatCountry] = useState<CatalogItem[]>([]);

  const [catLoading, setCatLoading] = useState<Record<string, boolean>>({});

  async function ensureCatalog(type: CatalogType, force = false) {
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

      if (type === "IVA_CONDITION") setCatIva(items);
      else if (type === "PHONE_PREFIX") setCatPrefix(items);
      else if (type === "CITY") setCatCity(items);
      else if (type === "PROVINCE") setCatProvince(items);
      else if (type === "COUNTRY") setCatCountry(items);
    } catch (e: any) {
      setMsg(e?.message || "No se pudo cargar un catálogo.");
    } finally {
      setCatLoading((p) => ({ ...p, [k]: false }));
    }
  }

  async function createAndRefresh(type: CatalogType, label: string) {
    try {
      await createCatalogItem(type, label);
      await ensureCatalog(type, true);
      setMsg(`Agregado “${label}” ✅`);
    } catch (e: any) {
      setMsg(e?.message || "No se pudo agregar el ítem al catálogo.");
    }
  }

  // ================== HIDRATACIÓN ==================
  useEffect(() => {
    if (!jewelryFromContext) return;

    setServerJewelry(jewelryFromContext);

    const d = jewelryToDraft(jewelryFromContext);
    setExisting(d.existing);
    setCompany(d.company);
    setDirty(false);
    setMsg(null);
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

  const savedAttachments: JewelryAttachment[] = useMemo(() => {
    const arr = (serverJewelry?.attachments ?? []) as JewelryAttachment[];
    return Array.isArray(arr) ? arr : [];
  }, [serverJewelry?.attachments]);

  const canSave = useMemo(() => {
    return !!existing && !!company && existing.name.trim().length > 0;
  }, [existing, company]);

  function goToViewMode() {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }

  function goToEditMode() {
    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
    setSearchParams(next, { replace: true });
    setMsg(null);
  }

  function setExistingField<K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) {
    if (!isEditMode) return;
    setDirty(true);
    setExisting((p) => (p ? { ...p, [key]: value } : p));
  }

  function setCompanyField<K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) {
    if (!isEditMode) return;
    if (key !== "logoUrl") setDirty(true);
    setCompany((p) => (p ? { ...p, [key]: value } : p));
  }

  function resetToServerValues() {
    if (!serverJewelry) return;
    const d = jewelryToDraft(serverJewelry);
    setExisting(d.existing);
    setCompany(d.company);
    setDirty(false);
    setMsg(null);

    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview("");
  }

  function onBackOrCancel() {
    const busyAny =
      saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
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
  }

  async function onSave() {
    if (!existing || !company || !isEditMode) return;

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
      goToViewMode();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogoInstant(file: File) {
    if (!isEditMode) return;
    if (!file) return;

    const isImg = String(file.type || "").startsWith("image/");
    if (!isImg) {
      setMsg("El logo debe ser una imagen.");
      return;
    }

    const busy =
      saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
    if (busy) return;

    try {
      setMsg(null);
      setUploadingLogo(true);

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      const blobUrl = URL.createObjectURL(file);
      setLogoPreview(blobUrl);

      const fd = new FormData();
      fd.append("logo", file);

      const resp = await apiFetch<{ ok: boolean; logoUrl: string }>("/company/logo", {
        method: "PUT",
        body: fd as any,
        timeoutMs: 60_000,
        on401: "throw",
      });

      const nextUrl = String(resp?.logoUrl || "");

      setCompany((p) => (p ? { ...p, logoUrl: nextUrl } : p));
      setServerJewelry((p: any) => (p ? { ...p, logoUrl: nextUrl } : p));

      // ✅ el dueño del favicon es AuthContext; acá solo notificamos
      notifyLogoChanged(nextUrl);

      setMsg("Logo actualizado ✅");
    } catch (e: any) {
      devLog("uploadLogoInstant error", e);
      setMsg(e?.message || "No se pudo subir el logo.");

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview("");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function deleteLogoInstant() {
    if (!isEditMode) return;

    const busy =
      saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
    if (busy) return;

    const prevCompanyLogo = String(company?.logoUrl || "");
    const prevServerLogo = String(serverJewelry?.logoUrl || "");

    try {
      setMsg(null);
      setDeletingLogo(true);

      // optimistic UI
      setCompany((p) => (p ? { ...p, logoUrl: "" } : p));
      setServerJewelry((p: any) => (p ? { ...p, logoUrl: "" } : p));

      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview("");

      // ✅ el dueño del favicon es AuthContext; acá solo notificamos
      notifyLogoChanged("");

      await apiFetch<{ ok: boolean }>("/company/logo", {
        method: "DELETE",
        timeoutMs: 30_000,
        on401: "throw",
      });

      setMsg("Logo eliminado ✅");
    } catch (e: any) {
      devLog("deleteLogoInstant error", e);
      setMsg(e?.message || "No se pudo eliminar el logo.");

      // rollback
      setCompany((p) => (p ? { ...p, logoUrl: prevCompanyLogo } : p));
      setServerJewelry((p: any) => (p ? { ...p, logoUrl: prevServerLogo } : p));
      notifyLogoChanged(prevCompanyLogo);
    } finally {
      setDeletingLogo(false);
    }
  }

  async function uploadAttachmentsInstant(files: File[]) {
    if (!isEditMode) return;

    const list = Array.from(files || []);
    if (!list.length) return;

    const busy =
      saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
    if (busy) return;

    const MAX = 20 * 1024 * 1024;
    const okFiles = list.filter((f) => f.size <= MAX);
    const rejected = list.filter((f) => f.size > MAX);

    if (!okFiles.length) {
      const detail = rejected
        .map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
        .join(", ");
      setMsg(
        rejected.length
          ? `No se pudieron adjuntar: ${detail}. Máximo: 20 MB por archivo.`
          : "No se recibió ningún archivo."
      );
      return;
    }

    try {
      setMsg(null);
      setUploadingAttachments(true);

      const fd = new FormData();
      okFiles.forEach((f) => fd.append("attachments", f));

      const resp = await apiFetch<{
        ok: boolean;
        createdCount: number;
        attachments: JewelryAttachment[];
      }>("/company/attachments", {
        method: "PUT",
        body: fd as any,
        timeoutMs: 120_000,
        on401: "throw",
      });

      const next = Array.isArray(resp?.attachments) ? resp.attachments : [];

      setServerJewelry((prev: any) => ({
        ...(prev || {}),
        attachments: next,
      }));

      if (rejected.length) {
        setMsg(`Adjuntados ${okFiles.length} archivo(s). Se omitieron ${rejected.length} por tamaño.`);
      } else {
        setMsg("Adjuntos cargados ✅");
      }
    } catch (e: any) {
      devLog("uploadAttachmentsInstant error", e);
      setMsg(e?.message || "No se pudieron subir los adjuntos.");
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function deleteSavedAttachment(id: string) {
    if (!isEditMode) return;
    const attId = String(id || "").trim();
    if (!attId) return;

    const busy =
      saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);
    if (busy) return;

    const prev = savedAttachments;

    setServerJewelry((p: any) => ({
      ...(p || {}),
      attachments: (Array.isArray(p?.attachments) ? p.attachments : []).filter(
        (a: any) => String(a?.id) !== attId
      ),
    }));

    try {
      setDeletingAttId(attId);

      await apiFetch("/company/attachments/" + encodeURIComponent(attId), {
        method: "DELETE",
        timeoutMs: 30_000,
        on401: "throw",
      });

      setMsg("Adjunto eliminado ✅");
    } catch (e: any) {
      devLog("deleteSavedAttachment error", e);
      setMsg(e?.message || "No se pudo eliminar el adjunto.");
      setServerJewelry((p: any) => ({ ...(p || {}), attachments: prev }));
    } finally {
      setDeletingAttId(null);
    }
  }

  const headerLogoSrc = (logoPreview || absUrl(company?.logoUrl || "")) as string;
  const hasLogo = !!headerLogoSrc;

  const busyAny =
    saving || uploadingLogo || deletingLogo || uploadingAttachments || Boolean(deletingAttId);

  const initials = getInitials(existing?.name || company?.legalName || "TPTech");
  const readonly = !isEditMode;

  const allowCreate = isEditMode;

  const phone = `${String(existing?.phoneCountry || "").trim()} ${String(
    existing?.phoneNumber || ""
  ).trim()}`.trim();

  const addressLine = [existing?.street, existing?.number].filter(Boolean).join(" ");
  const addressMeta = [existing?.city, existing?.province, existing?.postalCode, existing?.country]
    .filter(Boolean)
    .join(" • ");

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
