# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication preferences

- Always respond in Spanish.
- The user is not a developer. Keep all explanations clear and simple.

## Mobile-first design (OBLIGATORIO)

La app debe funcionar correctamente en dispositivos móviles pequeños (mínimo 375px de ancho, como iPhone SE).

- Diseñar **mobile-first**: construir la versión mobile primero, luego adaptar para pantallas grandes con Tailwind (`md:`, `lg:`).
- Todos los componentes `TP*` y todas las páginas deben ser usables con una sola mano en pantalla pequeña.
- Evitar tablas horizontales en mobile: reemplazar con cards o listas apiladas usando clases responsive.
- Botones y áreas táctiles: mínimo 44×44px (`min-h-11`, `min-w-11`).
- Formularios: campos a ancho completo en mobile (`w-full`), inputs grandes para facilitar el toque.
- Sidebars y menús: en mobile deben ser drawers/overlays, no columnas fijas.
- Texto: nunca menor a `text-sm` (14px) en contenido principal.
- Espaciado: usar padding generoso en mobile para evitar toques accidentales.
- Antes de hacer un commit con nueva UI, verificar mentalmente que se ve bien en 375px.

## Deployment

- **Hosting**: [Render](https://render.com) — Static Site. La configuración de headers de seguridad (CSP, X-Frame-Options, etc.) está en `render.yaml`.
- **Repositorio**: GitHub (`leotufe-commits/tptech-frontend`)
- **Backend**: servicio separado en Render. En producción, configurar `VITE_API_URL` con la URL absoluta del backend (ej. `https://tptech-backend.onrender.com/api`).

## Commands

```bash
npm run dev        # Start dev server (Vite, proxies /api to backend)
npm run build      # Type-check (tsc -b) then Vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test runner is configured.

## Environment

Create a `.env.local` for local development:

```
VITE_API_URL=http://localhost:3001/api
```

If `VITE_API_URL` is omitted, the app falls back to the relative `/api` path (Vite proxy). The `apiFetch` helper in `src/lib/api.ts` normalizes the URL and auto-appends `/api` if absent.

## Architecture

### Entry point and providers

`src/main.tsx` mounts the app with two providers wrapping `RouterProvider`:
- `AuthProvider` — session state, PIN lock, quick-switch, multi-tab sync
- `ThemeProvider` — theme selection (persisted per-user in localStorage)

CSS import order matters: `themes.css` must load before `index.css` because `index.css` consumes the CSS variables defined in `themes.css`.

### Routing (`src/router.tsx`)

Three-tier structure:
1. Public-only routes (`/login`, `/register`, `/forgot-password`) — redirect to `/dashboard` if already authenticated.
2. Private routes wrapped in `<ProtectedRoute>` — validates session on first entry via `/auth/me`, shows loading gate until `bootstrapped` is true.
3. `<MainLayout>` — contains Sidebar, Topbar, LockScreen, and `<Outlet>` for page content.

Legacy route aliases (e.g. `/usuarios` → `/configuracion/usuarios`) are kept as `<Navigate>` redirects.

### Auth flow (`src/context/AuthContext.tsx`)

Authentication uses **httpOnly cookies** — no Bearer token is sent by default. The legacy token storage in localStorage/sessionStorage exists only for backward compat (`forceBearer: true` opt-in on `apiFetch`).

Key behaviors:
- `refreshMe()` is called lazily by `ProtectedRoute` on first protected-route visit, not on app boot.
- `bootstrapped` flag prevents redirect to `/login` while the first session check is in-flight.
- Lock screen (PIN) state survives F5 via `sessionStorage` (`tptech_locked`).
- Multi-tab sync uses both `localStorage` events and `BroadcastChannel("tptech_auth")`.
- Auto-lock fires on inactivity only if the current user has a PIN set (`hasQuickPin`).
- Server-side lock settings (`jewelry.pinLockEnabled`, `pinLockTimeoutSec`) override local settings.

### Theme system (`src/context/ThemeContext.tsx`)

Themes: `classic | dark | blue | gray | emerald`. Applied via `data-theme` attribute on `<html>`. Per-user theme stored as `tptech_theme:<userId>` in localStorage; falls back to `tptech_theme:public`.

### API layer (`src/lib/api.ts`)

`apiFetch<T>(path, options)` — central fetch wrapper with:
- Automatic JSON serialization
- 25s default timeout via `AbortController`
- GET/HEAD request deduplication (in-flight map)
- `on401: "logout"` (default) or `"throw"`
- `ApiError` class with `.status` and `.data` fields

### Componentes reutilizables (OBLIGATORIO)

Todo elemento visual nuevo debe crearse en `src/components/ui/` como un componente `TP*` reutilizable. Nunca escribir estilos o estructuras visuales ad-hoc dentro de una página o módulo si el elemento puede aparecer en otro lugar del sistema. Antes de crear un componente nuevo, verificar si ya existe uno en `src/components/ui/` que se pueda usar o extender.

### UI component library (`src/components/ui/`)

All shared UI components are prefixed `TP` (e.g. `TPInput`, `TPButton`, `TPSelect`, `TPTable`). Style constants and the `cn()` utility are in `src/components/ui/tp.ts`. CSS class names `.tp-input` and `.tp-select` are defined globally in `index.css` and consume theme CSS variables.

Button variants exported from `tp.ts`: `TP_BTN_PRIMARY`, `TP_BTN_SECONDARY`, `TP_BTN_GHOST`, `TP_BTN_DANGER`, `TP_BTN_LINK_PRIMARY`.

### Permissions (`src/hooks/usePermissions.ts`)

Convention: `"MODULE:ACTION"` strings (e.g. `"USERS_ROLES:VIEW"`). The hook normalizes multiple API response shapes (plain strings, `{ code }`, `{ name }`, nested `{ permission: { code } }`). Exposes `can()`, `canAny()`, `canAll()`, `canMA()` helpers. Use `<RequirePermission>` component for declarative gating.

### Services and hooks

- `src/services/` — thin API call functions per domain (users, roles, permissions, company, valuation, catalogs)
- `src/hooks/` — custom hooks that compose services (e.g. `useUsersPage`, `useValuation`, `useMe`)
- Feature-level logic is co-located: e.g. `src/hooks/usersPage/` contains constants, parsers, normalizers, and event handlers for the Users page

### Formato de valores numéricos (OBLIGATORIO)

- **Valores monetarios y cantidades generales**: formato `1,00` (dos decimales, separador de coma). El input sube/baja de a enteros (step 1). Ejemplo: precio, gramos, cantidad.
- **Pureza / Ley de metal**: formato `0,000` (tres decimales, separador de coma). El input sube/baja de a `0,001` (step 0.001). Ejemplo: pureza 750 → se muestra como `0,750`.
- Usar siempre `toLocaleString("es-AR")` o equivalente para mostrar los valores formateados en pantalla.
- En inputs numéricos, configurar `step`, `min`, y `inputMode="decimal"` correctamente según el tipo de valor.

### Enter para guardar en modales simples (OBLIGATORIO)

En pantallas o modales que principalmente editan un valor o tienen poca información para modificar (ej: editar precio, editar nombre, ajustar stock), presionar **Enter** debe guardar y cerrar el modal automáticamente. Implementar con `onKeyDown` en el formulario o input principal:

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSave();
  }
}}
```

No aplicar esta regla en formularios grandes con múltiples secciones (como registro o edición completa de usuario), donde Enter en un campo debe pasar al siguiente.

### Campos obligatorios en formularios (OBLIGATORIO)

- Todo campo obligatorio debe usar `<TPField required label="...">` — esto muestra un asterisco al lado del label, del mismo color que el label (hereda el color).
- Cuando el usuario toca **Guardar / Aceptar** sin completar un campo requerido, se le debe pasar el prop `error="Campo requerido."` a `TPField`. Esto muestra el campo resaltado en rojo debajo del input.
- Patrón estándar: el componente mantiene un estado `submitted: boolean`. Cuando `submitted=true`, se evalúa si el campo está vacío y se pasa el `error` condicionalmente.

```tsx
const [submitted, setSubmitted] = useState(false);

function handleSave() {
  setSubmitted(true);
  if (!name.trim()) return; // validar antes de enviar
  // ... guardar
}

<TPField label="Nombre" required error={submitted && !name.trim() ? "Campo requerido." : null}>
  <TPInput value={name} onChange={setName} />
</TPField>
```

### Global custom events

Instant cross-component sync without refetch is done via `window.dispatchEvent`:
- `tptech:jewelry_logo_changed` — updates favicon immediately after logo upload
- `tptech:user_avatar_changed` — updates sidebar avatar immediately
- `tptech:user-pin-updated` — syncs PIN state in AuthContext
- `tptech:open_quick_switch` — opens the quick-user-switch UI

### Tailwind color opacity modifiers

**Crítico**: no todos los colores del tema soportan modificadores de opacidad (`/50`, `/20`).

| Color | Soporte `primary/20` |
|---|---|
| `primary`, `secondary`, `border` | ✅ usan `rgb(var(--*-rgb) / <alpha-value>)` |
| `text`, `bg`, `card`, `muted`, `surface`, `surface2` | ❌ usan `var(--*)` plano |

Para `text`, `muted`, etc. usar `opacity-*` de Tailwind en vez de `/`:
```tsx
// ❌ no funciona
<span className="text-text/50">...</span>

// ✅ correcto
<span className="text-text opacity-50">...</span>
```

### Comillas tipográficas (bug frecuente)

Nunca usar comillas curvas/tipográficas (`"` U+201C, `"` U+201D) como delimitadores en JSX o TypeScript. El parser de Babel falla con un error críptico de tokenización. Usar siempre comillas ASCII rectas (`"` U+0022). Este problema ocurre cuando se copia código desde editores de texto con "smart quotes" activado.

### Módulo de valuación (`src/components/valuation/`, `src/hooks/useValuation.ts`)

Fórmula de precio (única): `finalSalePrice = referenceValue × purity × saleFactor`.

- `MetalQuote` tiene un campo único `price` (antes había `purchasePrice` + `salePrice`, ya eliminados).
- El endpoint `/valuation/variants/:id/quotes` devuelve `price` (en la moneda de la cotización) y `basePrice` (convertido a moneda base).
- El hook `useValuation` expone todo el estado y acciones; las páginas no llaman `apiFetch` directamente.
- Cambios en valuación disparan el evento `tptech:valuation-changed` para sincronizar componentes.

### Campos obligatorios — asterisco en label (OBLIGATORIO)

Todo campo obligatorio debe mostrar un `*` al **final del label**, con el **mismo color del label** (nunca rojo ni color especial).

```tsx
<TPInput label="Nombre *" ... />
```

- Nunca usar `<span style="color:red">*</span>` ni clases especiales para el asterisco.
- Aplica a: `TPInput`, `TPTextarea`, `TPSelect`, `TPCombo`, `TPDate` y cualquier campo requerido.

### Tablas — ancho completo (OBLIGATORIO)

Todas las tablas deben ocupar el **100% del ancho disponible** de su contenedor. Siempre usar el wrapper estándar:

```tsx
<TPTableWrap>
  <TPTable>...</TPTable>
</TPTableWrap>
```

- Nunca usar `max-w-sm`, `max-w-md` ni widths fijos en tablas.
- Si el contenido supera el ancho, el wrapper activa scroll horizontal automáticamente.

### Tablas — sistema de columnas configurables (OBLIGATORIO)

Todas las tablas administrativas deben definir sus columnas como un array exportado, con estado de visibilidad manejado en el componente padre (no en la tabla):

```tsx
type ColDef = {
  key: string;
  label: string;
  width?: string;
  visible: boolean;
  canHide?: boolean;      // false = la columna no se puede ocultar (ej: nombre, acciones)
  align?: "left" | "right";
  sortKey?: SortKey;
};

export const MY_COLUMNS: ColDef[] = [
  { key: "name",    label: "Nombre",   visible: true,  canHide: false },
  { key: "city",    label: "Ciudad",   width: "160px", visible: true },
  { key: "notes",   label: "Notas",    visible: false },
  { key: "actions", label: "Acciones", width: "200px", visible: true, canHide: false, align: "right" },
];
export const MY_COL_LS_KEY = "tptech_col_myentity";
```

Reglas:
- Las columnas con `canHide: false` no aparecen en el picker (siempre visibles).
- El estado `colVis` se maneja en el **padre** (page/panel), no dentro de la tabla.
- El picker `<TPColumnPicker>` se ubica a la **derecha del buscador** en la toolbar.
- El dropdown usa `createPortal` + `position: fixed` para no quedar tapado por la tabla.
- Persistir visibilidad en `localStorage` con la clave `MY_COL_LS_KEY`.
- Columnas de acciones siempre al final, `align: "right"`.

## Diseño de pantallas nuevas — reglas base (OBLIGATORIO)

Antes de implementar cualquier pantalla nueva, verificar que cumple estas reglas:

### Estructura CRUD estándar

| Elemento | Cuándo aplicar |
|---|---|
| Listado con tabla + buscador | Siempre que haya más de un registro |
| Filtro por fechas | Cuando aplique por negocio o auditoría |
| Modal **View** (solo lectura) | Toda entidad con detalles que mostrar |
| Modal **Edit** | Toda entidad editable |
| Estado **Activo / Inactivo** | Cuando tenga sentido funcional |
| **Soft delete** con confirmación | Siempre que aplique; nunca hard delete sin justificación |
| **Favorito** | Cuando el usuario necesite destacar un registro por defecto |
| **Clonar** | Entidades complejas o con mucha información cargada |

### Soft delete y confirmación (OBLIGATORIO)

- Eliminar = soft delete (marcar como eliminado en DB), salvo justificación explícita.
- Siempre confirmar con `<ConfirmDeleteDialog>` o `<Modal>` con descripción del impacto.
- El botón de confirmar debe ser `variant="danger"`.

### Actualización automática de listas (OBLIGATORIO)

Toda alta, edición, activación, inactivación o eliminación debe reflejarse inmediatamente en la tabla sin que el usuario haga refresh manual:
- Llamar `refetch()` o actualizar el estado local directamente tras la operación exitosa.
- Para sincronización cruzada entre componentes usar `window.dispatchEvent(new CustomEvent("tptech:..."))`.

### Focus automático (OBLIGATORIO)

- Al abrir un modal o pantalla de alta/edición: foco automático en el primer campo útil.
- En modales simples (editar un valor), usar `useEffect` + `setTimeout(..., 50)` + `.focus()` + `.select()`.
- En formularios de creación, foco en el primer campo vacío.

### Orden de campos en formularios

1. Identificadores: nombre, código, SKU
2. Clasificación: tipo, categoría
3. Contacto: teléfono, email, dirección
4. Valores numéricos
5. Notas y campos opcionales al final

### Código limpio y modular

- No hacer refactors no solicitados.
- Reutilizar hooks, helpers y componentes existentes antes de crear nuevos.
- Mantener el estilo visual actual de TPTech.
- Para nuevas entidades con tabla + formulario + view + confirmación, seguir la estructura de **Users**, **Warehouses**, **Divisas** o **Valuation** como referencia.
