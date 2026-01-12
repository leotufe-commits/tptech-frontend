// tptech-frontend/src/layouts/MainLayout.tsx
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";
import { InventoryProvider } from "../context/InventoryContext";
import Toaster from "../components/ui/Toaster";

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <InventoryProvider>
      {/*
        Layout con scroll "tipo app":
        - El scroll vive en <main> (mejor para mobile + sidebar fixed)
        - 100dvh para evitar bugs de barra del navegador en celular
        - overflow-hidden para evitar desplazamientos raros
      */}
      <div className="h-[100dvh] bg-bg text-text [--layout-gap:1.5rem] overflow-hidden">
        <Sidebar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

        {/*
          main = contenedor scrolleable
          - En mobile: padding normal (gap)
          - En desktop: padding-left = sidebar real + gap
          - A la derecha: padding-right = gap
        */}
        <main
          className={[
            "bg-surface pr-[var(--layout-gap)] pl-[var(--layout-gap)]",
            "lg:pl-[calc(var(--sidebar-w,280px)+var(--layout-gap))]",
            // ✅ scroll principal
            "h-full overflow-y-auto overflow-x-hidden",
            // ✅ scroll suave en iOS
            "[webkit-overflow-scrolling:touch]",
            // ✅ evita “rebotes” raros
            "overscroll-contain",
          ].join(" ")}
        >
          <Topbar onToggleSidebar={() => setDrawerOpen((v) => !v)} />

          {/* ✅ Solo el contenido (debajo del topbar) cierra el drawer al tocar */}
          <div
            className="w-full py-[var(--layout-gap)]"
            onTouchStart={() => {
              if (drawerOpen) setDrawerOpen(false);
            }}
            onMouseDown={() => {
              // útil en desktop si abrís drawer y querés cerrarlo clickeando afuera
              if (drawerOpen) setDrawerOpen(false);
            }}
          >
            <div
              className="w-full rounded-2xl bg-card p-6"
              style={{
                boxShadow: "var(--shadow)",
                border: "1px solid var(--border)",
              }}
            >
              <Outlet />
            </div>
          </div>

          {/* ✅ padding extra al final para que en mobile no quede pegado abajo */}
          <div className="h-[var(--layout-gap)]" />
        </main>

        {/* 🔔 Toaster global (se monta una sola vez) */}
        <Toaster />
      </div>
    </InventoryProvider>
  );
}
