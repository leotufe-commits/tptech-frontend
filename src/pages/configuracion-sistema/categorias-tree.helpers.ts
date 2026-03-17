import type { CategoryRow } from "../../services/categories";

/* ==========================================================
   Tipo extendido para nodos del árbol
========================================================== */
export type CategoryNode = CategoryRow & {
  children: CategoryNode[];
  level: number;
};

/* ==========================================================
   Construye el árbol desde la lista plana del backend
========================================================== */
export function buildCategoryTree(
  rows: CategoryRow[],
  sortDir: "asc" | "desc" = "asc"
): CategoryNode[] {
  const map = new Map<string, CategoryNode>();

  for (const row of rows) {
    map.set(row.id, { ...row, children: [], level: 0 });
  }

  const roots: CategoryNode[] = [];

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Asigna niveles recursivamente
  function setLevels(nodes: CategoryNode[], level: number) {
    for (const n of nodes) {
      n.level = level;
      setLevels(n.children, level + 1);
    }
  }

  // Ordena cada grupo: primero por sortOrder, luego alfabéticamente
  function sortGroup(nodes: CategoryNode[]) {
    nodes.sort((a, b) => {
      const byOrder = a.sortOrder - b.sortOrder;
      if (byOrder !== 0) return byOrder;
      const cmp = a.name.localeCompare(b.name, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
    for (const n of nodes) sortGroup(n.children);
  }

  setLevels(roots, 0);
  sortGroup(roots);

  return roots;
}

/* ==========================================================
   Aplana el árbol respetando el estado de expansión
========================================================== */
export function flattenVisible(
  nodes: CategoryNode[],
  expanded: Set<string>
): CategoryNode[] {
  const result: CategoryNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expanded.has(node.id) && node.children.length > 0) {
      result.push(...flattenVisible(node.children, expanded));
    }
  }
  return result;
}

/* ==========================================================
   Filtra el árbol por búsqueda:
   - Incluye nodos que coincidan
   - Incluye ancestros de nodos coincidentes (para dar contexto)
   - Retorna lista plana auto-expandida
========================================================== */
export function searchCategoryTree(
  roots: CategoryNode[],
  q: string
): CategoryNode[] {
  const lower = q.toLowerCase();

  function filterNode(node: CategoryNode): CategoryNode | null {
    const selfMatch = node.name.toLowerCase().includes(lower);
    const matchingChildren = node.children
      .map(filterNode)
      .filter((n): n is CategoryNode => n !== null);

    if (selfMatch || matchingChildren.length > 0) {
      // Si el nodo coincide directamente, mostrar con todos sus hijos sin filtrar
      // Si solo un hijo coincide, mostrar el padre con los hijos filtrados
      return { ...node, children: selfMatch ? node.children : matchingChildren };
    }
    return null;
  }

  const filteredRoots = roots
    .map(filterNode)
    .filter((n): n is CategoryNode => n !== null);

  // Aplana todo (en modo búsqueda se auto-expanden los nodos relevantes)
  function flattenAll(nodes: CategoryNode[]): CategoryNode[] {
    const result: CategoryNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        result.push(...flattenAll(node.children));
      }
    }
    return result;
  }

  return flattenAll(filteredRoots);
}

/* ==========================================================
   Devuelve los ids de todos los nodos raíz (para expandir por defecto)
========================================================== */
export function getRootIds(nodes: CategoryNode[]): string[] {
  return nodes.map((n) => n.id);
}

/* ==========================================================
   Devuelve los IDs de todos los descendientes de una categoría
   (a partir de la lista plana de rows)
========================================================== */
export function getDescendantIds(rows: CategoryRow[], parentId: string): string[] {
  const ids: string[] = [];
  let queue = [parentId];
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const pid of queue) {
      for (const r of rows) {
        if (r.parentId === pid) {
          ids.push(r.id);
          nextQueue.push(r.id);
        }
      }
    }
    queue = nextQueue;
  }
  return ids;
}

/* ==========================================================
   Devuelve todos los ids del árbol (útil para expandir/colapsar todo)
========================================================== */
export function getAllIds(nodes: CategoryNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      ids.push(...getAllIds(node.children));
    }
  }
  return ids;
}
