// src/hooks/useFormattedInput.ts
// Autoformateo progresivo para inputs de teléfono y documento.
//
// Estrategia:
//  - Mantiene `displayValue` (formateado) separado del valor limpio que va al estado del form.
//  - Restaura la posición del cursor contando dígitos, no caracteres, para que los
//    separadores (espacios, guiones, puntos) no hagan saltar el cursor.
//  - En Backspace sobre un separador, mueve el cursor un lugar hacia atrás en lugar de
//    intentar borrar el separador (que se reinseriaría igual).
//
// Uso:
//   const ph  = usePhoneInput(draft.phoneNumber, v => set("phoneNumber", v), phoneFormat);
//   const doc = useDocInput(draft.documentNumber, v => set("documentNumber", v), documentFormat);
//
//   <TPInput
//     value={ph.displayValue}
//     onChange={ph.handleChange}
//     onKeyDown={ph.handleKeyDown}
//     inputRef={ph.inputRef}
//   />

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDocumentInputProgressive,
  formatPhoneInputProgressive,
  countPatternDigits,
} from "../lib/format";

// ── Core (interno) ────────────────────────────────────────────────────────────

function useFormattedInputCore(
  rawValue: string,
  onChange: (clean: string) => void,
  formatFn: (digits: string) => string,
  maxDigits: number
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCleanRef = useRef<string>("");

  const [displayValue, setDisplayValue] = useState<string>(() => {
    const d = (rawValue ?? "").replace(/\D/g, "").slice(0, maxDigits);
    return formatFn(d);
  });

  // Sincronizar display cuando el valor externo cambia
  // (carga de datos para edición, reset del formulario, cambio de formato)
  useEffect(() => {
    const incoming = (rawValue ?? "").replace(/\D/g, "").slice(0, maxDigits);
    if (incoming !== prevCleanRef.current) {
      prevCleanRef.current = incoming;
      setDisplayValue(formatFn(incoming));
    }
  }, [rawValue, maxDigits, formatFn]);

  const handleChange = useCallback(
    (newVal: string) => {
      // Leer posición del cursor en el DOM (disponible síncronamente en onChange)
      const cursor = inputRef.current?.selectionStart ?? newVal.length;

      // Cuántos dígitos hay antes del cursor en el nuevo valor del input
      const digitsBeforeCursor = newVal.slice(0, cursor).replace(/\D/g, "").length;

      // Valor limpio (solo dígitos, hasta maxDigits)
      const clean = newVal.replace(/\D/g, "").slice(0, maxDigits);
      const formatted = formatFn(clean);

      prevCleanRef.current = clean;
      setDisplayValue(formatted);
      onChange(clean);

      // Restaurar posición del cursor después del re-render de React
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.setSelectionRange(
          cursorAfterNthDigit(formatted, digitsBeforeCursor),
          cursorAfterNthDigit(formatted, digitsBeforeCursor)
        );
      });
    },
    [onChange, maxDigits, formatFn]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Backspace") return;
      const el = e.currentTarget;
      const cursor = el.selectionStart ?? 0;
      const selEnd  = el.selectionEnd  ?? cursor;

      // Solo cuando no hay selección y no estamos al inicio
      if (cursor !== selEnd || cursor === 0) return;

      // Si el char antes del cursor es un separador, simplemente mover el cursor
      // hacia atrás. El próximo Backspace eliminará el dígito anterior.
      const charBefore = el.value[cursor - 1];
      if (charBefore && !/\d/.test(charBefore)) {
        e.preventDefault();
        el.setSelectionRange(cursor - 1, cursor - 1);
      }
    },
    []
  );

  return { displayValue, handleChange, handleKeyDown, inputRef };
}

/** Posición del cursor justo después del n-ésimo dígito de `str` (n es 1-indexed count) */
function cursorAfterNthDigit(str: string, n: number): number {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      count++;
      if (count === n) return i + 1;
    }
  }
  return str.length;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Autoformateo progresivo para el campo del NÚMERO de teléfono.
 * Formatea solo la parte local (sin prefijo de país).
 * Patrón AR aplicado hasta 10 dígitos; más de 10 dígitos se muestran sin máscara.
 * Máximo: 15 dígitos (estándar E.164 sin prefijo de país).
 */
export function usePhoneInput(
  rawValue: string,
  onChange: (clean: string) => void,
  phoneFormat: string
) {
  const formatFn = useCallback(
    (digits: string) => formatPhoneInputProgressive(digits, phoneFormat),
    [phoneFormat]
  );
  return useFormattedInputCore(rawValue, onChange, formatFn, 15);
}

/**
 * Autoformateo progresivo para el campo de número de documento.
 * CUIT/CUIL: "XX-XXXXXXXX-X" (11 dígitos — estándar argentino, sin cambio).
 * DNI:       "XX.XXX.XXX"    (hasta 8 dígitos con máscara; acepta hasta 10 sin máscara).
 * raw / digits_only: acepta hasta 20 dígitos sin formato.
 */
export function useDocInput(
  rawValue: string,
  onChange: (clean: string) => void,
  documentFormat: string
) {
  const maxDigits =
    documentFormat.startsWith("custom:") ? (countPatternDigits(documentFormat.slice(7)) || 20) :
    documentFormat === "ar_doc" || documentFormat === "cuit_cuil" || documentFormat === "cpf" ? 11 :
    documentFormat === "cnpj" ? 14 :
    documentFormat === "ssn" || documentFormat === "rut" ? 9 :
    documentFormat === "es_dni" ? 8 :
    documentFormat === "raw"    || documentFormat === "digits_only" ||
    documentFormat === "doc_dots" ||
    documentFormat === "intl_spaces" || documentFormat === "intl_dashes" ||
    documentFormat === "es_nie" ? 20 :
    10; // dni y otros
  const formatFn  = useCallback(
    (digits: string) => formatDocumentInputProgressive(digits, documentFormat),
    [documentFormat]
  );
  return useFormattedInputCore(rawValue, onChange, formatFn, maxDigits);
}
