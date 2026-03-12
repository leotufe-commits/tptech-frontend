# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Communication preferences

- Always respond in Spanish.
- The user is not a developer. Keep all explanations clear and simple.

---

## 2. Mobile-first design (OBLIGATORIO)

La app debe funcionar en dispositivos móviles pequeños (mínimo 375px, como iPhone SE).

- Diseñar **mobile-first**: construir la versión mobile primero, luego adaptar con `md:`, `lg:`.
- Todos los componentes `TP*` y páginas deben ser usables con una sola mano en pantalla pequeña.
- Evitar tablas horizontales en mobile: usar cards o listas apiladas con clases responsive.
- Botones y áreas táctiles: mínimo 44×44px (`min-h-11 min-w-11`).
- Formularios: campos a ancho completo en mobile (`w-full`).
- Sidebars: en mobile deben ser drawers/overlays, nunca columnas fijas.
- Texto: nunca menor a `text-sm` (14px) en contenido principal.
- Verificar mentalmente que toda UI nueva se ve bien en 375px antes de hacer commit.

---

## 3. Deployment

- **Hosting**: [Render](https://render.com) — Static Site. Headers de seguridad (CSP, X-Frame-Options) en `render.yaml`.
- **Repositorio**: GitHub (`leotufe-commits/tptech-frontend`)
- **Backend**: servicio separado en Render. En producción configurar `VITE_API_URL` con la URL absoluta del backend.

---

## 4. Commands

```bash
npm run dev        # Dev server (Vite, proxies /api → backend en 3001)
npm run build      # Type-check (tsc -b) + Vite build
npm run lint       # ESLint
npm run preview    # Preview del build de producción
```

No hay test runner configurado.

---

## 5. Environment

Crear `.env.local` para desarrollo local:

```
VITE_API_URL=http://localhost:3001/api
```

Si `VITE_API_URL` se omite, la app usa la ruta relativa `/api` (Vite proxy). El helper `apiFetch` en `src/lib/api.ts` normaliza la URL y agrega `/api` si falta.

---

## 6. Architecture

### Entry point

`src/main.tsx` monta la app con dos providers que envuelven `RouterProvider`:
- `AuthProvider` — sesión, PIN lock, quick-switch, sincronización multi-tab.
- `ThemeProvider` — selección de tema (persistido por usuario en localStorage).

**Orden de CSS importa**: `themes.css` debe cargar antes de `index.css`, porque `index.css` consume las variables CSS definidas en `themes.css`.

### Routing

`src/router.tsx` — estructura de tres niveles:
1. Rutas públicas (`/login`, `/register`, `/forgot-password`) — redirigen a `/dashboard` si ya hay sesión.
2. Rutas privadas en `<ProtectedRoute>` — valida sesión via `/auth/me` en la primera visita; muestra loading hasta que `bootstrapped` sea true.
3. `<MainLayout>` — contiene Sidebar, Topbar, LockScreen y `<Outlet>` para el contenido de página.

Aliases de rutas legacy (ej. `/usuarios` → `/configuracion/usuarios`) se mantienen como `<Navigate>`.

### Auth flow

`src/context/AuthContext.tsx`. Autenticación usa **httpOnly cookies** — no se envía Bearer token por defecto.

Comportamientos clave:
- `refreshMe()` se llama lazily por `ProtectedRoute`, no al arrancar la app.
- `bootstrapped` previene redirección a `/login` mientras el primer check de sesión está en curso.
- Estado de lock screen (PIN) sobrevive F5 via `sessionStorage` (`tptech_locked`).
- Sincronización multi-tab via `localStorage` events y `BroadcastChannel("tptech_auth")`.
- Auto-lock por inactividad solo si el usuario tiene PIN configurado (`hasQuickPin`).
- Configuración de PIN del servidor (`jewelry.pinLockEnabled`, `pinLockTimeoutSec`) tiene prioridad sobre la local.

### Theme system

`src/context/ThemeContext.tsx`. Temas: `classic | dark | blue | gray | emerald`. Aplicados via atributo `data-theme` en `<html>`. Tema por usuario: `tptech_theme:<userId>` en localStorage; fallback a `tptech_theme:public`.

### API layer

`apiFetch<T>(path, options)` — wrapper central en `src/lib/api.ts`:
- Serialización JSON automática.
- Timeout de 25s via `AbortController`.
- Deduplicación de GET/HEAD en vuelo.
- `on401: "logout"` (default) o `"throw"`.
- Clase `ApiError` con `.status` y `.data`.

---

## 7. Componentes reutilizables (OBLIGATORIO)

Todo elemento visual nuevo debe crearse en `src/components/ui/` como componente `TP*` reutilizable. Nunca escribir estilos o estructuras visuales ad-hoc dentro de una página si el elemento puede aparecer en otro lugar. Antes de crear un componente nuevo, verificar si ya existe uno que se pueda usar o extender.

---

## 8. UI component library

Todos los componentes compartidos tienen prefijo `TP` (`TPInput`, `TPButton`, `TPSelect`, etc.). Utilidades CSS y `cn()` están en `src/components/ui/tp.ts`. Las clases `.tp-input` y `.tp-select` están definidas en `index.css` y consumen variables CSS del tema.

Variantes de botón exportadas desde `tp.ts`: `TP_BTN_PRIMARY`, `TP_BTN_SECONDARY`, `TP_BTN_GHOST`, `TP_BTN_DANGER`, `TP_BTN_LINK_PRIMARY`. **Nunca usar estas clases directamente** — usar siempre `<TPButton variant="...">`.

---

## 9. Permisos

`src/hooks/usePermissions.ts`. Formato: `"MODULE:ACTION"` (ej. `"USERS_ROLES:VIEW"`). El hook normaliza múltiples formas de respuesta de la API. Expone `can()`, `canAny()`, `canAll()`, `canMA()`. Usar `<RequirePermission>` para gating declarativo.

---

## 10. Servicios y hooks

- `src/services/` — funciones de llamada a API por dominio (users, roles, permissions, company, valuation, catalogs).
- `src/hooks/` — hooks custom que componen servicios (ej. `useUsersPage`, `useValuation`, `useMe`).
- Lógica a nivel de feature se co-localiza: ej. `src/hooks/usersPage/` contiene constantes, parsers, normalizadores y handlers para la página de usuarios.

---

## 11. Formato de valores numéricos (OBLIGATORIO)

- **Monetarios y cantidades generales**: formato `1,00` (dos decimales, coma). Step 1.
- **Pureza / Ley de metal**: formato `0,000` (tres decimales, coma). Step 0.001. Ejemplo: pureza 750 → `0,750`.
- Usar siempre `toLocaleString("es-AR")` o equivalente para mostrar valores en pantalla.
- En inputs numéricos: configurar `step`, `min` e `inputMode="decimal"` según el tipo de valor.

---

## 12. Enter para guardar en modales simples (OBLIGATORIO)

En modales que editan un solo valor o tienen poca información (ej. editar precio, editar nombre, ajustar stock), presionar **Enter** debe guardar y cerrar automáticamente:

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSave();
  }
}}
```

No aplicar en formularios grandes con múltiples secciones, donde Enter en un campo debe pasar al siguiente.

---

## 13. Campos obligatorios (OBLIGATORIO)

- Todo campo obligatorio usa `<TPField required label="...">` — muestra `*` junto al label (mismo color).
- Al hacer Guardar sin completar un campo requerido: pasar `error="Campo requerido."` a `TPField`.
- Patrón estándar con `submitted`:

```tsx
const [submitted, setSubmitted] = useState(false);

function handleSave() {
  setSubmitted(true);
  if (!name.trim()) return;
  // ... guardar
}

<TPField label="Nombre" required error={submitted && !name.trim() ? "Campo requerido." : null}>
  <TPInput value={name} onChange={setName} />
</TPField>
```

- El `*` va al **final del label** con el **mismo color del label**. Nunca usar `<span style="color:red">`.

---

## 14. Eventos globales

Sincronización instantánea sin refetch via `window.dispatchEvent`:

| Evento | Cuándo dispararlo |
|---|---|
| `tptech:jewelry_logo_changed` | Tras subir logo — actualiza favicon |
| `tptech:user_avatar_changed` | Tras subir avatar — actualiza sidebar |
| `tptech:user-pin-updated` | Tras cambiar PIN — sincroniza AuthContext |
| `tptech:open_quick_switch` | Para abrir UI de cambio rápido de usuario |
| `tptech:valuation-changed` | Tras cambios en valuación — sincroniza componentes |

---

## 15. Tailwind opacity rules (OBLIGATORIO)

No todos los colores del tema soportan modificadores de opacidad (`/50`, `/20`):

| Color | Soporte `/alpha` |
|---|---|
| `primary`, `secondary`, `border` | ✅ usan `rgb(var(--*-rgb) / <alpha-value>)` |
| `text`, `bg`, `card`, `muted`, `surface`, `surface2` | ❌ usan `var(--*)` plano |

Para `text`, `muted`, etc. usar `opacity-*` en vez de `/`:

```tsx
// ❌ no funciona
<span className="text-text/50">...</span>

// ✅ correcto
<span className="text-text opacity-50">...</span>
```

---

## 16. Comillas tipográficas (bug frecuente)

Nunca usar comillas curvas/tipográficas (`"` U+201C, `"` U+201D) como delimitadores en JSX o TypeScript. Babel falla con un error críptico de tokenización. Usar siempre comillas ASCII rectas (`"` U+0022). Ocurre cuando se copia código desde editores con "smart quotes" activado.

---

## 17. Valuation module

`src/components/valuation/` + `src/hooks/useValuation.ts`.

Fórmula única: `finalSalePrice = referenceValue × purity × saleFactor`.

- `MetalQuote` tiene campo único `price` (ya no hay `purchasePrice` + `salePrice`).
- El endpoint `/valuation/variants/:id/quotes` devuelve `price` (en moneda de la cotización) y `basePrice` (convertido a moneda base).
- Las páginas no llaman `apiFetch` directamente — usan el hook `useValuation`.
- Cambios en valuación disparan `tptech:valuation-changed`.

---

## 18. Tablas — reglas obligatorias (OBLIGATORIO)

### Ancho completo

Toda tabla ocupa el 100% del ancho disponible. Nunca usar `max-w-sm`, `max-w-md` ni widths fijos en tablas.

### TPTableKit — tabla administrativa estándar

**Toda tabla administrativa nueva debe usar `TPTableKit`** (`src/components/ui/TPTableKit.tsx`). Incluye automáticamente: column picker, buscador, sort arrows y footer con conteo.

```tsx
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPTr, TPTd } from "../../components/ui/TPTable";

const COLUMNS: TPColDef[] = [
  { key: "nombre",   label: "Nombre",   canHide: false, sortKey: "displayName" },
  { key: "ciudad",   label: "Ciudad",   width: "160px" },
  { key: "notas",    label: "Notas",    visible: false },  // oculta por defecto
  { key: "acciones", label: "Acciones", width: "120px", canHide: false, align: "right" },
];

const [q, setQ] = useState("");
const [sortKey, setSortKey] = useState("displayName");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

function toggleSort(key: string) {
  if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  else { setSortKey(key); setSortDir("asc"); }
}

<TPTableKit
  rows={filteredRows}
  columns={COLUMNS}
  storageKey="tptech_col_<entidad>"
  search={q}
  onSearchChange={setQ}
  searchPlaceholder="Buscar…"
  sortKey={sortKey}
  sortDir={sortDir}
  onSort={toggleSort}
  actions={<TPButton variant="primary" onClick={openCreate}>Nuevo</TPButton>}
  emptyText="No hay registros."
  countLabel="registros"
  renderRow={(row, vis) => (
    <TPTr key={row.id}>
      {vis.nombre   && <TPTd>{row.name}</TPTd>}
      {vis.ciudad   && <TPTd>{row.city}</TPTd>}
      {vis.notas    && <TPTd>{row.notes}</TPTd>}
      {vis.acciones && <TPTd className="text-right"><TPRowActions onEdit={() => open(row)} /></TPTd>}
    </TPTr>
  )}
/>
```

Reglas de `TPColDef`:
- `canHide: false` → siempre visible, no aparece en el picker (usar en "nombre" y "acciones").
- `visible: false` → oculta por defecto (el usuario puede activarla desde el picker).
- `sortKey` → activa sort en el header; el valor debe coincidir con lo que `onSort` recibe.
- `align: "right"` → alinea el header a la derecha (columnas de acciones).
- `storageKey` → persiste visibilidad en `localStorage`; formato `"tptech_col_<entidad>"`.

### TPTreeTable — tabla jerárquica

Para datos en árbol (ej. categorías anidadas) usar `TPTreeTable` (`src/components/ui/TPTreeTable.tsx`). No usar `TPTableKit` para estructuras jerárquicas.

### TPTd — sin prop label

No pasar el prop `label` a `<TPTd>`. Las etiquetas mobile-stack no se usan en TPTech.

---

## 19. CRUD estándar para pantallas (OBLIGATORIO)

Antes de implementar cualquier pantalla nueva, verificar que cumple estas reglas:

| Elemento | Cuándo aplicar |
|---|---|
| Listado con tabla + **buscador** | Siempre que haya más de un registro. El buscador es obligatorio. |
| **Ordenamiento** de columnas | Cuando tenga sentido funcional. Implementar con `sortKey` en `TPColDef`. |
| Filtro por fechas | Cuando aplique por negocio o auditoría. |
| Modal **View** (solo lectura) | Toda entidad con detalles que mostrar. |
| Modal **Edit** | Toda entidad editable. |
| Estado **Activo / Inactivo** con `TPStatusPill` | Cuando tenga sentido funcional. |
| **Soft delete** con `ConfirmDeleteDialog` | Siempre; nunca hard delete sin justificación. |
| **Favorito** | Cuando el usuario necesite destacar un registro por defecto. |
| **Clonar** | Entidades complejas con mucha información. |

Toda alta, edición, activación/inactivación o eliminación debe reflejarse **inmediatamente** en la tabla sin refresh manual: llamar `refetch()` o actualizar el estado local directamente.

Referencia de implementación: **Users**, **Warehouses**, **Divisas**, **Valuation**.

---

## 20. Soft delete (OBLIGATORIO)

- Eliminar = soft delete (marcar `deletedAt` en DB), salvo justificación explícita.
- Siempre confirmar con `<ConfirmDeleteDialog open title description onConfirm onClose busy>`.
- El botón de confirmar dentro del dialog debe ser `variant="danger"`.

---

## 21. Focus automático (OBLIGATORIO)

- Al abrir un modal o pantalla de alta/edición: foco automático en el primer campo útil.
- En modales simples: `useEffect` + `setTimeout(..., 50)` + `.focus()` + `.select()`.
- En formularios de creación: foco en el primer campo vacío.

---

## 22. Orden de campos en formularios

1. Identificadores: nombre, código, SKU.
2. Clasificación: tipo, categoría.
3. Contacto: teléfono, email, dirección.
4. Valores numéricos.
5. Notas y campos opcionales al final.

Campos de ciudad, provincia y país: siempre usar `TPComboCreatable` con `useCatalog("CITY")`, `useCatalog("PROVINCE")`, `useCatalog("COUNTRY")`. Nunca `TPInput`.

---

## 23. Estándares UI TPTech (OBLIGATORIO)

### Componentes por tipo de campo

| Tipo de campo | Componente |
|---|---|
| Texto libre | `TPInput` |
| Numérico | `TPNumberInput` — `value: number \| null`, `onChange: (v: number \| null) => void` |
| Enum fijo | `TPComboFixed` con `options={[...]}` |
| Catálogo dinámico (ciudad, provincia, doc) | `TPComboCreatable` con `type` y `items` |
| Fecha única | `TPInput type="date"` |
| Rango de fechas | `TPDateRangeInline` con `value: TPDateRangeValue` |
| Checkbox | `TPCheckbox` |
| Texto largo | `TPTextarea` |

### Secciones de formulario en modales

Agrupar campos con `TPCard`:

```tsx
import { TPCard } from "../../components/ui/TPCard";

<TPCard title="Datos personales">
  {/* campos */}
</TPCard>
<TPCard title="Domicilio">
  {/* campos de dirección */}
</TPCard>
```

### Activo/Inactivo — patrón unificado

- En tabla: `TPStatusPill` (nunca badges hardcodeados con `bg-green-*` / `bg-red-*`).
- En modal: `TPCheckbox` con label "Activo" o toggle con `ShieldCheck`/`ShieldBan`.
- Al activar/desactivar: actualización optimista + llamada a API.

### Acciones de fila

Siempre usar `TPRowActions` con las props que correspondan:
- `onView` — abrir modal de vista
- `onEdit` — abrir modal de edición
- `onToggle` + `isActive` — activar/desactivar
- `onFavorite` + `isFavorite` — favorito
- `onDelete` — eliminar (abre `ConfirmDeleteDialog`)

### Icono de calendario en dark mode

Usar `className="text-text opacity-50"` en el icono `<Calendar>`, nunca `text-muted` (puede ser invisible en dark mode).

### Código limpio

- No hacer refactors no solicitados.
- Reutilizar hooks, helpers y componentes existentes.
- Mantener el estilo visual actual de TPTech.

---

## 24. UI System Rules (OBLIGATORIO)

Todo código nuevo o modificado debe usar **exclusivamente** los componentes de `src/components/ui/`.

### Tabla de componentes obligatorios

| Elemento | Componente obligatorio |
|---|---|
| Input de texto | `TPInput` |
| Input numérico | `TPNumberInput` |
| Textarea | `TPTextarea` |
| Select / combo fijo | `TPComboFixed` |
| Combo con creación | `TPComboCreatable` |
| Botón | `TPButton` (variants: `primary`, `secondary`, `ghost`, `danger`, `linkPrimary`) |
| Tabla administrativa | `TPTableKit` |
| Tabla jerárquica | `TPTreeTable` |
| Modal | `Modal` |
| Confirmación de borrado | `ConfirmDeleteDialog` |
| Estado activo/inactivo | `TPStatusPill` |
| Shell de página | `TPSectionShell` |
| Wrapper de campo | `TPField` |
| Sección de formulario | `TPCard` |
| Acciones de fila | `TPRowActions` |
| Flechas de ordenamiento | `SortArrows` (de `TPSort`) |

### Prohibido — nunca usar en código nuevo

```
❌  <input>         →  usar TPInput
❌  <textarea>      →  usar TPTextarea
❌  <select>        →  usar TPComboFixed o TPComboCreatable
❌  <button className="tp-btn-*">  →  usar <TPButton variant="...">
❌  <table>, <thead>, <tbody>, <tr>, <th>, <td> HTML nativos  →  usar TPTableKit
❌  Modales locales (fixed inset-0, createPortal propio)  →  usar Modal
❌  Grids CSS usados como tabla (grid-cols-[...] con encabezados)
❌  Headers manuales con <h1> / <h2> hardcodeados  →  usar TPSectionShell
❌  Pills de estado con bg-green-* / bg-red-*  →  usar TPStatusPill
```
