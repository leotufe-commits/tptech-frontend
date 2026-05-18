// src/context/NumberFormatContext.tsx
// Contexto global de formato numérico — cargado desde /company/me (JSON
// Jewelry.numberFormat). Único punto donde los componentes obtienen la config
// del tenant para formatear/parsear. NO calcula negocio.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchNumberFormat } from "../services/company";
import {
  DEFAULT_NUMBER_FORMAT_CONFIG,
  formatNumber,
  parseNumberInput,
  setActiveNumberFormatConfig,
  type FormatOptions,
  type NumberFormatConfig,
  type NumberFormatType,
} from "../lib/number-format";
import { useAuth } from "./AuthContext";

type NumberFormatCtx = {
  config: NumberFormatConfig;
  /** Formatea un número para display según el preset del tipo y la región. */
  fmt: (
    value: number | string | null | undefined,
    type: NumberFormatType,
    options?: FormatOptions,
  ) => string;
  /** Parsea entrada de usuario (coma o punto) → number puro o null. */
  parse: (raw: unknown) => number | null;
  /** Recarga la config desde el servidor (llamar después de guardar). */
  reload: () => void;
};

const DEFAULT_CTX: NumberFormatCtx = {
  config: DEFAULT_NUMBER_FORMAT_CONFIG,
  fmt: (v, t, o) => formatNumber(v, t, DEFAULT_NUMBER_FORMAT_CONFIG, o),
  parse: (raw) => parseNumberInput(raw, DEFAULT_NUMBER_FORMAT_CONFIG),
  reload: () => {},
};

const NumberFormatContext = createContext<NumberFormatCtx>(DEFAULT_CTX);

export function NumberFormatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<NumberFormatConfig>(DEFAULT_NUMBER_FORMAT_CONFIG);

  const load = useCallback(() => {
    if (!user) return;
    fetchNumberFormat().then(setConfig).catch(() => {});
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Puente Context → helpers puros (lib/pricing/format.ts, etc.). Sin esto, los
  // helpers que no son hooks no verían la config del tenant.
  useEffect(() => { setActiveNumberFormatConfig(config); }, [config]);

  const value = useMemo<NumberFormatCtx>(() => ({
    config,
    fmt: (v, t, o) => formatNumber(v, t, config, o),
    parse: (raw) => parseNumberInput(raw, config),
    reload: load,
  }), [config, load]);

  return (
    <NumberFormatContext.Provider value={value}>
      {children}
    </NumberFormatContext.Provider>
  );
}

export function useNumberFormat(): NumberFormatCtx {
  return useContext(NumberFormatContext);
}
