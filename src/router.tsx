// tptech-frontend/src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";

import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";

import Divisas from "./pages/Divisas";

import InventarioArticulos from "./pages/InventarioArticulos";
import InventarioAlmacenes from "./pages/InventarioAlmacenes";
import InventarioMovimientos from "./pages/InventarioMovimientos";
import InventarioArticulosMovimientos from "./pages/InventarioArticulosMovimientos";
import InventarioStockPorDeposito from "./pages/InventarioStockPorDeposito";
import InventarioReposicion from "./pages/InventarioReposicion";

import VentasClientes from "./pages/configuracion-sistema/ConfiguracionSistemaClientes";
import Ventas from "./pages/Ventas";
import Caja from "./pages/Caja";
import ComprasProveedores from "./pages/ComprasProveedores";
import ComprasOrdenes from "./pages/ComprasOrdenes";
import ComprasRecepciones from "./pages/ComprasRecepciones";
import ComprasFacturasProveedor from "./pages/ComprasFacturasProveedor";
import ComprasPagosProveedor from "./pages/ComprasPagosProveedor";
import FinanzasCuentaCorriente from "./pages/FinanzasCuentaCorriente";
import VentasPresupuestos from "./pages/VentasPresupuestos";
import VentasOrdenes from "./pages/VentasOrdenes";
import VentasEntregas from "./pages/VentasEntregas";
import VentasFacturas from "./pages/VentasFacturas";
import VentasCobros from "./pages/VentasCobros";
import VentasNotasCredito from "./pages/VentasNotasCredito";
import ComprasNotasCreditoProveedor from "./pages/ComprasNotasCreditoProveedor";
import VentasDevoluciones from "./pages/VentasDevoluciones";
import ComprasDevoluciones from "./pages/ComprasDevoluciones";
import InformesHub from "./pages/InformesHub";
import InformesVentas from "./pages/InformesVentas";
import InformesCompras from "./pages/InformesCompras";
import InformesStock from "./pages/InformesStock";
import InformesFinanzas from "./pages/InformesFinanzas";
import FinanzasMovimientos from "./pages/FinanzasMovimientos";
import FinanzasSaldosMoneda from "./pages/FinanzasSaldosMoneda";
import FinanzasSaldosMetal from "./pages/FinanzasSaldosMetal";

import PerfilJoyeria from "./pages/PerfilJoyeria";


import Cuenta from "./pages/Cuenta";
import MisPreferencias from "./pages/MisPreferencias";
import Placeholder from "./pages/Placeholder";

import Usuarios from "./pages/Users";
import Roles from "./pages/roles/Roles";

// ✅ IMPORT CORRECTO SEGÚN TU ESTRUCTURA ACTUAL
import UserView from "./components/users/UserView";

import ConfiguracionSistema from "./pages/configuracion-sistema/ConfiguracionSistema";
import SystemPinSettings from "./pages/configuracion-sistema/SystemPinSettings";
import SystemThemeSettings from "./pages/configuracion-sistema/SystemThemeSettings";
import SystemUiCatalog from "./pages/configuracion-sistema/SystemUiCatalog";
import ConfiguracionSistemaVendedor from "./pages/configuracion-sistema/ConfiguracionSistemaVendedor";
// `ConfiguracionSistemaItems/Unidades/Categorias` ya no se montan
// directamente en router — las rutas legacy redirigen a la pantalla
// unificada `ItemsSistemaPage` (Fase 3). Las páginas siguen vivas en
// disco; el contenedor las importa internamente con `embedded={true}`.
import ConfiguracionSistemaInformes from "./pages/configuracion-sistema/ConfiguracionSistemaInformes";
// `ConfiguracionSistemaImpuestos/Pagos/CanalesDeVenta` ya no se montan
// directamente — las rutas legacy redirigen a la pantalla unificada
// `FinanzasCobrosPage` (Fase 5). Las páginas siguen vivas en disco; el
// contenedor las importa internamente con `embedded={true}`.
import ConfiguracionSistemaEnvios from "./pages/configuracion-sistema/ConfiguracionSistemaEnvios";
import ConfiguracionSistemaListasPrecios from "./pages/configuracion-sistema/ConfiguracionSistemaListasPrecios";
import ConfiguracionSistemaClientes from "./pages/configuracion-sistema/ConfiguracionSistemaClientes";
import ConfiguracionSistemaProveedores from "./pages/configuracion-sistema/ConfiguracionSistemaProveedores";
import ConfiguracionSistemaCorreos from "./pages/configuracion-sistema/ConfiguracionSistemaCorreos";
import ConfiguracionSistemaPromociones from "./pages/configuracion-sistema/ConfiguracionSistemaPromociones";
import ConfiguracionSistemaDescuentosCantidad from "./pages/configuracion-sistema/ConfiguracionSistemaDescuentosCantidad";
import ConfiguracionSistemaEtiquetas from "./pages/configuracion-sistema/ConfiguracionSistemaEtiquetas";
import ConfiguracionSistemaGruposArticulos from "./pages/configuracion-sistema/ConfiguracionSistemaGruposArticulos";
import ConfiguracionSistemaPoliticaPrecios from "./pages/configuracion-sistema/ConfiguracionSistemaPoliticaPrecios";
import ConfiguracionSistemaCupones from "./pages/configuracion-sistema/ConfiguracionSistemaCupones";
// `FormatoCamposPage` y `FormatoNumericoPage` ya no se montan directamente
// — las rutas legacy redirigen al contenedor unificado abajo. Las páginas
// (thin wrappers con shell) siguen existiendo en disco como entry points
// alternativos para deep-links externos.
import VisualizacionFormatosPage from "./pages/configuracion-sistema/VisualizacionFormatosPage";
// Fase 3 — pantalla unificada "Ítems del sistema" (tabs Ítems / Unidades /
// Categorías). Las rutas legacy /items, /unidades, /categorias redirigen
// acá conservando ?tab=. Las páginas internas se montan con `embedded`.
import ItemsSistemaPage from "./pages/configuracion-sistema/ItemsSistemaPage";
// `DocumentosHub` ya no se monta directamente — vive embebido dentro de
// la pantalla unificada `DocumentosComprobantesPage` (Fase 4). El editor
// individual `/documentos/:kind` sí se mantiene como deep route.
import DocumentTemplateEditor from "./pages/configuracion-sistema/documentos/DocumentTemplateEditor";
import DocumentosComprobantesPage from "./pages/configuracion-sistema/documentos/DocumentosComprobantesPage";
// Fase 5 — pantalla unificada "Finanzas y cobros" (tabs Pagos /
// Impuestos / Cuenta corriente / Canales). Las rutas legacy /pagos,
// /impuestos, /canales-venta redirigen acá conservando ?tab=.
import FinanzasCobrosPage from "./pages/configuracion-sistema/FinanzasCobrosPage";
import DashboardRentabilidad from "./pages/DashboardRentabilidad";
import PricingSimulator from "./pages/PricingSimulator";
const PricingCompare = React.lazy(() => import("./pages/dev/PricingCompare"));
import EntityDetail from "./pages/entity-detail/EntityDetail";
import EntityAccountStatement from "./pages/entity-detail/EntityAccountStatement";
import ArticleDetail from "./pages/article-detail/ArticleDetail";
import ImportBatchesPage from "./pages/importaciones/ImportBatchesPage";
import ImportBatchDetailPage from "./pages/importaciones/ImportBatchDetailPage";

import ProtectedRoute from "./components/ProtectedRoute";


function LoadingGate() {
  return <div className="p-6 text-sm text-muted">Cargando…</div>;
}

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/", element: <IndexRedirect /> },

  /* =====================
     PUBLIC
  ===================== */
  {
    path: "/login",
    element: (
      <PublicOnly>
        <Login />
      </PublicOnly>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicOnly>
        <Register />
      </PublicOnly>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <PublicOnly>
        <ForgotPassword />
      </PublicOnly>
    ),
  },
  {
    // Ruta pública sin PublicOnly: el admin podría estar logueado
    // mientras el invitado hace click en el link desde su email
    path: "/accept-invite",
    element: <AcceptInvite />,
  },
  {
    // Ruta pública sin PublicOnly: el usuario podría estar logueado
    // y aun así necesita poder resetear su contraseña con el token del mail
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    // Ruta pública sin PublicOnly: el link llega por email, el usuario puede no estar logueado
    path: "/verify-email",
    element: <VerifyEmail />,
  },

  /* =====================
     PRIVATE
  ===================== */
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // ===== PRINCIPAL =====
          { path: "dashboard", element: <Dashboard /> },
          { path: "reportes/rentabilidad", element: <DashboardRentabilidad /> },
          { path: "herramientas/simulador-precios", element: <PricingSimulator /> },
          { path: "divisas", element: <Divisas /> },

          // ===== ARTÍCULOS =====
          { path: "articulos/articulos", element: <InventarioArticulos /> },
          { path: "articulos/:id",       element: <ArticleDetail /> },
          { path: "articulos/compuestos", element: <Placeholder title="Artículos compuestos" /> },
          { path: "articulos/grupos", element: <ConfiguracionSistemaGruposArticulos /> },

          // ===== INVENTARIO =====
          { path: "inventario/articulos", element: <InventarioArticulos /> },
          { path: "inventario/almacenes", element: <InventarioAlmacenes /> },
          { path: "inventario/stock", element: <InventarioStockPorDeposito /> },
          { path: "inventario/reposicion", element: <InventarioReposicion /> },
          { path: "inventario/movimientos", element: <InventarioMovimientos /> },
          { path: "inventario/movimientos-articulos", element: <InventarioArticulosMovimientos /> },

          // ===== VENTAS =====
          { path: "ventas", element: <Ventas /> },
          { path: "ventas/pos", element: <Ventas /> },
          { path: "ventas/:id", element: <Placeholder title="Detalle de venta (Próximamente)" /> },
          { path: "ventas/clientes", element: <VentasClientes /> },
          { path: "ventas/presupuestos", element: <VentasPresupuestos /> },
          { path: "ventas/ordenes", element: <VentasOrdenes /> },
          { path: "ventas/ordenes-venta", element: <Navigate to="/ventas/ordenes" replace /> },
          { path: "ventas/facturas", element: <VentasFacturas /> },
          { path: "ventas/facturas-clientes", element: <Navigate to="/ventas/facturas" replace /> },
          { path: "ventas/cobros", element: <VentasCobros /> },
          { path: "ventas/paquetes", element: <Placeholder title="Paquetes (Próximamente)" /> },
          { path: "ventas/entregas", element: <VentasEntregas /> },
          { path: "ventas/remitos", element: <Navigate to="/ventas/entregas" replace /> },
          { path: "ventas/pagos-recibidos", element: <Navigate to="/ventas/caja" replace /> },
          { path: "ventas/caja", element: <Caja /> },
          { path: "ventas/devoluciones", element: <VentasDevoluciones /> },
          { path: "ventas/devoluciones-venta", element: <Navigate to="/ventas/devoluciones" replace /> },
          { path: "ventas/notas-credito", element: <VentasNotasCredito /> },

          // ===== COMPRAS =====
          { path: "compras/proveedores", element: <ComprasProveedores /> },
          { path: "compras/ordenes", element: <ComprasOrdenes /> },
          { path: "compras/facturas-proveedor", element: <ComprasFacturasProveedor /> },
          { path: "compras/recepciones", element: <ComprasRecepciones /> },
          { path: "compras/pagos-proveedor", element: <ComprasPagosProveedor /> },
          { path: "compras/pagos-realizados", element: <Navigate to="/compras/pagos-proveedor" replace /> },
          { path: "compras/notas-credito-proveedor", element: <ComprasNotasCreditoProveedor /> },
          { path: "compras/devoluciones", element: <ComprasDevoluciones /> },
          { path: "compras/creditos-proveedor", element: <Placeholder title="Créditos del proveedor (Próximamente)" /> },

          // compat rutas viejas
          { path: "compras/ordenes-compra", element: <Navigate to="/compras/ordenes" replace /> },

          // ===== FINANZAS =====
          { path: "finanzas", element: <Placeholder title="Finanzas (Próximamente)" /> },
          { path: "finanzas/cuenta-corriente", element: <FinanzasCuentaCorriente /> },
          { path: "finanzas/movimientos", element: <FinanzasMovimientos /> },
          { path: "finanzas/saldos-moneda", element: <FinanzasSaldosMoneda /> },
          { path: "finanzas/saldos-metal", element: <FinanzasSaldosMetal /> },

          // ===== INFORMES =====
          { path: "informes", element: <InformesHub /> },
          { path: "informes/ventas", element: <InformesVentas /> },
          { path: "informes/compras", element: <InformesCompras /> },
          { path: "informes/stock", element: <InformesStock /> },
          { path: "informes/finanzas", element: <InformesFinanzas /> },

          // ===== CONFIGURACIÓN =====
          { path: "configuracion/joyeria", element: <PerfilJoyeria /> },
          { path: "configuracion/cuenta", element: <Cuenta /> },
          { path: "configuracion/mis-preferencias", element: <MisPreferencias /> },

          // ✅ USERS list + ✅ USERS view REAL
          { path: "configuracion/usuarios", element: <Usuarios /> },
          { path: "configuracion/usuarios/:id", element: <UserView /> },

          { path: "configuracion/roles", element: <Roles /> },

          // ✅ HUB (Configuración del Sistema)
          { path: "configuracion-sistema", element: <ConfiguracionSistema /> },
          { path: "configuracion-sistema/pin", element: <SystemPinSettings /> },
          { path: "configuracion-sistema/tema", element: <SystemThemeSettings /> },

          // ✅ APARIENCIA: Catálogo UI (pantalla real)
          { path: "configuracion/apariencia/ui", element: <SystemUiCatalog /> },

          // ✅ NUEVO: VENDEDOR (placeholder por ahora)
          { path: "configuracion-sistema/vendedor", element: <ConfiguracionSistemaVendedor /> },

          // ✅ ENTIDADES COMERCIALES — listados
          { path: "configuracion-sistema/clientes", element: <ConfiguracionSistemaClientes /> },
          { path: "configuracion-sistema/proveedores", element: <ConfiguracionSistemaProveedores /> },

          // ✅ ENTIDADES COMERCIALES — detalle/edición
          { path: "clientes/:id", element: <EntityDetail /> },
          { path: "proveedores/:id", element: <EntityDetail /> },
          { path: "clientes/:id/extracto", element: <EntityAccountStatement /> },
          { path: "proveedores/:id/extracto", element: <EntityAccountStatement /> },

          // ✅ NUEVAS SECCIONES (placeholders por ahora)
          // Fase 5 — pantalla unificada "Finanzas y cobros" con tabs.
          // /impuestos, /pagos, /canales-venta redirigen al contenedor.
          { path: "configuracion-sistema/finanzas-cobros",
            element: <FinanzasCobrosPage /> },
          { path: "configuracion-sistema/impuestos",
            element: <Navigate to="/configuracion-sistema/finanzas-cobros?tab=impuestos" replace /> },
          { path: "configuracion-sistema/pagos",
            element: <Navigate to="/configuracion-sistema/finanzas-cobros?tab=pagos" replace /> },
          { path: "configuracion-sistema/envios", element: <ConfiguracionSistemaEnvios /> },
          { path: "configuracion-sistema/canales-venta",
            element: <Navigate to="/configuracion-sistema/finanzas-cobros?tab=canales" replace /> },
          { path: "configuracion-sistema/cupones",       element: <ConfiguracionSistemaCupones /> },
          { path: "configuracion-sistema/listas-precios", element: <ConfiguracionSistemaListasPrecios /> },
          { path: "configuracion-sistema/promociones", element: <ConfiguracionSistemaPromociones /> },
          { path: "configuracion-sistema/descuentos-cantidad", element: <ConfiguracionSistemaDescuentosCantidad /> },
          { path: "configuracion-sistema/politica-precios", element: <ConfiguracionSistemaPoliticaPrecios /> },
          // Legacy → redirige a la pantalla unificada "Ítems del sistema"
          // (Fase 3). La página standalone sigue importada para fallback
          // de deep-link directo si alguien la importa desde otro módulo.
          { path: "configuracion-sistema/categorias",
            element: <Navigate to="/configuracion-sistema/items-sistema?tab=categorias" replace /> },
          { path: "configuracion-sistema/grupos-articulos", element: <ConfiguracionSistemaGruposArticulos /> },
          { path: "configuracion-sistema/correos", element: <ConfiguracionSistemaCorreos /> },
          // Legacy → redirige a la pantalla unificada "Documentos y
          // comprobantes" (Fase 4), tab Numeración.
          { path: "configuracion-sistema/numeracion",
            element: <Navigate to="/configuracion-sistema/documentos-comprobantes?tab=numeracion" replace /> },
          { path: "configuracion-sistema/etiquetas", element: <ConfiguracionSistemaEtiquetas /> },
          // Fase 2 — pantalla unificada con tabs. Las rutas legacy
          // redirigen acá conservando la sub-sección via ?tab=...
          // (deep-links viejos siguen funcionando sin romper).
          { path: "configuracion-sistema/visualizacion-formatos",
            element: <VisualizacionFormatosPage /> },
          { path: "configuracion-sistema/formato-numerico",
            element: <Navigate to="/configuracion-sistema/visualizacion-formatos?tab=numeros" replace /> },
          { path: "configuracion-sistema/formato-campos",
            element: <Navigate to="/configuracion-sistema/visualizacion-formatos?tab=campos" replace /> },
          // Fase 4 — pantalla unificada "Documentos y comprobantes".
          // El editor por kind permanece como deep route independiente
          // (lo abre tanto el hub embebido como deep-links externos).
          { path: "configuracion-sistema/documentos-comprobantes",
            element: <DocumentosComprobantesPage /> },
          { path: "configuracion-sistema/documentos",
            element: <Navigate to="/configuracion-sistema/documentos-comprobantes?tab=plantillas" replace /> },
          { path: "configuracion-sistema/documentos/:kind",
            element: <DocumentTemplateEditor /> },

          // ===== IMPORTACIONES =====
          { path: "importaciones",     element: <ImportBatchesPage /> },
          { path: "importaciones/:id", element: <ImportBatchDetailPage /> },

          // ✅ ADMINISTRACIÓN — Fase 3: pantalla unificada con tabs.
          // /items, /unidades, /categorias redirigen al contenedor.
          // El contenedor preserva otros query params (ej. ?type=...
          // que usa la tab de Ítems para deep-linkear al catálogo).
          { path: "configuracion-sistema/items-sistema",
            element: <ItemsSistemaPage /> },
          { path: "configuracion-sistema/items",
            element: <Navigate to="/configuracion-sistema/items-sistema?tab=items" replace /> },
          { path: "configuracion-sistema/unidades",
            element: <Navigate to="/configuracion-sistema/items-sistema?tab=unidades" replace /> },
          { path: "configuracion-sistema/informes", element: <ConfiguracionSistemaInformes /> },

          // ===== DEV-ONLY =====
          // Solo se registra en desarrollo (vite). En producción, la
          // página se autobloquea con un Navigate al dashboard. No aparece
          // en sidebar.
          ...(import.meta.env.DEV
            ? [{
                path: "dev/pricing-compare",
                element: (
                  <React.Suspense fallback={<LoadingGate />}>
                    <PricingCompare />
                  </React.Suspense>
                ),
              }]
            : []),

          /* =====================
             COMPAT: RUTAS VIEJAS
          ===================== */
          { path: "configuracion/sistema", element: <Navigate to="/configuracion-sistema" replace /> },
          { path: "configuracion/sistema/pin", element: <Navigate to="/configuracion-sistema/pin" replace /> },
          { path: "configuracion/sistema/tema", element: <Navigate to="/configuracion-sistema/tema" replace /> },
          { path: "configuracion", element: <Navigate to="/configuracion-sistema" replace /> },

          // ✅ COMPAT: aliases que usaste antes
          { path: "usuarios", element: <Navigate to="/configuracion/usuarios" replace /> },
          { path: "roles", element: <Navigate to="/configuracion/roles" replace /> },
          { path: "perfil-joyeria", element: <Navigate to="/configuracion/joyeria" replace /> },

          // ✅ fallback
          { path: "*", element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);

export default router;
