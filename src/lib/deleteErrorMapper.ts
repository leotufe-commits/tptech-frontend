// src/lib/deleteErrorMapper.ts
type ApiErrorLike =
  | {
      message?: string;
      code?: string;
      statusCode?: number;
      status?: number;
      details?: any;
    }
  | Error
  | unknown;

export type DeleteErrorResult = {
  title: string;
  message: string;
  variant: "error" | "warning";
};

/**
 * Intenta inferir códigos típicos:
 * - IN_USE / FK_CONSTRAINT / P2003 / FOREIGN_KEY
 * - FORBIDDEN / 403
 * - NOT_FOUND / 404
 * - VALIDATION / 400
 */
export function mapDeleteError(err: ApiErrorLike): DeleteErrorResult {
  const anyErr = err as any;

  const rawMessage =
    (typeof anyErr?.message === "string" && anyErr.message) ||
    (typeof anyErr?.error === "string" && anyErr.error) ||
    (typeof anyErr?.data?.message === "string" && anyErr.data.message) ||
    "";

  const code =
    (typeof anyErr?.code === "string" && anyErr.code) ||
    (typeof anyErr?.data?.code === "string" && anyErr.data.code) ||
    "";

  const status =
    (typeof anyErr?.status === "number" && anyErr.status) ||
    (typeof anyErr?.statusCode === "number" && anyErr.statusCode) ||
    (typeof anyErr?.data?.statusCode === "number" && anyErr.data.statusCode) ||
    undefined;

  const msg = (rawMessage || "").toLowerCase();
  const c = (code || "").toLowerCase();

  // En uso / constraint / FK / Prisma P2003
  const inUse =
    c.includes("in_use") ||
    c.includes("fk") ||
    c.includes("foreign") ||
    c.includes("p2003") ||
    msg.includes("foreign key") ||
    msg.includes("constraint") ||
    msg.includes("referenc");

  if (inUse) {
    return {
      title: "No se puede eliminar",
      message: "Este registro está en uso o asociado a otros movimientos.",
      variant: "warning",
    };
  }

  if (status === 403 || c.includes("forbidden")) {
    return {
      title: "Acceso denegado",
      message: "No tenés permisos para eliminar esto.",
      variant: "warning",
    };
  }

  if (status === 404 || c.includes("not_found")) {
    return {
      title: "No encontrado",
      message: "El registro ya no existe o fue eliminado previamente.",
      variant: "warning",
    };
  }

  if (status === 400 || c.includes("validation") || c.includes("bad_request")) {
    return {
      title: "No se pudo eliminar",
      message: "Hay un problema con los datos. Revisá e intentá nuevamente.",
      variant: "warning",
    };
  }

  return {
    title: "Error al eliminar",
    message: "Ocurrió un error. Intentá nuevamente.",
    variant: "error",
  };
}
