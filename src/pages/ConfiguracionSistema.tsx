// tptech-frontend/src/pages/ConfiguracionSistema.tsx
import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  KeyRound,
  ChevronRight,
  Palette,
  Users,
  Shield,
  Building2,
  Landmark,
  Boxes,
  Receipt,
  CreditCard,
  Truck,
  Tags,
  Layers,
  Hash,
  Printer,
  Store,
  Database,
  BarChart3,
  LayoutGrid,
} from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}

function CardLink({
  to,
  title,
  desc,
  icon,
  active,
  badge,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "group block rounded-2xl border border-border bg-card p-4",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)] transition",
        "hover:bg-surface2 hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        active && "ring-1 ring-primary/15"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface2 text-primary">
            {icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold text-text truncate">{title}</div>
              {badge}
            </div>

            <div className="text-sm text-muted mt-0.5">{desc}</div>
          </div>
        </div>

        <ChevronRight
          size={18}
          className="mt-1 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-text"
        />
      </div>
    </NavLink>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="text-sm text-muted mt-1">{desc}</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

type Card = {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
};

type SectionCfg = { title: string; desc?: string; cards: Card[] };

export default function ConfiguracionSistema() {
  const { pathname } = useLocation();

  const sections: SectionCfg[] = useMemo(
    () => [
      {
        title: "Empresa",
        desc: "Configuraciones generales y fiscales de la joyería.",
        cards: [
          {
            to: "/configuracion/joyeria",
            title: "Datos de la empresa",
            desc: "Logo, datos fiscales, contacto, dirección, notas y adjuntos.",
            icon: <Building2 size={20} />,
          },
          {
            to: "/inventario/almacenes",
            title: "Almacenes",
            desc: "Alta y gestión de almacenes, activación y favoritos.",
            icon: <Boxes size={20} />,
          },
          {
            to: "/divisas",
            title: "Divisas",
            desc: "Monedas y tipos de cambio para operar en multi-moneda.",
            icon: <Landmark size={20} />,
          },
        ],
      },
      {
        title: "Usuarios y seguridad",
        desc: "Control de accesos, permisos y bloqueo del sistema.",
        cards: [
          {
            to: "/configuracion/usuarios",
            title: "Usuarios",
            desc: "Alta, edición, estados y configuración de acceso por usuario.",
            icon: <Users size={20} />,
          },
          {
            to: "/configuracion/roles",
            title: "Roles y permisos",
            desc: "Definí roles, permisos por módulo y overrides por usuario.",
            icon: <Shield size={20} />,
          },
          {
            to: "/configuracion-sistema/pin",
            title: "Configurar PIN",
            desc: "Política general del sistema. Paso final: habilitar PIN por usuario en Usuarios → Editar.",
            icon: <KeyRound size={20} />,
            badge: <Pill>2 niveles</Pill>,
          },
        ],
      },
      {
        title: "Operaciones",
        desc: "Reglas comerciales del negocio y parámetros del día a día.",
        cards: [
          {
            to: "/configuracion-sistema/vendedor",
            title: "Vendedor",
            desc: "Parámetros de vendedor, comisiones, objetivos y reglas comerciales.",
            icon: <Store size={20} />,
          },
          {
            to: "/configuracion-sistema/impuestos",
            title: "Impuestos y tributos",
            desc: "Impuestos, alícuotas, percepciones/retenciones y configuración fiscal.",
            icon: <Receipt size={20} />,
          },
          {
            to: "/configuracion-sistema/pagos",
            title: "Pagos y cobros",
            desc: "Medios de pago, condiciones, recargos/descuentos y cuotas.",
            icon: <CreditCard size={20} />,
          },
          {
            to: "/configuracion-sistema/envios",
            title: "Envíos y logística",
            desc: "Transportistas, métodos de envío, costos y parámetros.",
            icon: <Truck size={20} />,
          },
          {
            to: "/configuracion-sistema/listas-precios",
            title: "Listas de precios",
            desc: "Administración de listas, márgenes y reglas.",
            icon: <Tags size={20} />,
          },
          {
            to: "/configuracion-sistema/categorias",
            title: "Categorías de artículos",
            desc: "Estructura del catálogo y organización.",
            icon: <Layers size={20} />,
          },
        ],
      },
      {
        title: "Administración del sistema",
        desc: "Estructura base, catálogos y análisis.",
        cards: [
          {
            to: "/configuracion-sistema/items",
            title: "Ítems del sistema",
            desc: "Catálogos base utilizados por todo el sistema (combos y selecciones).",
            icon: <Database size={20} />,
          },
          {
            to: "/configuracion-sistema/informes",
            title: "Informes",
            desc: "Reportes, estadísticas y análisis del negocio.",
            icon: <BarChart3 size={20} />,
          },
        ],
      },
      {
        title: "Documentos",
        desc: "Plantillas, numeración e impresión.",
        cards: [
          {
            to: "/configuracion-sistema/numeracion",
            title: "Numeración de comprobantes",
            desc: "Series, prefijos y numeración por documento.",
            icon: <Hash size={20} />,
          },
          {
            to: "/configuracion-sistema/etiquetas",
            title: "Impresión de etiquetas",
            desc: "Diseño e impresión de etiquetas.",
            icon: <Printer size={20} />,
          },
        ],
      },
      {
        title: "Apariencia",
        desc: "Preferencias visuales del sistema.",
        cards: [
          {
            to: "/configuracion-sistema/tema",
            title: "Tema",
            desc: "Elegí el estilo visual del sistema.",
            icon: <Palette size={20} />,
          },
          // ✅ FIX RUTA: coincide con router.tsx
          {
            to: "/configuracion/apariencia/ui",
            title: "UI (Catálogo)",
            desc: "Ver todos los componentes y estilos reales para decidir qué personalizar.",
            icon: <LayoutGrid size={20} />,
            badge: <Pill>dev</Pill>,
          },
        ],
      },
    ],
    []
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-sm text-muted">Configuración</div>
        <h1 className="text-2xl font-bold text-text">Configuración del sistema</h1>
        <div className="text-sm text-muted mt-1">
          Administrá la estructura de la empresa, accesos de usuarios y preferencias del sistema.
        </div>
      </div>

      <div className="space-y-10">
        {sections.map((s) => (
          <Section key={s.title} title={s.title} desc={s.desc}>
            {s.cards.map((c) => (
              <CardLink
                key={c.to}
                to={c.to}
                title={c.title}
                desc={c.desc}
                icon={c.icon}
                badge={c.badge}
                active={isActivePath(pathname, c.to)}
              />
            ))}
          </Section>
        ))}
      </div>
    </div>
  );
}
