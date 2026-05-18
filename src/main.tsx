// tptech-frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { FieldFormatsProvider } from "./context/FieldFormatsContext";
import { NumberFormatProvider } from "./context/NumberFormatContext";
import { registerFeatureFlagsDevTools } from "./lib/featureFlags";

// ✅ IMPORTANTE: themes primero (define variables), luego index.css (las usa)
import "./styles/themes.css";
import "./index.css";

// Fase 1.0 — expone window.__tptechFlags para flippear flags desde DevTools.
// Default off; persistencia en localStorage. No-op en SSR.
registerFeatureFlagsDevTools();

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID ?? ""}>
      <AuthProvider>
        <ThemeProvider>
          <FieldFormatsProvider>
            <NumberFormatProvider>
              <RouterProvider router={router} />
            </NumberFormatProvider>
          </FieldFormatsProvider>
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
