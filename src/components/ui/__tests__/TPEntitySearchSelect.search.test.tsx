// src/components/ui/__tests__/TPEntitySearchSelect.search.test.tsx
// ============================================================================
// Etapa 1 (perf) — búsqueda de clientes server-side.
//
// Protege el contrato del combo de cliente cuando se pasa `onSearch`:
//   1. Al tipear, el combo invoca `onSearch(query)` → el padre pega al backend
//      con `q` (no filtra solo en memoria).
//   2. Los resultados que devuelve el server se muestran aunque NO matcheen el
//      texto local (name/email/phone) — ej. cliente encontrado por documento.
//      Esto prueba que el filtrado en memoria queda desactivado (modo remoto).
//   3. Sin `onSearch` (modo legacy), el filtrado en memoria sigue intacto.
// ============================================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TPEntitySearchSelect, type TPEntityLite } from "../TPEntitySearchSelect";

const CLIENTS: TPEntityLite[] = [
  { id: "c1", name: "Aaron Acuña",   email: "aaron@x.com" },
  { id: "c2", name: "Zulema Zapata", email: "zule@x.com" },
];

describe("TPEntitySearchSelect — búsqueda server-side (onSearch)", () => {
  it("invoca onSearch con el query al tipear (dispara la búsqueda backend)", () => {
    const onSearch = vi.fn();
    render(
      <TPEntitySearchSelect
        type="client"
        options={CLIENTS}
        onChange={() => {}}
        onSearch={onSearch}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar cliente/);
    fireEvent.change(input, { target: { value: "30-555" } });
    expect(onSearch).toHaveBeenCalledWith("30-555");
  });

  it("muestra los resultados del server aunque NO matcheen el texto local (documento/código)", () => {
    // El server devolvió este cliente por documentNumber; su name/email NO
    // contienen el query → el filtro local lo ocultaría. Con onSearch debe verse.
    const serverResults: TPEntityLite[] = [
      { id: "c9", name: "Cliente Fuera Del Bloque", email: "lejos@x.com", documentNumber: "30-55512345-7" },
    ];
    render(
      <TPEntitySearchSelect
        type="client"
        options={serverResults}
        onChange={() => {}}
        onSearch={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar cliente/);
    fireEvent.change(input, { target: { value: "30-55512345" } });
    expect(screen.getByText("Cliente Fuera Del Bloque")).toBeTruthy();
  });

  it("sin onSearch (legacy) filtra en memoria por name/email", () => {
    render(
      <TPEntitySearchSelect
        type="client"
        options={CLIENTS}
        onChange={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar cliente/);
    fireEvent.change(input, { target: { value: "Zulema" } });
    expect(screen.getByText("Zulema Zapata")).toBeTruthy();
    expect(screen.queryByText("Aaron Acuña")).toBeNull();
  });
});
