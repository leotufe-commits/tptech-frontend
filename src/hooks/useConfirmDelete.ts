// src/hooks/useConfirmDelete.ts
import { useCallback, useMemo, useState } from "react";
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

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setReq(null);
  }, [loading]);

  const askDelete = useCallback((request: DeleteRequest) => {
    setReq(request);
    setOpen(true);
  }, []);

  const confirm = useCallback(async () => {
    if (!req) return;

    try {
      setLoading(true);
      await req.onDelete();

      toast({
        variant: "success",
        title: "Eliminado",
        message:
          req.successMessage ??
          `${req.entityName}${req.entityLabel ? ` "${req.entityLabel}"` : ""} eliminado correctamente.`,
      });

      setOpen(false);
      setReq(null);

      if (req.onAfterSuccess) {
        await req.onAfterSuccess();
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
  }, [req]);

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
    askDelete,      // lo llamás cuando el usuario toca “Eliminar”
    dialogProps,    // lo pasás al <ConfirmDeleteDialog />
    isDeleteOpen: open,
    isDeleting: loading,
    closeDelete: close,
  };
}
