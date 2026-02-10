// src/components/sidebar/sidebar.nav.ts
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Landmark,
  Settings,
} from "lucide-react";

// ✅ FORZAMOS .tsx para evitar que resuelva a un .ts fantasma
import type { IconType } from "./sidebar.icons.tsx";
import { GoldBarsIcon } from "./sidebar.icons.tsx";

export type GroupItem = { label: string; to: string };

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
      { label: "Artículos", to: "/articulos/articulos" },
      { label: "Artículos compuestos", to: "/articulos/compuestos" },
      { label: "Grupos de artículos", to: "/articulos/grupos" },
    ],
  },

  {
    kind: "group",
    label: "Inventario",
    icon: Package,
    children: [
      { label: "Almacenes", to: "/inventario/almacenes" },
      { label: "Movimientos", to: "/inventario/movimientos" },
    ],
  },

  {
    kind: "group",
    label: "Ventas",
    icon: ShoppingCart,
    children: [
      { label: "Cliente", to: "/ventas/clientes" },
      { label: "Orden de Venta", to: "/ventas/ordenes-venta" },
      { label: "Factura de Clientes", to: "/ventas/facturas-clientes" },
      { label: "Paquetes", to: "/ventas/paquetes" },
      { label: "Remitos", to: "/ventas/remitos" },
      { label: "Pagos Recibidos", to: "/ventas/pagos-recibidos" },
      { label: "Devoluciones de Venta", to: "/ventas/devoluciones" },
      { label: "Nota de Credito", to: "/ventas/notas-credito" },
    ],
  },

  {
    kind: "group",
    label: "Compras",
    icon: ShoppingBag,
    children: [
      { label: "Proveedores", to: "/compras/proveedores" },
      { label: "Orden de Compra", to: "/compras/ordenes-compra" },
      { label: "Factura de Proveedor", to: "/compras/facturas-proveedor" },
      { label: "Recepcion de Compras", to: "/compras/recepciones" },
      { label: "Pagos Realizados", to: "/compras/pagos-realizados" },
      { label: "Devolucion", to: "/compras/devoluciones" },
      { label: "Creditos del Proveedor", to: "/compras/creditos-proveedor" },
    ],
  },

  { kind: "divider" },

  { kind: "link", label: "Finanzas", to: "/finanzas", icon: Landmark },
  { kind: "link", label: "Configuración", to: "/configuracion-sistema", icon: Settings },
];

export default SIDEBAR_NAV;
