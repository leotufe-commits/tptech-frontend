// tptech-frontend/src/pages/articulos.utils.ts

export type SortKey = "sku" | "stock" | "precio";
export type SortDir = "asc" | "desc";

export function moneyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

export function sumStock(stockByAlmacen: Record<string, number>) {
  return Object.values(stockByAlmacen || {}).reduce(
    (acc, n) => acc + (Number.isFinite(n) ? n : 0),
    0
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvCell(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCSV(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  return lines.join("\r\n");
}

export function rowsToHTMLTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "<table></table>";
  const headers = Object.keys(rows[0]);

  const ths = headers.map((h) => `<th>${String(h)}</th>`).join("");
  const trs = rows
    .map((r) => {
      const tds = headers
        .map((h) => `<td>${String(r[h] ?? "")}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<table border="1"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}
