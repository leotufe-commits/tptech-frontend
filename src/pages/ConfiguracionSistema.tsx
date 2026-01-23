// tptech-frontend/src/pages/ConfiguracionSistema.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { KeyRound, ChevronRight, Palette, Users, Shield, Building2, Landmark, Boxes } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}

export default function ConfiguracionSistema() {
  const location = useLocation();

  const inPin = location.pathname.startsWith("/configuracion-sistema/pin");
  const inTheme = location.pathname.startsWith("/configuracion-sistema/tema");

  const inUsers = location.pathname.startsWith("/configuracion/usuarios");
  const inRoles = location.pathname.startsWith("/configuracion/roles");
  const inCompany = location.pathname.startsWith("/configuracion/joyeria");

  const inWarehouses = location.pathname.startsWith("/inventario/almacenes");
  const inCurrencies = location.pathname.startsWith("/divisas");

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
        {/* ================= EMPRESA ================= */}
        <Section title="Empresa" desc="Configuraciones generales y fiscales de la joyería.">
          <CardLink
            to="/configuracion/joyeria"
            title="Datos de la empresa"
            desc="Logo, datos fiscales, contacto, dirección, notas y adjuntos."
            icon={<Building2 size={20} />}
            active={inCompany}
          />

          <CardLink
            to="/inventario/almacenes"
            title="Almacenes"
            desc="Alta y gestión de almacenes, activación y favoritos."
            icon={<Boxes size={20} />}
            active={inWarehouses}
          />

          <CardLink
            to="/divisas"
            title="Divisas"
            desc="Monedas y tipos de cambio para operar en multi-moneda."
            icon={<Landmark size={20} />}
            active={inCurrencies}
          />
        </Section>

        {/* ================= USUARIOS ================= */}
        <Section title="Usuarios y seguridad" desc="Control de accesos, permisos y bloqueo del sistema.">
          <CardLink
            to="/configuracion/usuarios"
            title="Usuarios"
            desc="Alta, edición, estados y configuración de acceso por usuario."
            icon={<Users size={20} />}
            active={inUsers}
          />

          <CardLink
            to="/configuracion/roles"
            title="Roles y permisos"
            desc="Definí roles, permisos por módulo y overrides por usuario."
            icon={<Shield size={20} />}
            active={inRoles}
          />

          <CardLink
            to="/configuracion-sistema/pin"
            title="Configurar PIN"
            desc="Política general del sistema. Paso final: habilitar PIN por usuario en Usuarios → Editar."
            icon={<KeyRound size={20} />}
            active={inPin}
            badge={<Pill>2 niveles</Pill>}
          />
        </Section>

        {/* ================= APARIENCIA ================= */}
        <Section title="Apariencia" desc="Preferencias visuales del sistema.">
          <CardLink
            to="/configuracion-sistema/tema"
            title="Tema"
            desc="Elegí el estilo visual del sistema (por usuario)."
            icon={<Palette size={20} />}
            active={inTheme}
          />
        </Section>
      </div>
    </div>
  );
}
