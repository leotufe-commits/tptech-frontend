// tptech-frontend/src/pages/ConfiguracionSistema.tsx
// ============================================================================
// Configuración del sistema — Fase 1 de reorganización UX/UI.
//
// Estructura visual en 4 secciones (de más usado a más técnico):
//
//   1. CONFIGURACIÓN RÁPIDA — Datos empresa, mis preferencias, tema,
//      visualización y formatos, correos. Punto de entrada limpio.
//
//   2. MOTOR COMERCIAL — Listas, promociones, cupones, descuentos por
//      cantidad, política de precios, impuestos, canales de venta.
//      Sección estratégica destacada (highlight visual).
//
//   3. OPERACIÓN DIARIA — Pagos, envíos, vendedores, plantillas PDF,
//      numeración, etiquetas.
//
//   4. ADMINISTRACIÓN AVANZADA — Usuarios, roles, PIN, informes,
//      rentabilidad, ítems del sistema. COLAPSABLE por default —
//      contenido técnico que el operador frecuente no necesita ver.
//
// Cards agrupados visualmente (1 card → 2+ rutas):
//   · "Visualización y formatos" → Formato numérico + Formato de campos.
//   · "Ítems del sistema"        → Items + Unidades + Categorías.
//
// Rutas eliminadas del menú visual (siguen vivas en el sidebar / router):
//   · /divisas
//   · /inventario/almacenes
//
// Cero cambios en rutas, permisos, lógica o backend. Solo composición
// visual: jerarquía, spacing, agrupación.
// ============================================================================

import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  KeyRound,
  ChevronRight,
  ChevronDown,
  Users,
  Shield,
  Building2,
  Truck,
  Tags,
  Printer,
  Store,
  Database,
  BarChart3,
  Mail,
  BadgePercent,
  PackagePlus,
  ShieldAlert,
  Zap,
  TrendingUp,
  Sliders,
  FileText,
  Ticket,
  Eye,
  Settings2,
  Wallet,
} from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

// ─── Badges ──────────────────────────────────────────────────────────────────

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

// ─── Card individual (1 ruta) ────────────────────────────────────────────────

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
        "shadow-[0_1px_0_0_rgba(0,0,0,0.04)] transition-all duration-150",
        "hover:bg-surface2 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] hover:-translate-y-px",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        active && "ring-1 ring-primary/20 bg-surface2",
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

// ─── Card agrupado (N rutas) — mismo footprint que CardLink, expone sub-links
// ────────────────────────────────────────────────────────────────────────────
// Usado para presentar visualmente como UNA SOLA card lo que son varias
// pantallas relacionadas (ej. Formato numérico + Formato de campos).

function GroupedCardLink({
  title,
  desc,
  icon,
  badge,
  links,
  pathname,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  links: Array<{ to: string; label: string }>;
  pathname: string;
}) {
  // Strip query string del link antes de comparar — sub-chips pueden
  // incluir `?tab=...` (deep-link a tab), pero `pathname` solo trae
  // la ruta sin query.
  const active = links.some((l) => isActivePath(pathname, l.to.split("?")[0]));
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-4",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.04)] transition-shadow duration-150",
        active && "ring-1 ring-primary/20 bg-surface2",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-primary">
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

      {/* Sub-links inline — chips clickeables con flecha discreta. */}
      <ul className="mt-3 grid gap-1.5">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              className={cn(
                "group/sub flex items-center justify-between gap-2 rounded-lg border border-transparent",
                "bg-surface2/50 hover:bg-surface2 hover:border-border px-2.5 py-1.5",
                "text-[12px] font-medium text-text transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
            >
              <span className="truncate">{l.label}</span>
              <ChevronRight
                size={13}
                className="shrink-0 text-muted/60 transition-transform group-hover/sub:translate-x-0.5"
              />
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Sección ────────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  desc,
  highlight,
  collapsible,
  collapsed,
  onToggle,
  cardCount,
}: {
  title: string;
  desc?: string;
  highlight?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  cardCount?: number;
}) {
  const headerContent = (
    <>
      <div
        className={cn(
          "w-1 self-stretch rounded-full shrink-0 mt-0.5",
          highlight ? "bg-primary" : "bg-border",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base font-bold leading-tight text-text">{title}</h2>
          {highlight && <PricingBadge />}
          {collapsible && typeof cardCount === "number" && (
            <span
              className="inline-flex items-center rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted"
              aria-label={`${cardCount} opciones`}
            >
              {cardCount}
            </span>
          )}
        </div>
        {desc && (
          <p className="text-sm text-muted mt-0.5 max-w-xl leading-relaxed">{desc}</p>
        )}
      </div>
      {collapsible && (
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 self-start mt-1 text-muted transition-transform duration-200",
            !collapsed && "rotate-180",
          )}
          aria-hidden
        />
      )}
    </>
  );

  if (collapsible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex items-start gap-3 w-full text-left",
          "rounded-lg hover:bg-surface2/40 px-2 -mx-2 py-1 -my-1 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
        aria-expanded={!collapsed}
      >
        {headerContent}
      </button>
    );
  }
  return <div className="flex items-start gap-3">{headerContent}</div>;
}

function Section({
  title,
  desc,
  highlight,
  collapsible,
  collapsed,
  onToggle,
  cardCount,
  children,
}: {
  title: string;
  desc?: string;
  highlight?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  cardCount?: number;
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

  if (collapsible) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4">
        <SectionHeader
          title={title}
          desc={desc}
          collapsible
          collapsed={collapsed}
          onToggle={onToggle}
          cardCount={cardCount}
        />
        {!collapsed && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
        )}
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

// ─── Datos del menú ─────────────────────────────────────────────────────────

type SingleCard = {
  kind?: "single";
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
};

type GroupedCard = {
  kind: "grouped";
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  /** Rutas internas del grupo — se muestran como sub-chips dentro de la card. */
  links: Array<{ to: string; label: string }>;
};

type Card = SingleCard | GroupedCard;

type SectionCfg = {
  title: string;
  desc?: string;
  highlight?: boolean;
  /** Sección colapsable (se renderea con header clickeable y `<details>`-like
   *  comportamiento). Default false. */
  collapsible?: boolean;
  /** Default collapsed cuando es colapsable. */
  defaultCollapsed?: boolean;
  cards: Card[];
};

export default function ConfiguracionSistema() {
  const { pathname } = useLocation();

  // Estado de colapso por sección (key = section.title). Default colapsado
  // para "Administración avanzada" (definido en la sección via
  // defaultCollapsed: true), expandido para las demás.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    "Administración avanzada": true,
  }));

  const sections: SectionCfg[] = useMemo(
    () => [
      // ── 1. Configuración rápida ──────────────────────────────────────────
      {
        title: "Configuración rápida",
        desc: "Lo que solés ajustar en el día a día: tu empresa, tus preferencias y cómo se ve el sistema.",
        cards: [
          {
            to: "/configuracion/joyeria",
            title: "Datos de la empresa",
            desc: "Logo, datos fiscales, contacto, dirección, notas y adjuntos.",
            icon: <Building2 size={18} />,
          },
          {
            to: "/configuracion/mis-preferencias",
            title: "Mis preferencias",
            desc: "Valores predeterminados del usuario para nuevos comprobantes. Se guardan por usuario y no afectan los cálculos de precios.",
            icon: <Sliders size={18} />,
          },
          // Grupo visual: pantalla unificada con tabs Números/Campos.
          // Cada sub-link apunta a la misma ruta con `?tab=...` para que
          // la pantalla abra ya posicionada en la sección elegida.
          {
            kind: "grouped",
            title: "Visualización y formatos",
            desc: "Cómo se muestran números, montos, teléfonos y documentos en toda la app.",
            icon: <Eye size={18} />,
            links: [
              { to: "/configuracion-sistema/visualizacion-formatos?tab=numeros", label: "Números (formato regional, decimales)" },
              { to: "/configuracion-sistema/visualizacion-formatos?tab=campos",  label: "Campos (teléfono, documento)" },
            ],
          },
          {
            to: "/configuracion-sistema/correos",
            title: "Correos del sistema",
            desc: "Remitente, firma, logo y datos de contacto para emails enviados.",
            icon: <Mail size={18} />,
          },
        ],
      },

      // ── 2. Motor comercial ───────────────────────────────────────────────
      {
        title: "Motor comercial",
        desc: "Cómo se calculan los precios, los descuentos, los impuestos y los canales de venta. Núcleo del negocio.",
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
            to: "/configuracion-sistema/cupones",
            title: "Cupones de descuento",
            desc: "Códigos por evento, cliente o campaña — se aplican al confirmar la venta.",
            icon: <Ticket size={18} />,
          },
          {
            to: "/configuracion-sistema/descuentos-cantidad",
            title: "Descuentos por cantidad",
            desc: "Tramos de descuento automáticos según unidades vendidas.",
            icon: <PackagePlus size={18} />,
          },
          {
            to: "/configuracion-sistema/politica-precios",
            title: "Política comercial",
            desc: "Márgenes recomendados, riesgos a advertir y confirmación reforzada al cerrar ventas.",
            icon: <ShieldAlert size={18} />,
          },
          // Grupo visual: pantalla unificada "Finanzas y cobros" con
          // tabs (Pagos / Impuestos / Cuenta corriente / Canales).
          // Centraliza el dominio financiero/comercial — el operador
          // accede a TODO lo que tiene que ver con cobrar, facturar,
          // calcular impuestos y administrar saldo desde un solo lugar.
          {
            kind: "grouped",
            title: "Finanzas y cobros",
            desc: "Pagos, impuestos, cuenta corriente y canales — cómo TPTech cobra y maneja el flujo financiero.",
            icon: <Wallet size={18} />,
            links: [
              { to: "/configuracion-sistema/finanzas-cobros?tab=pagos",            label: "Pagos y cobros (medios, condiciones, cuotas)" },
              { to: "/configuracion-sistema/finanzas-cobros?tab=impuestos",        label: "Impuestos (IVA, percepciones, retenciones)" },
              { to: "/configuracion-sistema/finanzas-cobros?tab=cuenta-corriente", label: "Cuenta corriente (deuda y saldo)" },
              { to: "/configuracion-sistema/finanzas-cobros?tab=canales",          label: "Canales de venta (Local, Web, Mayorista, etc.)" },
            ],
          },
        ],
      },

      // ── 3. Operación diaria ──────────────────────────────────────────────
      {
        title: "Operación diaria",
        desc: "Parámetros del día a día: despacho, comprobantes, vendedores y etiquetas.",
        cards: [
          {
            to: "/configuracion-sistema/envios",
            title: "Envíos y logística",
            desc: "Transportistas, métodos de envío y costos.",
            icon: <Truck size={18} />,
          },
          {
            to: "/configuracion-sistema/vendedor",
            title: "Vendedores",
            desc: "Comisiones, objetivos y reglas comerciales por vendedor.",
            icon: <Store size={18} />,
          },
          // Grupo visual: pantalla unificada "Documentos y comprobantes"
          // con 2 tabs (Plantillas PDF / Numeración). La tab "Vista previa"
          // fue eliminada en Fase A — el editor de plantillas ya muestra
          // el preview en vivo (idéntico al PDF final para FACTURA).
          {
            kind: "grouped",
            title: "Documentos y comprobantes",
            desc: "Cómo se ven y numeran facturas, presupuestos, remitos y demás comprobantes.",
            icon: <FileText size={18} />,
            links: [
              { to: "/configuracion-sistema/documentos-comprobantes?tab=plantillas", label: "Plantillas PDF (diseño y estilo)" },
              { to: "/configuracion-sistema/documentos-comprobantes?tab=numeracion", label: "Numeración (series, prefijos, próximo número)" },
            ],
          },
          {
            to: "/configuracion-sistema/etiquetas",
            title: "Impresión de etiquetas",
            desc: "Diseño e impresión de etiquetas para artículos.",
            icon: <Printer size={18} />,
          },
        ],
      },

      // ── 4. Administración avanzada (colapsable) ──────────────────────────
      {
        title: "Administración avanzada",
        desc: "Accesos, permisos, catálogos técnicos e informes internos. No se necesitan a diario.",
        collapsible: true,
        defaultCollapsed: true,
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
          {
            to: "/configuracion-sistema/informes",
            title: "Informes",
            desc: "Reportes internos, estadísticas y análisis del negocio.",
            icon: <BarChart3 size={18} />,
          },
          {
            to: "/reportes/rentabilidad",
            title: "Rentabilidad",
            desc: "Análisis de márgenes, costos y rentabilidad por artículo y período.",
            icon: <TrendingUp size={18} />,
          },
          // Grupo visual: pantalla unificada "Ítems del sistema" con
          // tabs (Ítems / Unidades / Categorías). Cada sub-link apunta
          // a la misma ruta con `?tab=...` y preserva `?type=...` para
          // que la tab de Ítems abra ya posicionada en un catálogo.
          {
            kind: "grouped",
            title: "Ítems del sistema",
            desc: "Catálogos base, unidades y categorías que estructuran la app.",
            icon: <Database size={18} />,
            links: [
              { to: "/configuracion-sistema/items-sistema?tab=items&type=DOCUMENT_TYPE", label: "Ítems (tipos de documento, estados, etc.)" },
              { to: "/configuracion-sistema/items-sistema?tab=unidades",                 label: "Unidades (venta, peso, volumen)" },
              { to: "/configuracion-sistema/items-sistema?tab=categorias",               label: "Categorías de artículos" },
            ],
          },
        ],
      },
    ],
    [],
  );

  const renderCard = (c: Card) => {
    if (c.kind === "grouped") {
      return (
        <GroupedCardLink
          key={c.title}
          title={c.title}
          desc={c.desc}
          icon={c.icon}
          badge={c.badge}
          links={c.links}
          pathname={pathname}
        />
      );
    }
    return (
      <CardLink
        key={c.to}
        to={c.to}
        title={c.title}
        desc={c.desc}
        icon={c.icon}
        badge={c.badge}
        active={isActivePath(pathname, c.to)}
      />
    );
  };

  return (
    <div className="p-6 w-full max-w-screen-2xl">
      {/* Page header */}
      <div className="mb-10 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface2 text-primary">
          <Settings2 size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
            Configuración
          </p>
          <h1 className="text-2xl font-bold text-text leading-tight">Configuración del sistema</h1>
          <p className="text-sm text-muted mt-1.5 max-w-2xl leading-relaxed">
            Centro de control de la joyería. Empezá por <span className="font-medium text-text">Configuración rápida</span>; el resto se profundiza a medida que lo necesites.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {sections.map((s) => {
          const isCollapsed =
            s.collapsible
              ? (collapsed[s.title] ?? s.defaultCollapsed ?? false)
              : false;
          return (
            <Section
              key={s.title}
              title={s.title}
              desc={s.desc}
              highlight={s.highlight}
              collapsible={s.collapsible}
              collapsed={isCollapsed}
              onToggle={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [s.title]: !(prev[s.title] ?? s.defaultCollapsed ?? false),
                }))
              }
              cardCount={s.cards.length}
            >
              {s.cards.map(renderCard)}
            </Section>
          );
        })}
      </div>
    </div>
  );
}
