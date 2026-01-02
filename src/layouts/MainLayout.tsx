import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";
import { InventoryProvider } from "../context/InventoryContext";

export default function MainLayout() {
  return (
    <InventoryProvider>
      <div className="flex min-h-screen bg-bg text-text">
        <Sidebar />

        <main className="flex-1" style={{ background: "var(--surface)" }}>
          <Topbar />
          <div className="mx-auto max-w-7xl p-6">
            <div
              className="bg-card rounded-2xl p-6"
              style={{ boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </InventoryProvider>
  );
}
