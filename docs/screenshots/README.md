# Screenshots de Visual Regression — Fase 1.2

Este directorio contiene los screenshots manuales del playbook
`docs/fase-1-2-visual-regression-playbook.md`.

**Las imágenes están gitignoreadas** — solo se trackea este README y `.gitkeep`.

## Organización

```
docs/screenshots/
├── baseline-flag-off/                 ← captura inicial (flag OFF, 18 PNG)
├── step-1-splitLineDiscounts/         ← post-paso 1
├── step-2-round2-passthrough/
├── step-3-r2-article-path/
├── step-4-shipping-legacy/
├── step-5-calcLineTotals/
├── final-flag-on/                     ← captura cierre (flag ON, 18 PNG)
└── REGRESSIONS-step-N.md              ← uno por cada regresión detectada
```

## Naming convention

```
caso-NN-<slug>_<pantalla>[_FLAG].png
```

Ejemplos:
- `caso-01-producto-simple_simulador.png`             (baseline, sin flag suffix)
- `caso-01-producto-simple_factura_OFF.png`           (post-migración OFF)
- `caso-01-producto-simple_factura_ON.png`            (post-migración ON)

## Lifecycle

Estos PNG son temporales — al cerrar Fase 1.2 con cero regresiones, se
pueden eliminar localmente. Solo el README y los REGRESSIONS-*.md
permanecen versionados en git.
