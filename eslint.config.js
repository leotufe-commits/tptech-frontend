import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'

// =============================================================================
// FASE 1.0 — PR4. Reglas anti-rounding para forzar "frontend reader-only".
//
// Patrones prohibidos en lib/pricing, components/sales, pages/Ventas*,
// pages/Compras*:
//   1. `Math.round(X * 100) / 100`  → fix de floats típico de pricing (legacy).
//   2. `.toFixed(N)`                → formateo numérico (display debe usar
//                                     fmtMoney/fmtQty de lib/document-helpers
//                                     o el motor backend).
//
// "Recomputes monetarios" (qty × price, etc.) NO se detectan con AST genérico
// — quedan cubiertos via los tests E2E (PR5) y los snapshots (PR1).
//
// LEGACY EXCEPTIONS — archivos que YA violan los patterns y se migrarán en
// Fase 1.2+. La rule queda OFF en cada uno hasta que la migración los limpie.
// Removeremos entradas de esta lista a medida que cada archivo se migre.
// =============================================================================

const PRICING_RESTRICTED_PATHS = [
  'src/lib/pricing/**/*.{ts,tsx}',
  'src/components/sales/**/*.{ts,tsx}',
  'src/pages/Ventas*.tsx',
  'src/pages/Compras*.tsx',
]

const PRICING_LEGACY_EXCEPTIONS = [
  // lib/pricing — ramas legacy (r2 escalado per-unit×qty, resolveLegacyShipping).
  'src/lib/pricing/normalizePricingPreviewResult.ts',
  'src/lib/pricing/buildPricingPreviewPayload.ts',
  // lib/pricing/parityLogger.ts — uso INTENCIONAL: Math.round normaliza el
  // delta entre snapshots (a − b) para detectar boundary 0.01 sin float drift.
  // No es código de pricing migratable, es tooling de auditoría. Mantener.
  'src/lib/pricing/parityLogger.ts',
  // components/sales — splitLineDiscounts inline con round2 local.
  'src/components/sales/SalePricingPanel.tsx',
  'src/components/sales/SaleLineCompositionPre.tsx',
  // pages/Ventas* — POS, factura, NC, presupuestos, órdenes, cobros con round2.
  'src/pages/Ventas.tsx',
  'src/pages/VentasFacturas.tsx',
  'src/pages/VentasCobros.tsx',
  'src/pages/VentasNotasCredito.tsx',
  'src/pages/VentasOrdenes.tsx',
  'src/pages/VentasPresupuestos.tsx',
  // pages/Compras* — recomputeTotals + computeGlobalDiscount inline.
  'src/pages/ComprasFacturasProveedor.tsx',
  'src/pages/ComprasNotasCreditoProveedor.tsx',
  'src/pages/ComprasPagosProveedor.tsx',
  'src/pages/ComprasProveedores.tsx',
]

const ANTI_ROUNDING_PATTERNS = [
  {
    selector:
      "BinaryExpression[operator='/'][right.type='Literal'][right.value=100][left.type='CallExpression'][left.callee.type='MemberExpression'][left.callee.object.name='Math'][left.callee.property.name='round']",
    message:
      "Math.round(X * 100) / 100 prohibido en código de pricing. " +
      "El backend devuelve montos ya redondeados (POLICY.md R4.5). Si necesitás " +
      "redondear, hacelo en el motor backend; el frontend solo lee.",
  },
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message:
      ".toFixed prohibido en código de pricing. " +
      "Para mostrar dinero usar fmtMoney() de lib/document-helpers; el backend " +
      "devuelve montos formateables. Si es display de % usar Intl.NumberFormat.",
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'dist-node']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Vitest plugin para archivos de test: agrega reglas específicas y globals
  // (vi, expect, etc.). Mantenemos imports explícitos en los tests.
  // Relajamos `no-explicit-any` y `no-unused-vars` porque las fixtures de test
  // suelen castear mocks parciales y declarar helpers no usados en cada caso.
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
    languageOptions: {
      globals: { ...globals.browser, ...vitest.environments.env.globals },
    },
  },
  // FASE 1.0 PR4 — anti-rounding rule en paths restringidos.
  {
    files: PRICING_RESTRICTED_PATHS,
    ignores: [
      // Tests propios de los paths restringidos: las fixtures de baseline
      // necesitan replicar el contrato legacy (Math.round, toFixed) para
      // documentarlo. La validación del comportamiento legacy se hace en PR1.
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...ANTI_ROUNDING_PATTERNS],
    },
  },
  // EXCEPTIONS — apaga la rule en archivos legacy que se migrarán en
  // Fase 1.2+. Removemos entradas a medida que cada archivo se limpia.
  {
    files: PRICING_LEGACY_EXCEPTIONS,
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
