// src/context/FieldFormatsContext.tsx
// Contexto global para formato de teléfono y documento — cargado desde /company/me
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchFieldFormats, type FieldFormatsConfig } from "../services/company";
import { formatDocument, formatPhone } from "../lib/format";
import { useAuth } from "./AuthContext";

type FieldFormatsCtx = {
  phoneFormat:    string;
  documentFormat: string;
  /** Formatea un número de teléfono para mostrar (no en inputs) */
  fmtPhone: (prefix: string | null | undefined, phone: string | null | undefined) => string;
  /** Formatea un número de documento para mostrar (no en inputs) */
  fmtDoc:   (value: string | null | undefined) => string;
  /** Recarga la configuración desde el servidor (llamar después de guardar) */
  reload:   () => void;
};

const DEFAULT_CTX: FieldFormatsCtx = {
  phoneFormat:    "raw",
  documentFormat: "raw",
  fmtPhone: (prefix, phone) => [prefix, phone].filter(Boolean).join(" ").trim(),
  fmtDoc:   (value) => value ?? "",
  reload:   () => {},
};

const FieldFormatsContext = createContext<FieldFormatsCtx>(DEFAULT_CTX);

export function FieldFormatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<FieldFormatsConfig>({
    phoneFormat:    "raw",
    documentFormat: "raw",
  });

  const load = useCallback(() => {
    if (!user) return;
    fetchFieldFormats().then(setConfig).catch(() => {});
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <FieldFormatsContext.Provider value={{
      phoneFormat:    config.phoneFormat,
      documentFormat: config.documentFormat,
      fmtPhone: (prefix, phone) =>
        formatPhone(prefix ?? "", phone ?? "", config.phoneFormat),
      fmtDoc: (value) =>
        value ? formatDocument(value, config.documentFormat) : (value ?? ""),
      reload: load,
    }}>
      {children}
    </FieldFormatsContext.Provider>
  );
}

export function useFieldFormats(): FieldFormatsCtx {
  return useContext(FieldFormatsContext);
}
