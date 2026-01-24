import { ReactNode } from "react";
import { usePermissions } from "../hooks/usePermissions";

type Props = {
  any?: string[];        // AL MENOS UNO
  permission?: string;  // EXACTO
  children: ReactNode;
};

export function RequirePermission({ any, permission, children }: Props) {
  const { can, canAny, loading } = usePermissions();

  if (loading) return null;

  if (permission && !can(permission)) return null;
  if (any && !canAny(any)) return null;

  return <>{children}</>;
}
