// tptech-frontend/src/layouts/MainLayout.tsx
import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import LockScreen from "../components/LockScreen";

import { InventoryProvider } from "../context/InventoryContext";
import Toaster from "../components/ui/Toaster";
import { useAuth } from "../context/AuthContext";

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { locked } = useAuth();

  return (
    <InventoryProvider>
      <div className="h-[100dvh] bg-bg text-text [--layout-gap:1.5rem] overflow-hidden">
        <Sidebar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

        <main
          className={[
            "bg-surface pr-[var(--layout-gap)] pl-[var(--layout-gap)]",
            "lg:pl-[calc(var(--sidebar-w,280px)+var(--layout-gap))]",
            "h-full overflow-y-auto overflow-x-hidden",
            "[webkit-overflow-scrolling:touch]",
            "overscroll-contain",
          ].join(" ")}
        >
          <Topbar onToggleSidebar={() => setDrawerOpen((v) => !v)} />

          <div
            className="w-full py-[var(--layout-gap)]"
            onTouchStart={() => {
              if (locked) return;
              if (drawerOpen) setDrawerOpen(false);
            }}
            onMouseDown={() => {
              if (locked) return;
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

          <div className="h-[var(--layout-gap)]" />
        </main>

        <LockScreen />
        <Toaster />
      </div>
    </InventoryProvider>
  );
}
