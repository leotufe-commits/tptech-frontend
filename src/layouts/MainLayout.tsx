import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";
import { InventoryProvider } from "../context/InventoryContext";

export default function MainLayout() {
  return (
    <InventoryProvider>
      {/*
        Layout con scroll "tipo app":
        - El scroll vive en <main> (mejor para mobile + sidebar fixed)
        - 100dvh para evitar bugs de barra del navegador en celular
        - overflow-x-hidden para evitar desplazamientos raros
      */}
      <div className="h-[100dvh] bg-bg text-text [--layout-gap:1.5rem] overflow-hidden">
        <Sidebar />

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
          <Topbar />

          <div className="w-full py-[var(--layout-gap)]">
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
      </div>
    </InventoryProvider>
  );
}
