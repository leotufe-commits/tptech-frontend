import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";
import { InventoryProvider } from "../context/InventoryContext";

export default function MainLayout() {
  return (
    <InventoryProvider>
      {/* 
        Guardamos el "gap" (margen) como variable para que sea igual a ambos lados
        y para sumarlo al ancho del sidebar en desktop.
      */}
      <div className="min-h-screen bg-bg text-text [--layout-gap:1.5rem]">
        <Sidebar />

        {/*
          Queremos:
          - En mobile: padding normal (gap)
          - En desktop: padding-left = sidebar real + gap
          - A la derecha: padding-right = gap
        */}
        <main
          className="bg-surface pr-[var(--layout-gap)] pl-[var(--layout-gap)] lg:pl-[calc(var(--sidebar-w,280px)+var(--layout-gap))]"
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
        </main>
      </div>
    </InventoryProvider>
  );
}
