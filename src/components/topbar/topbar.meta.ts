// src/components/topbar/topbar.meta.ts
export type RouteMeta = {
  title: string;
  crumbs: { label: string; to?: string }[];
};

export const getTopbarMeta = (pathname: string): RouteMeta => {
  const p = (pathname || "/").toLowerCase();

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { title: "Dashboard", crumbs: [{ label: "Dashboard" }] };
  }

  if (p.startsWith("/configuracion-sistema")) {
    if (p.startsWith("/configuracion-sistema/pin")) {
      return {
        title: "Configurar PIN",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Configuración", to: "/configuracion-sistema" },
          { label: "PIN" },
        ],
      };
    }
    if (p.startsWith("/configuracion-sistema/tema")) {
      return {
        title: "Tema",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Configuración", to: "/configuracion-sistema" },
          { label: "Tema" },
        ],
      };
    }

    return {
      title: "Configuración del sistema",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Configuración" }],
    };
  }

  if (p.startsWith("/configuracion")) {
    return {
      title: "Configuración",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Configuración" }],
    };
  }

  if (p.startsWith("/divisas")) {
    return {
      title: "Divisas",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Divisas" }],
    };
  }

  return { title: "TPTech", crumbs: [{ label: "Dashboard", to: "/dashboard" }] };
};

export default getTopbarMeta;
