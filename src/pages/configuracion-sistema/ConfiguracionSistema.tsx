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
  Mail,
  BadgePercent,
  PackagePlus,
  ShieldAlert,
  Zap,
  TrendingUp,
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

function PricingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
      <Zap size={10} />
      Motor de precios
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
        "group flex flex-col rounded-2xl border border-border bg-card p-4",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)] transition-all duration-150",
        "hover:bg-surface2 hover:shadow-[0_6px_18px_rgba(0,0,0,0.09)] hover:-translate-y-px",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        active && "ring-1 ring-primary/20 bg-surface2"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-primary group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text truncate">{title}</span>
              {badge}
            </div>
            <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>
          </div>
        </div>

        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 text-muted/50 transition-all group-hover:translate-x-0.5 group-hover:text-text"
        />
      </div>
    </NavLink>
  );
}

function SectionHeader({
  title,
  desc,
  highlight,
}: {
  title: string;
  desc?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", highlight && "")}>
      <div
        className={cn(
          "w-1 self-stretch rounded-full shrink-0 mt-0.5",
          highlight ? "bg-primary" : "bg-border"
        )}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2
            className={cn(
              "text-base font-bold leading-tight",
              highlight ? "text-text" : "text-text"
            )}
          >
            {title}
          </h2>
          {highlight && <PricingBadge />}
        </div>
        {desc && (
          <p className="text-sm text-muted mt-0.5 max-w-xl leading-relaxed">{desc}</p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  highlight,
  children,
}: {
  title: string;
  desc?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  if (highlight) {
    return (
      <section className="rounded-2xl border border-primary/15 bg-primary/[0.025] p-5 space-y-4">
        <SectionHeader title={title} desc={desc} highlight />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <SectionHeader title={title} desc={desc} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
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

type SectionCfg = {
  title: string;
  desc?: string;
  highlight?: boolean;
  cards: Card[];
};

export default function ConfiguracionSistema() {
  const { pathname } = useLocation();

  const sections: SectionCfg[] = useMemo(
    () => [
      {
        title: "Empresa",
        desc: "Datos generales, fiscales y de comunicación de la joyería.",
        cards: [
          {
            to: "/configuracion/joyeria",
            title: "Datos de la empresa",
            desc: "Logo, datos fiscales, contacto, dirección, notas y adjuntos.",
            icon: <Building2 size={18} />,
          },
          {
            to: "/configuracion-sistema/correos",
            title: "Correos del sistema",
            desc: "Remitente, firma, logo y datos de contacto para emails.",
            icon: <Mail size={18} />,
          },
          {
            to: "/inventario/almacenes",
            title: "Almacenes",
            desc: "Alta y gestión de almacenes, activación y favoritos.",
            icon: <Boxes size={18} />,
          },
          {
            to: "/divisas",
            title: "Divisas",
            desc: "Monedas y tipos de cambio para operar en multi-moneda.",
            icon: <Landmark size={18} />,
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
            icon: <Users size={18} />,
          },
          {
            to: "/configuracion/roles",
            title: "Roles y permisos",
            desc: "Definí roles, permisos por módulo y overrides por usuario.",
            icon: <Shield size={18} />,
          },
          {
            to: "/configuracion-sistema/pin",
            title: "Configurar PIN",
            desc: "Política de bloqueo y acceso rápido entre usuarios.",
            icon: <KeyRound size={18} />,
            badge: <Pill>2 niveles</Pill>,
          },
        ],
      },
      {
        title: "Precios y reglas comerciales",
        desc: "Definí cómo se calculan los precios, descuentos, promociones y reglas de control.",
        highlight: true,
        cards: [
          {
            to: "/configuracion-sistema/listas-precios",
            title: "Listas de precios",
            desc: "Márgenes y reglas de aplicación por cliente o categoría.",
            icon: <Tags size={18} />,
          },
          {
            to: "/configuracion-sistema/promociones",
            title: "Promociones",
            desc: "Descuentos por tiempo o evento, con prioridad máxima en el POS.",
            icon: <BadgePercent size={18} />,
          },
          {
            to: "/configuracion-sistema/descuentos-cantidad",
            title: "Descuentos por cantidad",
            desc: "Tramos de descuento automáticos según unidades vendidas.",
            icon: <PackagePlus size={18} />,
          },
          {
            to: "/configuracion-sistema/politica-precios",
            title: "Política de precios",
            desc: "Alertas de margen y bloqueos de confirmación de ventas.",
            icon: <ShieldAlert size={18} />,
          },
        ],
      },
      {
        title: "Producto",
        desc: "Estructura y organización del catálogo de artículos.",
        cards: [
          {
            to: "/configuracion-sistema/categorias",
            title: "Categorías de artículos",
            desc: "Jerarquía del catálogo, atributos por categoría y lista de precios por defecto.",
            icon: <Layers size={18} />,
          },
        ],
      },
      {
        title: "Operación",
        desc: "Parámetros del día a día: vendedores, cobros, envíos e impuestos.",
        cards: [
          {
            to: "/configuracion-sistema/vendedor",
            title: "Vendedor",
            desc: "Comisiones, objetivos y reglas comerciales por vendedor.",
            icon: <Store size={18} />,
          },
          {
            to: "/configuracion-sistema/pagos",
            title: "Pagos y cobros",
            desc: "Medios de pago, condiciones, recargos y cuotas.",
            icon: <CreditCard size={18} />,
          },
          {
            to: "/configuracion-sistema/envios",
            title: "Envíos y logística",
            desc: "Transportistas, métodos de envío y costos.",
            icon: <Truck size={18} />,
          },
          {
            to: "/configuracion-sistema/impuestos",
            title: "Impuestos y tributos",
            desc: "Alícuotas, percepciones, retenciones y configuración fiscal.",
            icon: <Receipt size={18} />,
          },
        ],
      },
      {
        title: "Sistema",
        desc: "Catálogos base, reportes y análisis del negocio.",
        cards: [
          {
            to: "/configuracion-sistema/items?type=DOCUMENT_TYPE",
            title: "Ítems del sistema",
            desc: "Catálogos utilizados en combos y selecciones de todo el sistema.",
            icon: <Database size={18} />,
          },
          {
            to: "/configuracion-sistema/informes",
            title: "Informes",
            desc: "Reportes, estadísticas y análisis del negocio.",
            icon: <BarChart3 size={18} />,
          },
          {
            to: "/reportes/rentabilidad",
            title: "Rentabilidad",
            desc: "Análisis de márgenes, costos y rentabilidad por artículo y período.",
            icon: <TrendingUp size={18} />,
          },
        ],
      },
      {
        title: "Documentos",
        desc: "Numeración, plantillas e impresión de comprobantes y etiquetas.",
        cards: [
          {
            to: "/configuracion-sistema/numeracion",
            title: "Numeración de comprobantes",
            desc: "Series, prefijos y numeración por tipo de documento.",
            icon: <Hash size={18} />,
          },
          {
            to: "/configuracion-sistema/etiquetas",
            title: "Impresión de etiquetas",
            desc: "Diseño e impresión de etiquetas para artículos.",
            icon: <Printer size={18} />,
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
            icon: <Palette size={18} />,
          },
          {
            to: "/configuracion/apariencia/ui",
            title: "UI (Catálogo)",
            desc: "Ver todos los componentes y estilos reales del sistema.",
            icon: <LayoutGrid size={18} />,
            badge: <Pill>dev</Pill>,
          },
        ],
      },
    ],
    []
  );

  return (
    <div className="p-6 w-full max-w-screen-2xl">
      {/* Page header */}
      <div className="mb-10">
        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
          Configuración
        </p>
        <h1 className="text-2xl font-bold text-text">Configuración del sistema</h1>
        <p className="text-sm text-muted mt-1.5 max-w-xl">
          Administrá la estructura de la empresa, accesos de usuarios y preferencias del sistema.
        </p>
      </div>

      <div className="space-y-12">
        {sections.map((s) => (
          <Section key={s.title} title={s.title} desc={s.desc} highlight={s.highlight}>
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
