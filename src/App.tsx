// src/App.tsx
import { RouterProvider } from "react-router-dom";
import router from "./router";

import LockScreen from "./components/LockScreen";
import Toaster from "./components/ui/Toaster";

export default function App() {
  return (
    <>
      {/* Global overlays */}
      <LockScreen />
      <Toaster />

      {/* App routes */}
      <RouterProvider router={router} />
    </>
  );
}
