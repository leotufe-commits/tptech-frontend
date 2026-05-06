// src/components/sidebar/sidebar.nav.ts
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Settings,
  Upload,
  Wallet,
  BarChart3,
} from "lucide-react";

// ✅ IMPORT SIN EXTENSIÓN (correcto para Vite + TS)
import type { IconType } from "./sidebar.icons";
import { GoldBarsIcon } from "./sidebar.icons";

export type GroupItem = { label: string; to: string; quickCreate?: string };

export type NavItem =
  | { kind: "link"; label: string; to: string; icon?: IconType }
  | { kind: "group"; label: string; icon?: IconType; children: GroupItem[] }
  | { kind: "divider" };

export const SIDEBAR_NAV: NavItem[] = [
  { kind: "link", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { kind: "link", label: "Divisas", to: "/divisas", icon: GoldBarsIcon },

  { kind: "divider" },

  {
    kind: "group",
    label: "Artículos",
    icon: Boxes,
    children: [
      { label: "Artículos",           to: "/articulos/articulos",              quickCreate: "articulos"        },
      { label: "Grupos de artículos", to: "/articulos/grupos",                 quickCreate: "grupos-articulos" },
      { label: "Simulador de precios", to: "/herramientas/simulador-precios" },
    ],
  },

  {
    kind: "group",
    label: "Inventario",
    icon: Package,
    children: [
      { label: "Movimientos (artículos)", to: "/inventario/movimientos-articulos", quickCreate: "movimientos-articulos" },
      { label: "Movimientos (metales)",   to: "/inventario/movimientos" },
      { label: "Almacenes",               to: "/inventario/almacenes",             quickCreate: "almacenes" },
      { label: "Stock por depósito",      to: "/inventario/stock" },
      { label: "Reposición",              to: "/inventario/reposicion" },
    ],
  },

  {
    kind: "group",
    label: "Ventas",
    icon: ShoppingCart,
    children: [
      { label: "Clientes",         to: "/ventas/clientes",         quickCreate: "clientes" },
      { label: "Presupuestos",     to: "/ventas/presupuestos" },
      { label: "Órdenes de venta", to: "/ventas/ordenes" },
      { label: "Entregas",         to: "/ventas/entregas" },
      { label: "Facturas",         to: "/ventas/facturas" },
      { label: "Cobros",           to: "/ventas/cobros" },
      { label: "Notas de crédito", to: "/ventas/notas-credito" },
      { label: "Devoluciones",     to: "/ventas/devoluciones" },
    ],
  },

  {
    kind: "group",
    label: "Compras",
    icon: ShoppingBag,
    children: [
      { label: "Proveedores",       to: "/configuracion-sistema/proveedores", quickCreate: "proveedores" },
      { label: "Compras",           to: "/compras/proveedores" },
      { label: "Órdenes de compra", to: "/compras/ordenes" },
      { label: "Recepciones",       to: "/compras/recepciones" },
      { label: "Facturas proveedor", to: "/compras/facturas-proveedor" },
      { label: "Pagos proveedor",    to: "/compras/pagos-proveedor" },
      { label: "Notas de crédito proveedor", to: "/compras/notas-credito-proveedor" },
      { label: "Devoluciones",       to: "/compras/devoluciones" },
    ],
  },

  {
    kind: "group",
    label: "Caja y Finanzas",
    icon: Wallet,
    children: [
      { label: "Caja",              to: "/ventas/caja" },
      { label: "Cuenta corriente",  to: "/finanzas/cuenta-corriente" },
      { label: "Movimientos",       to: "/finanzas/movimientos" },
      { label: "Saldos por moneda", to: "/finanzas/saldos-moneda" },
      { label: "Saldos por metal",  to: "/finanzas/saldos-metal" },
    ],
  },

  {
    kind: "group",
    label: "Informes",
    icon: BarChart3,
    children: [
      { label: "Todos los informes", to: "/informes" },
      { label: "Ventas",             to: "/informes/ventas" },
      { label: "Compras",            to: "/informes/compras" },
      { label: "Stock",              to: "/informes/stock" },
      { label: "Finanzas",           to: "/informes/finanzas" },
    ],
  },

  {
    kind: "group",
    label: "Importaciones",
    icon: Upload,
    children: [
      { label: "Historial de cargas", to: "/importaciones" },
    ],
  },

  { kind: "divider" },

  { kind: "link", label: "Configuración", to: "/configuracion-sistema", icon: Settings },
];

export default SIDEBAR_NAV;
