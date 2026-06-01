// src/components/sales/SaleCompositionEditableGrid/context.ts
// =============================================================================
// Context con el `gridTemplateColumns` ya calculado para que header, filas y
// footers compartan el mismo layout sin que el caller tenga que pasar la prop
// a cada Row (rompería los memos). El Provider vive en el componente principal;
// los consumers (TypeGroupFooter, EditableRow) lo leen vía useContext.
// =============================================================================

import React from "react";
import { COL_WIDTHS_DEFAULTS } from "./constants";
import { buildGridTemplateColumns } from "./helpers";

export const TableLayoutContext = React.createContext<string>(
  buildGridTemplateColumns(COL_WIDTHS_DEFAULTS),
);
