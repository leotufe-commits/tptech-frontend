// tptech-frontend/src/pages/SystemUiCatalog.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Palette,
  Code2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Database,
  UserRound,
  BadgeCheck,
  AlignLeft,
  AlignRight,
  BetweenHorizontalStart,
  Table2,
  RectangleHorizontal,
  MousePointerClick,
  Lock,
  Layers3,
  Trash2,
} from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";

import Modal from "../components/ui/Modal";
import ButtonBar from "../components/ui/ButtonBar";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";

import {
  TPBadge,
  TPSegmentedPills,
  TPStockBadge,
  TPStockLabelBadge,
  TPActiveBadge,
  TPUserStatusBadge,
} from "../components/ui/TPBadges";

import {
  TPTableWrap,
  TPTableHeader,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../components/ui/TPTable";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type TokenItem = { key: string; cssVar: string; value: string };

function TokenChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div
          className="h-5 w-5 rounded-md border border-border"
          style={{ background: value || "transparent" }}
          title={value}
        />
        <div className="text-xs font-semibold text-text break-all">{value || "—"}</div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}

function DemoButton({
  children,
  variant = "primary",
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground border-primary/30 hover:opacity-95"
      : variant === "danger"
      ? "bg-red-500/10 text-red-200 border-red-500/30 hover:bg-red-500/15"
      : "bg-card text-text border-border hover:bg-surface2";

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl border px-4 text-sm font-semibold transition",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        disabled && "opacity-60 cursor-not-allowed",
        cls
      )}
    >
      {children}
    </button>
  );
}

function DemoInput({ placeholder }: { placeholder: string }) {
  return (
    <input
      placeholder={placeholder}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      )}
    />
  );
}

function codeBox(lines: string[]) {
  return (
    <pre className="rounded-2xl border border-border bg-card p-3 text-xs text-muted overflow-auto">
      <code>{lines.join("\n")}</code>
    </pre>
  );
}

function Block({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-text">{title}</div>
        <Pill>real</Pill>
      </div>
      {desc ? <div className="text-sm text-muted mt-1">{desc}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function SystemUiCatalog() {
  const { theme, themes } = useTheme();
  const { user } = useAuth();

  const currentThemeLabel = useMemo(() => {
    return themes.find((t) => t.value === theme)?.label ?? String(theme);
  }, [themes, theme]);

  const [tokens, setTokens] = useState<TokenItem[]>([]);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);

    const wanted: Array<{ key: string; cssVar: string }> = [
      { key: "bg", cssVar: "--bg" },
      { key: "card", cssVar: "--card" },
      { key: "surface2", cssVar: "--surface2" },
      { key: "text", cssVar: "--text" },
      { key: "muted", cssVar: "--muted" },
      { key: "border", cssVar: "--border" },
      { key: "primary", cssVar: "--primary" },
      { key: "primary-foreground", cssVar: "--primary-foreground" },
    ];

    setTokens(
      wanted.map((t) => ({
        key: t.key,
        cssVar: t.cssVar,
        value: String(cs.getPropertyValue(t.cssVar) || "").trim(),
      }))
    );
  }, [theme]);

  const uiInventory = useMemo(
    () => [
      {
        group: "Core UI (src/components/ui)",
        items: [
          { name: "ButtonBar", file: "src/components/ui/ButtonBar.tsx" },
          { name: "Modal", file: "src/components/ui/Modal.tsx" },
          { name: "Toaster + toast helper", file: "src/components/ui/Toaster.tsx / src/lib/toast.ts" },
          { name: "ConfirmActionDialog", file: "src/components/ui/ConfirmActionDialog.tsx" },
          { name: "ConfirmDeleteDialog", file: "src/components/ui/ConfirmDeleteDialog.tsx" },
          { name: "ConfirmUnsavedChangesDialog", file: "src/components/ui/ConfirmUnsavedChangesDialog.tsx" },
          { name: "TPBadges", file: "src/components/ui/TPBadges.tsx" },
          { name: "TPTable", file: "src/components/ui/TPTable.tsx" },
          { name: "TPSort", file: "src/components/ui/TPSort.tsx" },
          { name: "TPComboCreatable", file: "src/components/ui/TPComboCreatable.tsx" },
          { name: "Tailwind helpers", file: "src/components/ui/tp.ts" },
        ],
      },
      {
        group: "Layout & navegación",
        items: [
          { name: "Sidebar", file: "src/components/Sidebar.tsx" },
          { name: "Topbar", file: "src/components/Topbar.tsx" },
          { name: "MainLayout", file: "src/layouts/MainLayout.tsx" },
          { name: "ThemeSwitcher", file: "src/components/ThemeSwitcher.tsx" },
        ],
      },
      {
        group: "UI de Usuarios",
        items: [
          { name: "UsersTable", file: "src/components/users/UsersTable.tsx" },
          { name: "UserEditModal", file: "src/components/users/UserEditModal.tsx" },
          { name: "UserView", file: "src/components/users/UserView.tsx" },
          { name: "UserPinSettings", file: "src/components/UserPinSettings.tsx" },
          { name: "PinFlowModal", file: "src/components/users/edit/sections/PinFlowModal.tsx" },
          {
            name: "SectionConfig / SectionData",
            file: "src/components/users/edit/sections/SectionConfig.tsx / SectionData.tsx",
          },
          { name: "users.ui", file: "src/components/users/users.ui.tsx" },
        ],
      },
      {
        group: "Apariencia (theme)",
        items: [
          { name: "ThemeContext", file: "src/context/ThemeContext.tsx" },
          { name: "themes.css", file: "src/styles/themes.css" },
          { name: "SystemThemeSettings", file: "src/pages/SystemThemeSettings.tsx" },
          { name: "SystemUiCatalog", file: "src/pages/SystemUiCatalog.tsx" },
        ],
      },
    ],
    []
  );

  const storageInfo = useMemo(() => {
    const uid = String((user as any)?.id ?? "").trim();
    return {
      publicKey: "tptech_theme:public",
      userKey: uid ? `tptech_theme:${uid}` : "(sin usuario logueado)",
    };
  }, [user]);

  const [segValue, setSegValue] = useState(false);

  // ✅ modal demos
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWideOpen, setModalWideOpen] = useState(false);
  const [modalBusyOpen, setModalBusyOpen] = useState(false);

  const [nestedParentOpen, setNestedParentOpen] = useState(false);
  const [nestedChildOpen, setNestedChildOpen] = useState(false);

  // ✅ confirm delete demos
  const [confirmDelOpen, setConfirmDelOpen] = useState(false);
  const [confirmDelTypedOpen, setConfirmDelTypedOpen] = useState(false);
  const [confirmDelLoading, setConfirmDelLoading] = useState(false);

  async function runFakeDelete(close: () => void) {
    try {
      setConfirmDelLoading(true);
      await new Promise((r) => setTimeout(r, 900));
      close();
    } finally {
      setConfirmDelLoading(false);
    }
  }

  return (
    // ✅ Wrapper en flex para que la toolbar sticky quede abajo del flujo
    <div className="min-h-0 h-full flex flex-col">
      {/* ✅ Contenido scrolleable */}
      <div className="p-4 md:p-6 space-y-6 min-h-0 flex-1 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-border bg-card grid place-items-center">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </div>

          <div className="min-w-0">
            <div className="text-lg font-semibold text-text">Catálogo UI</div>
            <div className="text-sm text-muted">
              Vista técnica de estilos actuales + inventario de componentes para planificar personalización.
            </div>
          </div>
        </div>

        {/* Tema actual + guardado */}
        <div className="tp-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text">Tema</div>
            <Pill>por usuario</Pill>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-text">Actual</div>
              <div className="text-sm text-muted mt-1">
                <span className="font-semibold text-text">{currentThemeLabel}</span>{" "}
                <span className="text-muted">({theme})</span>
              </div>

              <div
                className="mt-4 rounded-2xl p-3"
                style={{
                  border: "1px solid var(--border)",
                  background: "color-mix(in oklab, var(--card) 92%, var(--bg))",
                }}
              >
                <div className="text-xs font-semibold text-muted mb-2">ThemeSwitcher (variant=&quot;menu&quot;)</div>
                <ThemeSwitcher variant="menu" />
              </div>

              <div className="text-[11px] text-muted mt-2">Tip: también lo podés cambiar desde el Topbar.</div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold text-text">Persistencia</div>
              </div>

              <div className="text-sm text-muted">
                Se guarda en <span className="font-semibold text-text">localStorage</span> como:
              </div>

              {codeBox([
                `public: "${storageInfo.publicKey}"`,
                `user:   "${storageInfo.userKey}"`,
                "",
                `DOM: document.documentElement.setAttribute("data-theme", theme)`,
                `compat: class "theme-${theme}" y class "${theme}"`,
              ])}

              <div className="flex items-center gap-2 text-[11px] text-muted">
                <UserRound className="h-3.5 w-3.5 text-primary" />
                <span>
                  Usuario actual: <span className="font-semibold text-text">{user?.email ? user.email : "—"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold text-text">Temas disponibles (desde ThemeContext)</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {themes.map((t) => (
                <span
                  key={t.value}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    t.value === theme ? "border-primary/30 bg-primary/10 text-text" : "border-border bg-surface2 text-muted"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                  {t.label} <span className="opacity-70">({t.value})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tokens activos */}
        <div className="tp-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text">Tokens activos del tema</div>
            <Pill>CSS vars</Pill>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tokens.map((t) => (
              <TokenChip key={t.key} label={`${t.key} (${t.cssVar})`} value={t.value} />
            ))}
          </div>
        </div>

        {/* Preview REAL */}
        <div className="tp-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text">Preview real</div>
            <Pill>TPBadges + ButtonBar + TPTable + Modal + ConfirmDeleteDialog</Pill>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Block title="TPBadge" desc="Variantes por tone y size (tal cual en TPBadges.tsx).">
              <div className="flex flex-wrap gap-2">
                <TPBadge tone="neutral">Neutral</TPBadge>
                <TPBadge tone="primary">Primary</TPBadge>
                <TPBadge tone="info">Info</TPBadge>
                <TPBadge tone="success">Success</TPBadge>
                <TPBadge tone="warning">Warning</TPBadge>
                <TPBadge tone="danger">Danger</TPBadge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <TPBadge size="sm">SM</TPBadge>
                <TPBadge size="md">MD</TPBadge>
                <TPBadge tone="primary" size="sm">
                  Primary SM
                </TPBadge>
                <TPBadge tone="danger" size="md">
                  Danger MD
                </TPBadge>
              </div>
            </Block>

            <Block title="TPSegmentedPills" desc="Toggle real (value boolean).">
              <div className="flex items-center gap-3 flex-wrap">
                <TPSegmentedPills
                  value={segValue}
                  onChange={setSegValue}
                  labels={{ off: "Deshabilitado", on: "Habilitado" }}
                />
                <TPBadge tone={segValue ? "success" : "neutral"}>value: {segValue ? "true" : "false"}</TPBadge>
                <TPSegmentedPills value={true} onChange={() => {}} disabled />
              </div>
            </Block>

            <Block title="TPStockBadge / TPStockLabelBadge" desc="Stock numérico y etiqueta (0 / bajo / ok).">
              <div className="flex flex-wrap gap-2 items-center">
                <TPStockBadge n={0} />
                <TPStockBadge n={1} />
                <TPStockBadge n={5} />
                <TPStockBadge n={6} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <TPStockLabelBadge n={0} />
                <TPStockLabelBadge n={1} low={2} />
                <TPStockLabelBadge n={2} low={2} />
                <TPStockLabelBadge n={10} low={2} />
              </div>
            </Block>

            <Block title="TPActiveBadge / TPUserStatusBadge" desc="Badges usados en tablas/listados.">
              <div className="flex flex-wrap gap-2 items-center">
                <TPActiveBadge active />
                <TPActiveBadge active={false} />
                <TPUserStatusBadge status="ACTIVE" />
                <TPUserStatusBadge status="PENDING" />
                <TPUserStatusBadge status="BLOCKED" />
              </div>

              <div className="text-[11px] text-muted mt-3">
                Nota: PENDING/BLOCKED hoy se ven “Inactivo” (como está en tu archivo).
              </div>
            </Block>

            <Block title="ButtonBar" desc="Alineación y wrap reales (ButtonBar.tsx).">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted flex items-center gap-2">
                  <AlignLeft className="h-4 w-4 text-primary" /> align=&quot;left&quot;
                </div>
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <ButtonBar align="left">
                    <DemoButton variant="ghost">Cancelar</DemoButton>
                    <DemoButton variant="primary">Guardar</DemoButton>
                  </ButtonBar>
                </div>

                <div className="text-xs font-semibold text-muted flex items-center gap-2">
                  <AlignRight className="h-4 w-4 text-primary" /> align=&quot;right&quot; (default)
                </div>
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <ButtonBar>
                    <DemoButton variant="ghost">Volver</DemoButton>
                    <DemoButton variant="primary">Aplicar</DemoButton>
                  </ButtonBar>
                </div>

                <div className="text-xs font-semibold text-muted flex items-center gap-2">
                  <BetweenHorizontalStart className="h-4 w-4 text-primary" /> align=&quot;between&quot;
                </div>
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <ButtonBar align="between">
                    <DemoButton variant="ghost">Ayuda</DemoButton>
                    <div className="flex items-center gap-2">
                      <DemoButton variant="ghost">Cancelar</DemoButton>
                      <DemoButton variant="primary">Guardar</DemoButton>
                    </div>
                  </ButtonBar>
                </div>

                <div className="text-xs font-semibold text-muted">wrap=true</div>
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <ButtonBar align="left" wrap>
                    <DemoButton variant="ghost">Acción 1</DemoButton>
                    <DemoButton variant="ghost">Acción 2</DemoButton>
                    <DemoButton variant="ghost">Acción 3</DemoButton>
                    <DemoButton variant="ghost">Acción 4</DemoButton>
                    <DemoButton variant="ghost">Acción 5</DemoButton>
                    <DemoButton variant="primary">Guardar</DemoButton>
                  </ButtonBar>
                </div>
              </div>
            </Block>

            <Block title="TPTable" desc="Tabla real con header + rows + empty row (TPTable.tsx).">
              <div className="space-y-3">
                <TPTableWrap>
                  <TPTableHeader
                    left={
                      <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Ejemplo de tabla</span>
                        <TPBadge size="sm">3 filas</TPBadge>
                      </div>
                    }
                    right={
                      <ButtonBar>
                        <DemoButton variant="ghost">Exportar</DemoButton>
                        <DemoButton variant="primary">Nuevo</DemoButton>
                      </ButtonBar>
                    }
                  />
                  <TPTableEl>
                    <table className="w-full text-sm">
                      <TPThead>
                        <tr>
                          <TPTh className="text-left">Nombre</TPTh>
                          <TPTh className="text-left">Estado</TPTh>
                          <TPTh className="text-left">Stock</TPTh>
                          <TPTh className="text-left">Acciones</TPTh>
                        </tr>
                      </TPThead>

                      <TPTbody>
                        <TPTr>
                          <TPTd className="font-semibold text-text">Anillo Oro 18k</TPTd>
                          <TPTd>
                            <TPActiveBadge active />
                          </TPTd>
                          <TPTd>
                            <TPStockLabelBadge n={1} low={2} />
                          </TPTd>
                          <TPTd>
                            <ButtonBar align="left">
                              <DemoButton variant="ghost">Ver</DemoButton>
                              <DemoButton variant="primary">Editar</DemoButton>
                            </ButtonBar>
                          </TPTd>
                        </TPTr>

                        <TPTr>
                          <TPTd className="font-semibold text-text">Cadena Plata</TPTd>
                          <TPTd>
                            <TPActiveBadge active={false} />
                          </TPTd>
                          <TPTd>
                            <TPStockBadge n={0} />
                          </TPTd>
                          <TPTd>
                            <ButtonBar align="left">
                              <DemoButton variant="ghost">Ver</DemoButton>
                              <DemoButton variant="danger">Eliminar</DemoButton>
                            </ButtonBar>
                          </TPTd>
                        </TPTr>

                        <TPTr>
                          <TPTd className="font-semibold text-text">Pulsera Esmeralda</TPTd>
                          <TPTd>
                            <TPUserStatusBadge status="ACTIVE" />
                          </TPTd>
                          <TPTd>
                            <TPStockBadge n={10} />
                          </TPTd>
                          <TPTd>
                            <ButtonBar align="left">
                              <DemoButton variant="ghost">Duplicar</DemoButton>
                              <DemoButton variant="primary">Editar</DemoButton>
                            </ButtonBar>
                          </TPTd>
                        </TPTr>
                      </TPTbody>
                    </table>
                  </TPTableEl>
                </TPTableWrap>

                <TPTableWrap>
                  <TPTableHeader
                    left={
                      <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Tabla vacía</span>
                        <TPBadge tone="neutral" size="sm">
                          0 filas
                        </TPBadge>
                      </div>
                    }
                  />
                  <TPTableEl>
                    <table className="w-full text-sm">
                      <TPThead>
                        <tr>
                          <TPTh className="text-left">Columna A</TPTh>
                          <TPTh className="text-left">Columna B</TPTh>
                          <TPTh className="text-left">Columna C</TPTh>
                        </tr>
                      </TPThead>
                      <TPTbody>
                        <TPEmptyRow colSpan={3} text="No hay resultados." />
                      </TPTbody>
                    </table>
                  </TPTableEl>
                </TPTableWrap>
              </div>
            </Block>

            <Block title="Modal" desc="Modal draggable + stack + busy (Modal.tsx).">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted mb-2">
                    Abrí un modal y probá: <span className="font-semibold text-text">ESC</span>, click fuera, y drag en header.
                  </div>

                  <ButtonBar align="left" wrap>
                    <DemoButton variant="ghost" onClick={() => setModalOpen(true)}>
                      <MousePointerClick className="inline-block h-4 w-4 mr-2 text-primary" />
                      Abrir modal normal
                    </DemoButton>

                    <DemoButton variant="ghost" onClick={() => setModalWideOpen(true)}>
                      <RectangleHorizontal className="inline-block h-4 w-4 mr-2 text-primary" />
                      Abrir modal wide
                    </DemoButton>

                    <DemoButton variant="ghost" onClick={() => setModalBusyOpen(true)}>
                      <Lock className="inline-block h-4 w-4 mr-2 text-primary" />
                      Abrir modal busy
                    </DemoButton>

                    <DemoButton
                      variant="ghost"
                      onClick={() => {
                        setNestedParentOpen(true);
                        setNestedChildOpen(false);
                      }}
                    >
                      <Layers3 className="inline-block h-4 w-4 mr-2 text-primary" />
                      Abrir nested (stack)
                    </DemoButton>
                  </ButtonBar>
                </div>

                {/* MODAL normal */}
                <Modal open={modalOpen} title="Modal normal" onClose={() => setModalOpen(false)}>
                  <div className="space-y-3">
                    <div className="text-sm text-muted">
                      Este modal usa el overlay por defecto y permite cerrar por ESC/backdrop.
                    </div>

                    <div className="rounded-2xl border border-border bg-surface2 p-3">
                      <div className="text-sm font-semibold text-text mb-2">Contenido</div>
                      <div className="grid gap-2">
                        <DemoInput placeholder="Campo ejemplo…" />
                        <DemoInput placeholder="Otro campo…" />
                      </div>
                    </div>

                    <ButtonBar>
                      <DemoButton variant="ghost" onClick={() => setModalOpen(false)}>
                        Cancelar
                      </DemoButton>
                      <DemoButton variant="primary" onClick={() => setModalOpen(false)}>
                        Guardar
                      </DemoButton>
                    </ButtonBar>
                  </div>
                </Modal>

                {/* MODAL wide */}
                <Modal
                  open={modalWideOpen}
                  title="Modal wide (max-w-6xl)"
                  onClose={() => setModalWideOpen(false)}
                  wide
                >
                  <div className="space-y-3">
                    <div className="text-sm text-muted">
                      Mismo modal, pero con prop <span className="font-semibold text-text">wide</span>.
                    </div>

                    <TPTableWrap>
                      <TPTableHeader left={<span className="font-semibold">Tabla dentro del modal</span>} />
                      <TPTableEl>
                        <table className="w-full text-sm">
                          <TPThead>
                            <tr>
                              <TPTh className="text-left">Columna</TPTh>
                              <TPTh className="text-left">Valor</TPTh>
                            </tr>
                          </TPThead>
                          <TPTbody>
                            <TPTr>
                              <TPTd className="font-semibold text-text">Prop</TPTd>
                              <TPTd>wide=true</TPTd>
                            </TPTr>
                            <TPTr>
                              <TPTd className="font-semibold text-text">Overlay</TPTd>
                              <TPTd>stack-aware</TPTd>
                            </TPTr>
                          </TPTbody>
                        </table>
                      </TPTableEl>
                    </TPTableWrap>

                    <ButtonBar>
                      <DemoButton variant="ghost" onClick={() => setModalWideOpen(false)}>
                        Cerrar
                      </DemoButton>
                      <DemoButton variant="primary" onClick={() => setModalWideOpen(false)}>
                        Aceptar
                      </DemoButton>
                    </ButtonBar>
                  </div>
                </Modal>

                {/* MODAL busy */}
                <Modal
                  open={modalBusyOpen}
                  title="Modal busy (no cierra por ESC/backdrop)"
                  onClose={() => setModalBusyOpen(false)}
                  busy
                  overlayClassName="bg-black/55"
                >
                  <div className="space-y-3">
                    <div className="text-sm text-muted">
                      Con <span className="font-semibold text-text">busy=true</span> bloquea:
                      ESC, click afuera y botón “Cerrar”. El overlay está más oscuro con{" "}
                      <span className="font-semibold text-text">overlayClassName</span>.
                    </div>

                    <div className="rounded-2xl border border-border bg-surface2 p-3">
                      <div className="text-sm font-semibold text-text">Operación en curso…</div>
                      <div className="text-sm text-muted mt-1">Simulación: para cerrar usá el botón de abajo.</div>
                    </div>

                    <ButtonBar>
                      <DemoButton variant="ghost" onClick={() => setModalBusyOpen(false)}>
                        Forzar cierre (demo)
                      </DemoButton>
                    </ButtonBar>
                  </div>
                </Modal>

                {/* NESTED demo */}
                <Modal open={nestedParentOpen} title="Modal padre (stack)" onClose={() => setNestedParentOpen(false)}>
                  <div className="space-y-3">
                    <div className="text-sm text-muted">
                      Abrí el hijo: el overlay se suaviza y solo el top responde al ESC/backdrop.
                    </div>

                    <ButtonBar align="left">
                      <DemoButton variant="primary" onClick={() => setNestedChildOpen(true)}>
                        Abrir hijo
                      </DemoButton>
                      <DemoButton variant="ghost" onClick={() => setNestedParentOpen(false)}>
                        Cerrar padre
                      </DemoButton>
                    </ButtonBar>

                    <Modal open={nestedChildOpen} title="Modal hijo (topmost)" onClose={() => setNestedChildOpen(false)}>
                      <div className="space-y-3">
                        <div className="text-sm text-muted">
                          Este es el <span className="font-semibold text-text">top</span>. Probá ESC o click afuera.
                        </div>
                        <ButtonBar>
                          <DemoButton variant="ghost" onClick={() => setNestedChildOpen(false)}>
                            Volver
                          </DemoButton>
                          <DemoButton variant="primary" onClick={() => setNestedChildOpen(false)}>
                            Aceptar
                          </DemoButton>
                        </ButtonBar>
                      </div>
                    </Modal>
                  </div>
                </Modal>
              </div>
            </Block>

            <Block
              title="ConfirmDeleteDialog"
              desc="Confirmación destructiva (con overlay). Versión simple + versión con tipeo + loading."
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted mb-2">
                    Probá abrirlos y ver: overlay, bloqueo cuando{" "}
                    <span className="font-semibold text-text">loading</span>, y el caso de{" "}
                    <span className="font-semibold text-text">requireTypeToConfirm</span>.
                  </div>

                  <ButtonBar align="left" wrap>
                    <DemoButton
                      variant="danger"
                      onClick={() => {
                        setConfirmDelOpen(true);
                        setConfirmDelTypedOpen(false);
                      }}
                    >
                      <Trash2 className="inline-block h-4 w-4 mr-2" />
                      Eliminar (simple)
                    </DemoButton>

                    <DemoButton
                      variant="danger"
                      onClick={() => {
                        setConfirmDelTypedOpen(true);
                        setConfirmDelOpen(false);
                      }}
                    >
                      <Trash2 className="inline-block h-4 w-4 mr-2" />
                      Eliminar (con tipeo)
                    </DemoButton>
                  </ButtonBar>
                </div>

                <div className="text-[11px] text-muted">
                  Nota: este dialog hoy no usa <span className="font-semibold text-text">Modal.tsx</span> (tiene overlay
                  propio), así lo ves “tal cual” está implementado.
                </div>

                <ConfirmDeleteDialog
                  open={confirmDelOpen}
                  title="Eliminar artículo"
                  description="Esta acción no se puede deshacer."
                  dangerHint="Se eliminará el ítem y sus relaciones. Verificá que no esté usado en movimientos."
                  confirmText="Eliminar"
                  cancelText="Cancelar"
                  loading={confirmDelLoading}
                  onClose={() => {
                    if (confirmDelLoading) return;
                    setConfirmDelOpen(false);
                  }}
                  onConfirm={() => runFakeDelete(() => setConfirmDelOpen(false))}
                />

                <ConfirmDeleteDialog
                  open={confirmDelTypedOpen}
                  title="Eliminar usuario"
                  description="Acción destructiva. Se perderán accesos y relaciones."
                  requireTypeToConfirm
                  typeToConfirmText="ELIMINAR"
                  dangerHint="Esto no es reversible. Recomendado: desactivar usuario si es temporal."
                  confirmText="Eliminar definitivamente"
                  cancelText="Cancelar"
                  loading={confirmDelLoading}
                  onClose={() => {
                    if (confirmDelLoading) return;
                    setConfirmDelTypedOpen(false);
                  }}
                  onConfirm={() => runFakeDelete(() => setConfirmDelTypedOpen(false))}
                />
              </div>
            </Block>
          </div>
        </div>

        {/* Patrones visuales generales */}
        <div className="tp-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text">Patrones visuales generales</div>
            <Pill>preview</Pill>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-text">Botones</div>
              <div className="text-sm text-muted mt-1">Ejemplo aproximado con tokens actuales.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <DemoButton variant="primary">Primario</DemoButton>
                <DemoButton variant="ghost">Neutro</DemoButton>
                <DemoButton variant="danger">Peligro</DemoButton>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-text">Inputs</div>
              <div className="text-sm text-muted mt-1">Bordes, foco, placeholder y fondo.</div>
              <div className="mt-4 space-y-2">
                <DemoInput placeholder="Buscar…" />
                <DemoInput placeholder="Nombre / Email…" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-text">Estados</div>
              <div className="text-sm text-muted mt-1">Mensajes típicos que se ven en cards/modales.</div>
              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-border bg-surface2 p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <div className="text-sm text-text">
                    Guardado correcto <span className="text-muted">(ejemplo)</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface2 p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <div className="text-sm text-text">
                    Atención: falta completar un campo <span className="text-muted">(ejemplo)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventario */}
        <div className="tp-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-text">Inventario de UI existente (en tu repo)</div>
            <Pill>paths</Pill>
          </div>

          <div className="space-y-4">
            {uiInventory.map((g) => (
              <div key={g.group} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-semibold text-text">{g.group}</div>
                <div className="mt-3 space-y-2">
                  {g.items.map((it) => (
                    <div
                      key={it.file}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-border bg-surface2 px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-text">{it.name}</div>
                      <div className="text-xs text-muted break-all font-mono">{it.file}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-muted">
            Objetivo: transformar estilos en “opciones” (variantes de botones, densidad de tablas, radios, sombras,
            etc.) y luego guardarlo por usuario o por joyería.
          </div>
        </div>
      </div>

      {/* ✅ Toolbar abajo (sticky) */}
      <div
        className={cn("sticky bottom-0 z-20", "pt-3")}
        style={{
          background: "linear-gradient(to top, color-mix(in oklab, var(--bg) 92%, transparent), transparent)",
        }}
      >
        <div className="px-4 md:px-6 pb-4">
          <div className="rounded-2xl border border-border bg-card px-3 py-2" style={{ backdropFilter: "blur(8px)" }}>
            <ButtonBar align="between" wrap>
              <div className="flex items-center gap-2">
                <Pill>Toolbar</Pill>
                <span className="text-xs text-muted">
                  Tema: <span className="font-semibold text-text">{currentThemeLabel}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <DemoButton variant="ghost" onClick={() => setModalOpen(true)}>
                  Abrir modal
                </DemoButton>
                <DemoButton variant="ghost" onClick={() => setConfirmDelOpen(true)}>
                  Confirm delete
                </DemoButton>
                <DemoButton variant="primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Subir
                </DemoButton>
              </div>
            </ButtonBar>
          </div>
        </div>
      </div>
    </div>
  );
}
