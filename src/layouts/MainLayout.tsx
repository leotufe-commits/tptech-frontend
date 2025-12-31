import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";
import { InventoryProvider } from "../context/InventoryContext";

export default function MainLayout() {
  return (
    <InventoryProvider>
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <main className="flex-1 bg-white">
          <div className="mx-auto max-w-7xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </InventoryProvider>
  );
}
