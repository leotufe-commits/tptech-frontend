// src/components/ui/selectableRow.ts
import type React from "react";

/**
 * selectableRowProps — Patrón obligatorio para filas con checkbox en listas scrolleables
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA: scroll inesperado al seleccionar en listas
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * TPCheckbox renderiza:
 *
 *   <label>
 *     <input type="checkbox" class="sr-only" />   ← oculto (position: absolute; margin: -1px)
 *     <span>visual</span>
 *   </label>
 *
 * Cuando el usuario hace click en cualquier punto de una fila seleccionable,
 * el evento llega a la etiqueta <label>. La acción por defecto del <label>
 * es: llamar focus() en el <input> asociado y luego scrollIntoView().
 *
 * El <input sr-only> usa position: absolute, por lo que su posición en el DOM
 * depende del "offset parent" más cercano (el ancestro con position: relative/
 * absolute/fixed/sticky). Si no hay ninguno cerca, el input queda posicionado
 * relativo al <body>, con coordenadas arbitrarias.
 *
 * Resultado: scrollIntoView() lleva el scroll a un punto completamente distinto
 * al que el usuario estaba mirando. El efecto es peor cuanto más abajo en el DOM
 * está el input — filas al final de una lista larga producen saltos enormes.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * POR QUÉ onMouseDown.preventDefault() NO ALCANZA
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Previene el foco en la fase mousedown, pero la delegación label→input ocurre
 * en el evento click (posterior); scrollIntoView se dispara igual.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * LA SOLUCIÓN: onClickCapture + e.preventDefault()
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Interceptamos en fase capture (antes de que el evento llegue al <label>).
 * e.preventDefault() cancela la acción default del label → el input no recibe
 * foco → no hay scrollIntoView. El toggle se ejecuta directamente aquí.
 *
 * Excepciones intencionales:
 *   • e.detail === 0  — activación por teclado (Space/Enter); el onChange del
 *                       TPCheckbox lo maneja preservando accesibilidad.
 *   • target en <button> — el botón maneja su propio click (expand/collapse, etc.).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * REGLA OBLIGATORIA
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Todo checkbox que viva dentro de una lista o árbol scrolleable DEBE tener su
 * contenedor marcado con selectableRowProps. Sin esto, el scroll será inconsistente
 * (y la severidad dependerá de cuántos nodos preceden al input en el DOM).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * CUÁNDO APLICAR
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * ✅ APLICAR cuando:
 *   - Hay múltiples checkboxes en una lista o árbol (largo o corto)
 *   - El contenedor tiene overflow-y: auto / scroll (o está en una página que scrollea)
 *   - El div/span/tr actúa como zona clickeable para togglear el checkbox
 *   - La lista está fuera de un modal (ver excepción abajo)
 *
 * ⚠️  CASOS LÍMITE — aplicar igual para consistencia:
 *   - Tablas paginadas en páginas completas (aunque tengan pocos registros por página)
 *   - Checkboxes en filas de árboles con <span onClick={stopPropagation}> wrapeándolos
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * CUÁNDO NO APLICAR
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * ❌ NO APLICAR cuando:
 *   - Es un checkbox único (toggle de formulario, configuración on/off)
 *   - Está dentro de un modal con position: fixed → el modal actúa de offset parent
 *     y el scrollIntoView opera dentro del modal hacia el checkbox visible
 *   - El usuario hace click directamente sobre el checkbox (no sobre un contenedor más grande)
 *     Y el checkbox es el único elemento interactivo en esa zona
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * USO ESTÁNDAR
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Patrón mínimo (lista simple):
 *
 *   <div {...selectableRowProps({ onToggle: () => toggle(item), disabled })}>
 *     <TPCheckbox checked={...} onChange={() => toggle(item)} label="..." />
 *   </div>
 *
 * Con botón interno (expand/collapse, acciones):
 *
 *   <div {...selectableRowProps({ onToggle: () => toggle(item) })}>
 *     <button onClick={handleExpand} />    ← el botón es ignorado por selectableRowProps
 *     <TPCheckbox checked={...} onChange={() => toggle(item)} />
 *   </div>
 *
 * Con stopPropagation a fila clickeable (tabla con navigate):
 *
 *   <span onClick={(e) => e.stopPropagation()} {...selectableRowProps({ onToggle: toggle })}>
 *     <TPCheckbox checked={...} onChange={toggle} />
 *   </span>
 *
 * IMPORTANTE: TPCheckbox SIEMPRE debe conservar su onChange para activaciones por teclado.
 * La función pasada a onToggle y a onChange debe ser la MISMA referencia (o equivalente).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 * COMPONENTES QUE YA IMPLEMENTAN ESTE PATRÓN
 * ──────────────────────────────────────────────────────────────────────────────────────
 *
 *   • CategoryTreePicker  — árbol jerárquico con búsqueda y expansión
 *   • TPColumnPicker      — lista en portal con drag & drop
 *   • InventarioArticulos — árbol de artículos/variantes en página completa
 *   • EntidadesTable      — tabla paginada de clientes/proveedores
 *
 * ──────────────────────────────────────────────────────────────────────────────────────
 */
export function selectableRowProps({
  onToggle,
  disabled = false,
}: {
  onToggle: () => void;
  disabled?: boolean;
}): { onClickCapture: (e: React.MouseEvent) => void } {
  return {
    onClickCapture(e: React.MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("button")) return;   // deja que el botón interno maneje su propio click
      if (e.detail === 0) return;        // activación por teclado — onChange del checkbox lo maneja
      e.preventDefault();                // cancela delegación label→input → sin focus → sin scrollIntoView
      if (!disabled) onToggle();
    },
  };
}
