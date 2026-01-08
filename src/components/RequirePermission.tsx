import { ReactNode } from "react";
import { usePermissions } from "../hooks/usePermissions";

type Props = {
  permission: string;
  children: ReactNode;
};

export function RequirePermission({ permission, children }: Props) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(permission)) return null;

  return <>{children}</>;
}
