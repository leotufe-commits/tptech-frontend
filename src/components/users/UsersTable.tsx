import React, { useRef } from "react";
import {
  Loader2,
  Pencil,
  Trash2,
  ShieldBan,
  ShieldCheck,
  CheckSquare,
  Square,
} from "lucide-react";

import { cn, Badge, initialsFrom } from "./users.ui";

import { TPUserStatusBadge } from "../ui/TPBadges";

import {
  TPTableWrap,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../ui/TPTable";

import type { UserListItem } from "../../services/users";

type Props = {
  loading: boolean;
  users: UserListItem[];
  totalLabel: string;

  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;

  // selection
  selectedIds: Record<string, boolean>;
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
  selectableIdsOnPageCount: number;
  toggleAllOnPage: () => void;
  toggleOne: (id: string) => void;
  isSelectableUserId: (id: string) => boolean;

  // perms
  canAdmin: boolean;
  canEditStatus: boolean;
  meId?: string | null;

  // helpers
  roleLabel: (r: any) => string;
  warehouseLabelById: (id?: string | null) => string | null;

  // avatar quick edit
  avatarQuickBusyId: string | null;
  quickChangeAvatar: (userId: string, file: File) => Promise<void>;

  // actions
  toggleStatus: (u: UserListItem) => Promise<void>;
  openEdit: (u: UserListItem) => Promise<void>;
  askDelete: (u: UserListItem) => void;

  // prefetch
  prefetchUserDetail: (id: string) => Promise<any>;
};

export default function UsersTable(props: Props) {
  const {
    loading,
    users,
    totalLabel,
    page,
    totalPages,
    onPrev,
    onNext,

    selectedIds,
    allOnPageSelected,
    someOnPageSelected,
    selectableIdsOnPageCount,
    toggleAllOnPage,
    toggleOne,
    isSelectableUserId,

    canAdmin,
    canEditStatus,
    meId,

    roleLabel,
    warehouseLabelById,

    avatarQuickBusyId,
    quickChangeAvatar,

    toggleStatus,
    openEdit,
    askDelete,

    prefetchUserDetail,
  } = props;

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const iconBtnBase =
    "inline-flex items-center justify-center rounded-lg border border-border bg-card " +
    "h-9 w-9 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const disabledCls = "opacity-40 cursor-not-allowed hover:bg-card";

  return (
    <TPTableWrap className="w-full">
      <TPTableEl>
        <table className="min-w-[1020px] w-full text-sm">
          <TPThead>
            <tr className="border-b border-border">
              <TPTh className="text-left w-[56px]">
                <button
                  type="button"
                  className={cn(
                    "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-surface2",
                    (loading || selectableIdsOnPageCount === 0) && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={loading || selectableIdsOnPageCount === 0}
                  onClick={toggleAllOnPage}
                  title="Seleccionar todos (página)"
                >
                  {allOnPageSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : someOnPageSelected ? (
                    <CheckSquare className="h-4 w-4 opacity-60" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </TPTh>

              <TPTh className="text-left">Usuario</TPTh>
              <TPTh className="text-left">Estado</TPTh>
              <TPTh className="text-left">Roles</TPTh>
              <TPTh className="text-left">Almacén favorito</TPTh>
              <TPTh className="text-right">Acciones</TPTh>
            </tr>
          </TPThead>

          <TPTbody>
            {loading ? (
              <tr>
                <td className="px-5 py-4" colSpan={6}>
                  Cargando…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <TPEmptyRow colSpan={6} text="Sin resultados." />
            ) : (
              users.map((u) => {
                const label = u.name?.trim() || u.email || "Usuario";
                const initials = initialsFrom(label);
                const favLabel = warehouseLabelById(u.favoriteWarehouseId);
                const busy = avatarQuickBusyId === u.id;

                const isActive = u.status === "ACTIVE";
                const canToggleThis = canEditStatus && !(meId && u.id === meId);

                const checked = !!selectedIds[u.id];
                const selectable = isSelectableUserId(u.id);

                return (
                  <TPTr key={u.id} className="border-t border-border">
                    <TPTd>
                      <button
                        type="button"
                        className={cn(
                          "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-surface2",
                          (!selectable || loading) && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={!selectable || loading}
                        onClick={() => toggleOne(u.id)}
                        title={!selectable ? "No disponible" : "Seleccionar"}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </TPTd>

                    <TPTd>
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-border bg-surface">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt="Avatar"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                              {initials}
                            </div>
                          )}

                          {canAdmin && (
                            <button
                              type="button"
                              className={cn(
                                "absolute inset-0",
                                "opacity-0 hover:opacity-100 transition-opacity",
                                "bg-black/30"
                              )}
                              title="Click para cambiar avatar"
                              onClick={() => {
                                if (busy || loading) return;
                                if (!avatarInputRef.current) return;
                                avatarInputRef.current.setAttribute("data-userid", u.id);
                                avatarInputRef.current.click();
                              }}
                            >
                              <span className="sr-only">Cambiar avatar</span>
                              <div className="h-full w-full grid place-items-center text-white text-xs">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar"}
                              </div>
                            </button>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold truncate">{u.name || "Sin nombre"}</div>
                          <div className="text-xs text-muted truncate">{u.email}</div>
                        </div>
                      </div>
                    </TPTd>

                    <TPTd>
                      {u.status === "ACTIVE" ? (
                        <TPUserStatusBadge status={u.status} />
                      ) : (
                        <Badge>Inactivo</Badge>
                      )}
                    </TPTd>

                    <TPTd>
                      <div className="flex flex-wrap gap-2">
                        {(u.roles || []).length ? (
                          (u.roles || []).map((r) => (
                            <Badge key={(r as any).id}>{roleLabel(r as any)}</Badge>
                          ))
                        ) : (
                          <span className="text-muted">Sin roles</span>
                        )}
                      </div>
                    </TPTd>

                    <TPTd>
                      {u.favoriteWarehouseId ? (
                        <Badge>⭐ {favLabel ? favLabel : u.favoriteWarehouseId}</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TPTd>

                    <TPTd className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className={cn(iconBtnBase, !canToggleThis && disabledCls)}
                          type="button"
                          disabled={!canToggleThis}
                          onClick={() => (canToggleThis ? void toggleStatus(u) : null)}
                          title={
                            !canEditStatus
                              ? "Sin permisos para cambiar estado"
                              : meId && u.id === meId
                              ? "No podés cambiar tu propio estado"
                              : isActive
                              ? "Inactivar usuario"
                              : "Activar usuario"
                          }
                        >
                          {isActive ? (
                            <ShieldBan className="h-4 w-4" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          className={cn(iconBtnBase, !canAdmin && disabledCls)}
                          type="button"
                          disabled={!canAdmin}
                          onClick={() => (canAdmin ? void openEdit(u) : null)}
                          onMouseEnter={() => (canAdmin ? void prefetchUserDetail(u.id) : null)}
                          title={!canAdmin ? "Sin permisos de administrador" : "Editar usuario"}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          className={cn(iconBtnBase, (!canAdmin || meId === u.id) && disabledCls)}
                          type="button"
                          disabled={!canAdmin || meId === u.id}
                          onClick={() => (canAdmin ? askDelete(u) : null)}
                          title={
                            !canAdmin
                              ? "Sin permisos de administrador"
                              : meId === u.id
                              ? "No podés eliminar tu propio usuario"
                              : "Eliminar usuario"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TPTd>
                  </TPTr>
                );
              })
            )}
          </TPTbody>
        </table>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            const uid = avatarInputRef.current?.getAttribute("data-userid");
            if (f && uid) void quickChangeAvatar(uid, f);
          }}
        />
      </TPTableEl>

      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-muted">{totalLabel}</div>

        <div className="flex items-center justify-end gap-2">
          <button
            className={cn("tp-btn", page <= 1 && "opacity-50 cursor-not-allowed")}
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
          >
            Anterior
          </button>

          <div className="text-xs text-muted">
            Página <span className="font-semibold text-text">{page}</span> / {totalPages}
          </div>

          <button
            className={cn("tp-btn", page >= totalPages && "opacity-50 cursor-not-allowed")}
            type="button"
            disabled={page >= totalPages}
            onClick={onNext}
          >
            Siguiente
          </button>
        </div>
      </div>
    </TPTableWrap>
  );
}
