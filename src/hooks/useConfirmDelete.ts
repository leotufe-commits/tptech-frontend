// src/hooks/useConfirmDelete.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../lib/toast";
import { mapDeleteError } from "../lib/deleteErrorMapper";

type DeleteRequest = {
  entityName: string; // ej: "rol", "usuario", "producto"
  entityLabel?: string; // ej: "Administrador" (nombre del item)
  requireTypeToConfirm?: boolean;

  // Acción real de borrado (la API)
  onDelete: () => Promise<any>;

  // Opcional: refrescar lista / refetch
  onAfterSuccess?: () => void | Promise<void>;

  // Copy opcional
  confirmTitle?: string;
  confirmDescription?: string;
  successMessage?: string;
  dangerHint?: string;
};

export function useConfirmDelete() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [req, setReq] = useState<DeleteRequest | null>(null);

  // ✅ Ref para evitar closures viejos y reducir dependencias
  const reqRef = useRef<DeleteRequest | null>(null);

  useEffect(() => {
    reqRef.current = req;
  }, [req]);

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setReq(null);
    reqRef.current = null;
  }, [loading]);

  const askDelete = useCallback((request: DeleteRequest) => {
    setReq(request);
    reqRef.current = request;
    setOpen(true);
  }, []);

  const confirm = useCallback(async () => {
    const current = reqRef.current;
    if (!current) return;

    try {
      setLoading(true);
      await current.onDelete();

      toast({
        variant: "success",
        title: "Eliminado",
        message:
          current.successMessage ??
          `${current.entityName}${
            current.entityLabel ? ` "${current.entityLabel}"` : ""
          } eliminado correctamente.`,
      });

      // ✅ cerrar antes de refrescar (UX más rápida)
      setOpen(false);
      setReq(null);
      reqRef.current = null;

      if (current.onAfterSuccess) {
        await current.onAfterSuccess();
      }
    } catch (err) {
      const mapped = mapDeleteError(err);
      toast({
        variant: mapped.variant,
        title: mapped.title,
        message: mapped.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const dialogProps = useMemo(() => {
    const label = req?.entityLabel ? `: ${req.entityLabel}` : "";
    return {
      open,
      loading,
      title: req?.confirmTitle ?? `Eliminar ${req?.entityName ?? ""}${label}`,
      description: req?.confirmDescription ?? "Esta acción no se puede deshacer.",
      requireTypeToConfirm: req?.requireTypeToConfirm ?? false,
      dangerHint: req?.dangerHint,
      onClose: close,
      onConfirm: confirm,
    };
  }, [open, loading, req, close, confirm]);

  return {
    askDelete, // lo llamás cuando el usuario toca “Eliminar”
    dialogProps, // lo pasás al <ConfirmDeleteDialog />
    isDeleteOpen: open,
    isDeleting: loading,
    closeDelete: close,
  };
}
