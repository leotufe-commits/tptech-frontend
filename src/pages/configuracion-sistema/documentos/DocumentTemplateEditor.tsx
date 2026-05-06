// src/pages/configuracion-sistema/documentos/DocumentTemplateEditor.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RotateCcw, Save,
  ChevronUp, ChevronDown,
  LayoutTemplate, Type, Columns, ToggleLeft, DollarSign, FileText,
  ZoomIn, ZoomOut, Search,
} from "lucide-react";
import { cn } from "../../../components/ui/tp";
import { TPSectionShell } from "../../../components/ui/TPSectionShell";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import { TPButton } from "../../../components/ui/TPButton";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import TPCheckbox from "../../../components/ui/TPCheckbox";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import { toast } from "../../../lib/toast";
import { TPAlert } from "../../../components/ui/TPAlert";
import {
  documentTemplatesApi,
  buildLocalDefaultConfig,
  DOC_KIND_LABELS,
  SECTIONS_META,
  SECTIONS_AVAILABLE,
  LOGO_POSITION_OPTIONS,
  LOGO_BORDER_RADIUS_MIN,
  LOGO_BORDER_RADIUS_MAX,
  LOGO_SIZE_MIN_MM,
  LOGO_SIZE_MAX_MM,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_PRESETS,
  PAGE_UNIT_OPTIONS,
  ORIENTATION_OPTIONS,
  FONT_FAMILY_OPTIONS,
  TABLE_STYLE_OPTIONS,
  PAGE_FORMAT_OPTIONS,
  PAGE_POSITION_OPTIONS,
  toMm,
  fromMm,
  type DocumentKind,
  type DocumentTemplateConfig,
  type ColumnConfig,
  type PageSizePreset,
} from "../../../services/document-templates";
import { fetchCompanyProfile } from "../../../services/company";
import DocumentPreview from "./DocumentPreview";

// ─────────────────────────────────────────────────────────────────────────────
// Zoom
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM_MIN     = 0.4;
const ZOOM_MAX     = 2.0;
const ZOOM_STEP    = 0.15;
const ZOOM_DEFAULT = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

type TabKey = "header" | "page" | "columns" | "sections" | "currency" | "footer";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "header",   label: "Encabezado",  icon: <LayoutTemplate size={14} /> },
  { key: "page",     label: "Página",      icon: <Type           size={14} /> },
  { key: "columns",  label: "Columnas",    icon: <Columns        size={14} /> },
  { key: "sections", label: "Secciones",   icon: <ToggleLeft     size={14} /> },
  { key: "currency", label: "Moneda",      icon: <DollarSign     size={14} /> },
  { key: "footer",   label: "Pie",         icon: <FileText       size={14} /> },
];

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  header:   "Datos de empresa, logo y texto personalizado que aparecen arriba del documento.",
  page:     "Tamaño, orientación, márgenes y tipografía del documento.",
  columns:  "Columnas de la tabla de artículos: visibilidad, ancho y alineación.",
  sections: "Bloques opcionales como vendedor, totales, firma, cotización y notas.",
  currency: "Cómo se muestran moneda, cotización, impuestos y decimales.",
  footer:   "Textos del pie: slogan, datos bancarios, legales y número de página.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-separador de sección (dentro de un card)
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-3 mb-1 first:mt-0">
      <span className="text-[10px] font-bold text-muted uppercase tracking-widest shrink-0 select-none">
        {label}
      </span>
      <div className="flex-1 h-px bg-border opacity-60" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PreviewPanel
// ─────────────────────────────────────────────────────────────────────────────

type PreviewPanelProps = {
  config:      DocumentTemplateConfig;
  kind:        DocumentKind;
  zoom:        number;
  onZoomIn:    () => void;
  onZoomOut:   () => void;
  onZoomReset: () => void;
  companyName?: string;
  logoUrl?:     string;
};

function PreviewPanel({ config, kind, zoom, onZoomIn, onZoomOut, onZoomReset, companyName, logoUrl }: PreviewPanelProps) {
  const PX_PER_MM = 380 / 210;
  const PAPER_W   = Math.round((config.pageWidthMm  ?? 210) * PX_PER_MM);
  const PAPER_H   = Math.round((config.pageHeightMm ?? 297) * PX_PER_MM);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(0);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    setCanvasW(el.getBoundingClientRect().width);
    const obs = new ResizeObserver(([entry]) => setCanvasW(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const PAD        = 40;
  const baseScale  = canvasW > PAD ? (canvasW - PAD) / PAPER_W : 1;
  const totalScale = +(baseScale * zoom).toFixed(3);
  const scaledW    = Math.ceil(PAPER_W * totalScale);
  const scaledH    = Math.ceil(PAPER_H * totalScale);

  return (
    <div className="flex flex-col gap-2">

      {/* ── Barra de zoom ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted select-none">
          <Search size={12} className="shrink-0" />
          <span className="font-medium">Vista previa</span>
        </div>

        <div className="flex items-center gap-0.5">
          <TPIconButton
            onClick={onZoomOut}
            disabled={zoom <= ZOOM_MIN}
            title="Reducir zoom"
            className="h-8 w-8 rounded-lg"
          >
            <ZoomOut size={14} />
          </TPIconButton>

          <TPButton
            variant="ghost"
            onClick={onZoomReset}
            title="Restablecer zoom"
            className="h-8 px-2 text-xs tabular-nums min-w-[48px]"
          >
            {Math.round(zoom * 100)}%
          </TPButton>

          <TPIconButton
            onClick={onZoomIn}
            disabled={zoom >= ZOOM_MAX}
            title="Ampliar zoom"
            className="h-8 w-8 rounded-lg"
          >
            <ZoomIn size={14} />
          </TPIconButton>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className="overflow-auto rounded-xl"
        style={{
          background: "#d1d5db",
          maxHeight:  "calc(100vh - 200px)",
          minHeight:  280,
        }}
      >
        <div style={{ padding: "20px", minWidth: scaledW + PAD }}>
          <div
            style={{
              width:    scaledW,
              height:   scaledH,
              margin:   "0 auto",
              position: "relative",
            }}
          >
            <div
              style={{
                transform:       `scale(${totalScale})`,
                transformOrigin: "top left",
                width:           PAPER_W,
                position:        "absolute",
                top:  0,
                left: 0,
                boxShadow: "0 4px 24px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.10)",
              }}
            >
              <DocumentPreview config={config} kind={kind} companyName={companyName} logoUrl={logoUrl || undefined} />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted text-center select-none opacity-60">
        Escala aproximada — no representa el PDF final
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentTemplateEditor() {
  const { kind: kindParam } = useParams<{ kind: string }>();
  const navigate = useNavigate();
  const kind = (kindParam?.toUpperCase() ?? "") as DocumentKind;

  const [config,             setConfig]             = useState<DocumentTemplateConfig | null>(null);
  const [loading,            setLoading]            = useState(true);
  const [usingLocalDefaults, setUsingLocalDefaults] = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("header");
  const [zoom,      setZoom]      = useState<number>(ZOOM_DEFAULT);
  const [companyName, setCompanyName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  const zoomIn    = useCallback(() => setZoom((z) => +Math.min(ZOOM_MAX, z + ZOOM_STEP).toFixed(2)), []);
  const zoomOut   = useCallback(() => setZoom((z) => +Math.max(ZOOM_MIN, z - ZOOM_STEP).toFixed(2)), []);
  const zoomReset = useCallback(() => setZoom(ZOOM_DEFAULT), []);

  useEffect(() => {
    fetchCompanyProfile()
      .then((p) => { setCompanyName(p.name); setCompanyLogoUrl(p.logoUrl); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!kind || !DOC_KIND_LABELS[kind]) { navigate(".."); return; }
    setLoading(true);
    setUsingLocalDefaults(false);
    documentTemplatesApi.get(kind)
      .then((t) => { setConfig(t); setUsingLocalDefaults(false); })
      .catch(() => { setConfig(buildLocalDefaultConfig(kind)); setUsingLocalDefaults(true); })
      .finally(() => setLoading(false));
  }, [kind, navigate]);

  const set = useCallback(<K extends keyof DocumentTemplateConfig>(
    key: K, value: DocumentTemplateConfig[K]
  ) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  async function handleSave() {
    if (!config) return;
    if (usingLocalDefaults) {
      toast.error("No se puede guardar: la conexión con el servidor no está disponible.");
      return;
    }
    setSaving(true);
    try {
      const updated = await documentTemplatesApi.save(kind, config);
      setConfig(updated);
      toast.success("Configuración guardada.");
    } catch {
      toast.error("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("¿Restaurar la configuración por defecto? Se perderán los cambios actuales.")) return;
    setResetting(true);
    try {
      const reset = await documentTemplatesApi.reset(kind);
      setConfig(reset);
      toast.success("Configuración restaurada.");
    } catch {
      toast.error("Error al restaurar.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <TPSectionShell title="Cargando…" icon={<LayoutTemplate size={22} />}>
        <div className="text-sm text-muted py-8 text-center">Cargando configuración…</div>
      </TPSectionShell>
    );
  }

  if (!config) return null;

  return (
    <TPSectionShell
      title={`Plantilla: ${DOC_KIND_LABELS[kind]}`}
      subtitle="Configurá cómo se genera este tipo de documento. Los cambios se reflejan en tiempo real en la vista previa."
      icon={<LayoutTemplate size={22} />}
      right={
        <div className="flex gap-2">
          <TPButton
            variant="secondary"
            onClick={handleReset}
            disabled={resetting || saving || usingLocalDefaults}
            loading={resetting}
            iconLeft={resetting ? undefined : <RotateCcw size={14} />}
          >
            {resetting ? "Restaurando…" : "Restaurar"}
          </TPButton>
          <TPButton
            variant="primary"
            onClick={handleSave}
            disabled={saving || resetting || usingLocalDefaults}
            loading={saving}
            iconLeft={saving ? undefined : <Save size={14} />}
          >
            {saving ? "Guardando…" : "Guardar"}
          </TPButton>
        </div>
      }
    >

      {/* ── Banner: defaults locales ── */}
      {usingLocalDefaults && (
        <div className="mb-4">
          <TPAlert tone="warning" title="Sin conexión con el servidor">
            No se pudo cargar la configuración guardada. Estás viendo los valores por defecto.
            Los cambios no se pueden guardar hasta que el servidor esté disponible.
          </TPAlert>
        </div>
      )}

      {/* ── Tab bar — ancho completo, encima de ambas columnas ── */}
      <div className="mb-1">
        <div className="rounded-xl bg-surface2 p-1 flex gap-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap",
                "rounded-lg transition-all shrink-0 select-none",
                activeTab === t.key
                  ? "bg-card shadow-sm text-text"
                  : "text-muted hover:text-text"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Descripción contextual del tab activo */}
        <p className="mt-2 px-1 text-xs text-muted leading-relaxed">
          {TAB_DESCRIPTIONS[activeTab]}
        </p>
      </div>

      {/* ── Layout 2 columnas ───────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start mt-4">

        {/* Panel izquierdo: configuración */}
        <div className="w-full lg:w-[500px] lg:shrink-0 min-w-0">
          <div className="space-y-5">
            {activeTab === "header"   && <TabHeader   config={config} set={set} />}
            {activeTab === "page"     && <TabPage     config={config} set={set} />}
            {activeTab === "columns"  && <TabColumns  config={config} kind={kind} set={set} />}
            {activeTab === "sections" && <TabSections config={config} kind={kind} set={set} />}
            {activeTab === "currency" && <TabCurrency config={config} set={set} />}
            {activeTab === "footer"   && <TabFooter   config={config} set={set} />}
          </div>
        </div>

        {/* Panel derecho: vista previa (sticky en desktop) */}
        <div className="w-full lg:flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start">
          <PreviewPanel
            config={config}
            kind={kind}
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            companyName={companyName}
            logoUrl={companyLogoUrl || undefined}
          />
        </div>

      </div>
    </TPSectionShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipo del setter
// ─────────────────────────────────────────────────────────────────────────────

type Setter = <K extends keyof DocumentTemplateConfig>(key: K, val: DocumentTemplateConfig[K]) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Encabezado
// ─────────────────────────────────────────────────────────────────────────────

function TabHeader({ config, set }: { config: DocumentTemplateConfig; set: Setter }) {
  function boolRow(key: keyof DocumentTemplateConfig, label: string) {
    return (
      <label
        key={String(key)}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface2 transition-colors cursor-pointer"
      >
        <TPCheckbox
          checked={config[key] as boolean}
          onChange={(v) => set(key, v as DocumentTemplateConfig[typeof key])}
        />
        <span className="text-sm text-text">{label}</span>
      </label>
    );
  }

  return (
    <>
      <TPCard title="Datos del encabezado">
        <div className="-mx-1">
          <SectionLabel label="Identidad" />
          {boolRow("headerLogoEnabled", "Logo de la empresa")}

          {config.headerLogoEnabled && (
            <div className="ml-8 mb-2 mt-0.5 space-y-3">

              {/* Posición */}
              <TPField label="Posición del logo">
                <div className="flex gap-1">
                  {LOGO_POSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("headerLogoPosition", opt.value)}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        (config.headerLogoPosition ?? "left") === opt.value
                          ? "bg-primary text-white border-primary"
                          : "bg-surface2 text-muted border-border hover:border-primary/40 hover:text-text"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </TPField>

              {/* Tamaño — slider */}
              <TPField
                label="Tamaño del logo"
                hint={`${config.headerLogoSize && !isNaN(Number(config.headerLogoSize)) ? config.headerLogoSize : "18"} mm de alto`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted shrink-0">{LOGO_SIZE_MIN_MM} mm</span>
                  <input
                    type="range"
                    min={LOGO_SIZE_MIN_MM}
                    max={LOGO_SIZE_MAX_MM}
                    step={1}
                    value={isNaN(Number(config.headerLogoSize)) ? 18 : Number(config.headerLogoSize)}
                    onChange={(e) => set("headerLogoSize", e.target.value)}
                    className="flex-1 accent-primary h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-muted shrink-0">{LOGO_SIZE_MAX_MM} mm</span>
                </div>
              </TPField>

              {/* Redondeo */}
              <TPField
                label="Redondeo del logo"
                hint={
                  (config.headerLogoBorderRadius ?? 20) === 0   ? "Cuadrado" :
                  (config.headerLogoBorderRadius ?? 20) >= 95   ? "Circular" :
                  `${config.headerLogoBorderRadius ?? 20}%`
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted shrink-0">□</span>
                  <input
                    type="range"
                    min={LOGO_BORDER_RADIUS_MIN}
                    max={LOGO_BORDER_RADIUS_MAX}
                    step={1}
                    value={config.headerLogoBorderRadius ?? 20}
                    onChange={(e) => set("headerLogoBorderRadius", Number(e.target.value))}
                    className="flex-1 accent-primary h-1.5 cursor-pointer"
                  />
                  <span className="text-[10px] text-muted shrink-0">○</span>
                </div>
              </TPField>

              {/* Hint sobre iniciales */}
              <p className="text-[11px] text-muted/70 leading-relaxed px-0.5">
                Si no hay logo cargado en Datos de empresa, se mostrarán las iniciales automáticamente.
              </p>
            </div>
          )}

          {boolRow("headerShowName", "Nombre comercial")}

          <SectionLabel label="Datos legales" />
          {boolRow("headerShowLegalName", "Razón social")}
          {boolRow("headerShowCuit",      "CUIT / Condición fiscal")}

          <SectionLabel label="Contacto" />
          {boolRow("headerShowAddress",   "Dirección")}
          {boolRow("headerShowPhone",     "Teléfono")}
          {boolRow("headerShowEmail",     "Email")}
          {boolRow("headerShowWebsite",   "Sitio web")}
        </div>
      </TPCard>

      <TPCard title="Imágenes">
        <div className="-mx-1">
          {boolRow("headerShowProductImage", "Mostrar imagen de producto / servicio")}
          <p className="text-xs text-muted mt-1 px-3 leading-relaxed">
            Incluye una miniatura junto a cada artículo en la tabla.
            Si la variante tiene imagen propia se usa esa; si no, se usa la del artículo padre.
          </p>
        </div>
      </TPCard>

      <TPCard
        title="Texto personalizado"
        collapsible
        defaultOpen={config.headerCustomText.length > 0}
      >
        <TPField hint="Aparece debajo de los datos de la empresa. Ideal para slogan, número de cuenta, etc.">
          <TPTextarea
            value={config.headerCustomText}
            onChange={(v) => set("headerCustomText", v)}
            rows={3}
            placeholder="Ej: Soluciones en joyería · Consultas al (011) 1234-5678"
          />
        </TPField>
      </TPCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Página y estilo
// ─────────────────────────────────────────────────────────────────────────────

function TabPage({ config, set }: { config: DocumentTemplateConfig; set: Setter }) {
  const [customUnit, setCustomUnit] = useState("mm");

  const presetInfo = PAGE_SIZE_PRESETS[config.pageSizePreset as PageSizePreset];
  const isTicket   = presetInfo?.isTicket ?? false;
  const isCustom   = config.pageSizePreset === "custom";

  function handlePresetChange(newPreset: string) {
    set("pageSizePreset", newPreset);
    set("isCustomSize", newPreset === "custom");
    if (newPreset !== "custom") {
      const info = PAGE_SIZE_PRESETS[newPreset as PageSizePreset];
      if (info) {
        const landscape = config.orientation === "landscape" && !info.isTicket;
        set("pageWidthMm",  landscape ? info.heightMm : info.widthMm);
        set("pageHeightMm", landscape ? info.widthMm  : info.heightMm);
      }
    }
    if (PAGE_SIZE_PRESETS[newPreset as PageSizePreset]?.isTicket) {
      set("orientation", "portrait");
    }
  }

  function handleOrientationChange(newOrientation: string) {
    if (isTicket) return;
    if (newOrientation !== config.orientation) {
      const w = config.pageWidthMm;
      const h = config.pageHeightMm;
      set("pageWidthMm",  h);
      set("pageHeightMm", w);
    }
    set("orientation", newOrientation);
  }

  return (
    <>
      {/* ── Tamaño y orientación ─────────────────────────────── */}
      <TPCard title="Tamaño y orientación">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TPField label="Tamaño de hoja">
              <TPComboFixed
                value={config.pageSizePreset}
                onChange={handlePresetChange}
                options={PAGE_SIZE_OPTIONS}
              />
            </TPField>

            {!isTicket && (
              <TPField label="Orientación">
                <TPComboFixed
                  value={config.orientation}
                  onChange={handleOrientationChange}
                  options={ORIENTATION_OPTIONS}
                />
              </TPField>
            )}
          </div>

          {/* Info térmico */}
          {isTicket && (
            <div className="rounded-xl border border-border bg-surface2 px-3 py-2.5 text-xs text-muted leading-relaxed">
              <span className="font-semibold text-text">Formato térmico (comandera).</span>
              {" "}{presetInfo?.note ?? "El alto es de referencia — el papel avanza según el contenido real."}
            </div>
          )}

          {/* Medidas personalizadas */}
          {isCustom && (
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <TPField label="Ancho" className="flex-1">
                  <TPNumberInput
                    value={fromMm(config.pageWidthMm, customUnit)}
                    onChange={(v) => set("pageWidthMm", toMm(v ?? 10, customUnit))}
                    min={10} max={fromMm(1500, customUnit)} step={1} decimals={1}
                  />
                </TPField>
                <TPField label="Alto" className="flex-1">
                  <TPNumberInput
                    value={fromMm(config.pageHeightMm, customUnit)}
                    onChange={(v) => set("pageHeightMm", toMm(v ?? 10, customUnit))}
                    min={10} max={fromMm(2000, customUnit)} step={1} decimals={1}
                  />
                </TPField>
                <TPField label="Unidad" className="w-28 shrink-0">
                  <TPComboFixed
                    value={customUnit}
                    onChange={(v: string) => setCustomUnit(v || "mm")}
                    options={PAGE_UNIT_OPTIONS}
                  />
                </TPField>
              </div>
              <p className="text-xs text-muted">
                Medidas guardadas en mm. Ref: A4 = 210 × 297 · Carta = 216 × 279.
              </p>
            </div>
          )}

          {/* Medidas actuales (solo lectura) */}
          {!isCustom && (
            <p className="text-xs text-muted tabular-nums">
              {config.pageWidthMm} × {config.pageHeightMm} mm
              {isTicket ? " · Continuo" : config.orientation === "landscape" ? " · Apaisado" : " · Vertical"}
            </p>
          )}
        </div>
      </TPCard>

      {/* ── Márgenes ─────────────────────────────────────────── */}
      <TPCard
        title="Márgenes"
        right={<span className="text-xs font-normal text-muted">en milímetros</span>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((field, i) => (
            <TPField key={field} label={["Superior", "Derecho", "Inferior", "Izquierdo"][i]}>
              <TPNumberInput
                value={config[field]}
                onChange={(v) => set(field, v ?? 15)}
                min={0} max={60} step={1} decimals={0}
              />
            </TPField>
          ))}
        </div>
      </TPCard>

      {/* ── Tipografía y estilo ──────────────────────────────── */}
      <TPCard title="Tipografía y estilo">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TPField label="Fuente base">
              <TPComboFixed
                value={config.fontFamily}
                onChange={(v: string) => set("fontFamily", v || "inter")}
                options={FONT_FAMILY_OPTIONS}
              />
            </TPField>
            <TPField label="Tamaño base (pt)">
              <TPNumberInput
                value={config.fontSizeBase}
                onChange={(v) => set("fontSizeBase", v ?? 10)}
                min={7} max={14} step={1} decimals={0}
              />
            </TPField>
            <TPField label="Estilo de tabla">
              <TPComboFixed
                value={config.tableStyle}
                onChange={(v: string) => set("tableStyle", v || "bordered")}
                options={TABLE_STYLE_OPTIONS}
              />
            </TPField>
            <TPField
              label="Color de acento"
              hint="Aplica a títulos y líneas del encabezado."
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-9 w-12 rounded-lg border border-border cursor-pointer shrink-0 p-0.5"
                />
                <TPInput
                  value={config.accentColor}
                  onChange={(v) => set("accentColor", v)}
                  placeholder="#1a1a1a"
                />
              </div>
            </TPField>
          </div>
        </div>
      </TPCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Columnas
// ─────────────────────────────────────────────────────────────────────────────

function TabColumns({
  config, kind, set,
}: { config: DocumentTemplateConfig; kind: DocumentKind; set: Setter }) {
  const cols = config.columns;

  function toggle(key: string) {
    set("columns", cols.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function move(key: string, dir: -1 | 1) {
    const arr = [...cols];
    const idx = arr.findIndex((c) => c.key === key);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    set("columns", arr.map((c, i) => ({ ...c, sortOrder: i })));
  }

  function setWidth(key: string, width: number | null) {
    set("columns", cols.map((c) => c.key === key ? { ...c, width: width ?? c.width } : c));
  }

  function setAlign(key: string, align: ColumnConfig["align"]) {
    set("columns", cols.map((c) => c.key === key ? { ...c, align } : c));
  }

  return (
    <TPCard title="Columnas de la tabla de ítems">
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Activá o desactivá columnas, ajustá su orden con las flechas y definí el ancho en puntos.
      </p>

      {/* Encabezado de la lista */}
      <div className="grid grid-cols-[1.5rem_1fr_4.5rem_5.5rem_2rem_2.5rem] gap-2 px-2 pb-2 border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wide">
        <span>#</span>
        <span>Columna</span>
        <span className="text-right">Ancho</span>
        <span className="text-center">Alineación</span>
        <span className="text-center">Vis</span>
        <span className="text-center">↕</span>
      </div>

      <div className="space-y-0.5 mt-1.5">
        {cols.map((col, idx) => (
          <div
            key={col.key}
            className={cn(
              "grid grid-cols-[1.5rem_1fr_4.5rem_5.5rem_2rem_2.5rem] gap-2 items-center px-2 py-1.5 rounded-xl",
              col.visible ? "bg-primary/5" : "opacity-40"
            )}
          >
            {/* Nro */}
            <span className="text-[11px] text-muted text-center tabular-nums">{idx + 1}</span>

            {/* Nombre */}
            <span className={cn("text-sm truncate", col.visible ? "text-text" : "text-muted")}>
              {col.label}
            </span>

            {/* Ancho */}
            <TPNumberInput
              value={col.width}
              onChange={(v) => setWidth(col.key, v)}
              min={20} max={300} step={5} decimals={0}
            />

            {/* Alineación */}
            <TPComboFixed
              value={col.align}
              onChange={(v: string) => setAlign(col.key, (v || "left") as ColumnConfig["align"])}
              options={[
                { value: "left",   label: "Izq." },
                { value: "center", label: "Cen." },
                { value: "right",  label: "Der." },
              ]}
            />

            {/* Visible */}
            <div className="flex justify-center">
              <TPCheckbox checked={col.visible} onChange={() => toggle(col.key)} />
            </div>

            {/* Orden */}
            <div className="flex flex-col items-center gap-0.5">
              <TPIconButton
                onClick={() => move(col.key, -1)}
                disabled={idx === 0}
                className="h-6 w-6 rounded-md border-0"
              >
                <ChevronUp size={11} />
              </TPIconButton>
              <TPIconButton
                onClick={() => move(col.key, 1)}
                disabled={idx === cols.length - 1}
                className="h-6 w-6 rounded-md border-0"
              >
                <ChevronDown size={11} />
              </TPIconButton>
            </div>
          </div>
        ))}
      </div>
    </TPCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Secciones
// ─────────────────────────────────────────────────────────────────────────────

function TabSections({
  config, kind, set,
}: { config: DocumentTemplateConfig; kind: DocumentKind; set: Setter }) {
  const available = SECTIONS_AVAILABLE[kind] ?? [];

  function toggle(key: string) {
    set("sections", { ...config.sections, [key]: !config.sections[key] });
  }

  return (
    <TPCard title="Secciones del documento">
      <p className="text-xs text-muted mb-4 leading-relaxed">
        Activá los bloques que deben aparecer en este tipo de documento.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {available.map((key) => {
          const meta   = SECTIONS_META[key];
          if (!meta) return null;
          const active = !!config.sections[key];

          return (
            <label
              key={key}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                active
                  ? "border-primary/30 bg-primary/5"
                  : "border-border hover:bg-surface2"
              )}
            >
              <TPCheckbox checked={active} onChange={() => toggle(key)} />
              <div className="min-w-0 pt-0.5">
                <div className={cn("text-sm font-medium leading-none", active ? "text-text" : "text-muted")}>
                  {meta.label}
                </div>
                <div className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
                  {meta.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </TPCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Moneda
// ─────────────────────────────────────────────────────────────────────────────

function TabCurrency({ config, set }: { config: DocumentTemplateConfig; set: Setter }) {
  function boolOption(
    key: keyof DocumentTemplateConfig,
    title: string,
    subtitle: string
  ) {
    const checked = config[key] as boolean;
    return (
      <label
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
          checked ? "border-primary/30 bg-primary/5" : "border-border hover:bg-surface2"
        )}
      >
        <TPCheckbox
          checked={checked}
          onChange={(v) => set(key, v as DocumentTemplateConfig[typeof key])}
        />
        <div>
          <div className={cn("text-sm font-medium", checked ? "text-text" : "text-muted")}>
            {title}
          </div>
          <div className="text-xs text-muted mt-0.5">{subtitle}</div>
        </div>
      </label>
    );
  }

  return (
    <TPCard title="Moneda y precios">
      <div className="space-y-3">
        {boolOption("currencyShowSymbol", "Mostrar símbolo de moneda", "Ej: $ 1.500,00")}
        {boolOption("currencyShowRate",   "Mostrar cotización",        "Tipo de cambio vigente al momento del documento.")}
        {boolOption("pricesIncludeTax",   "Precios con IVA incluido",  "El precio unitario ya incluye impuestos.")}

        <div className="pt-1">
          <TPField label="Decimales en precios">
            <TPNumberInput
              value={config.currencyDecimals}
              onChange={(v) => set("currencyDecimals", v ?? 2)}
              min={0} max={4} step={1} decimals={0}
            />
          </TPField>
        </div>
      </div>
    </TPCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Pie del documento
// ─────────────────────────────────────────────────────────────────────────────

function TabFooter({ config, set }: { config: DocumentTemplateConfig; set: Setter }) {
  return (
    <>
      {/* Texto de pie — siempre visible */}
      <TPCard title="Texto de pie">
        <TPField hint="Aparece al final del documento. Ideal para slogan o mensaje comercial.">
          <TPTextarea
            value={config.footerText}
            onChange={(v) => set("footerText", v)}
            rows={2}
            placeholder="Ej: Gracias por su confianza."
          />
        </TPField>
      </TPCard>

      {/* Datos bancarios — colapsable */}
      <TPCard
        title="Datos bancarios"
        collapsible
        defaultOpen={config.footerBankData.length > 0}
      >
        <TPField hint="Para cobros o transferencias.">
          <TPTextarea
            value={config.footerBankData}
            onChange={(v) => set("footerBankData", v)}
            rows={2}
            placeholder="Ej: CBU: 0000-1111-2222-3333 · Banco: Galicia"
          />
        </TPField>
      </TPCard>

      {/* Texto legal — colapsable */}
      <TPCard
        title="Texto legal"
        collapsible
        defaultOpen={config.footerLegalText.length > 0}
      >
        <TPField hint="Condiciones generales, avisos legales, etc.">
          <TPTextarea
            value={config.footerLegalText}
            onChange={(v) => set("footerLegalText", v)}
            rows={2}
            placeholder="Ej: Este presupuesto no tiene valor fiscal."
          />
        </TPField>
      </TPCard>

      {/* Términos y condiciones — colapsable */}
      <TPCard
        title="Términos y condiciones"
        collapsible
        defaultOpen={config.footerTerms.length > 0}
      >
        <TPField hint="Condiciones de entrega, garantía, política de devoluciones...">
          <TPTextarea
            value={config.footerTerms}
            onChange={(v) => set("footerTerms", v)}
            rows={3}
            placeholder="Condiciones de entrega, garantía, política de devoluciones..."
          />
        </TPField>
      </TPCard>

      {/* Paginación */}
      <TPCard title="Numeración de páginas">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <TPCheckbox
              checked={config.footerShowPageNumbers}
              onChange={(v) => set("footerShowPageNumbers", v)}
            />
            <span className="text-sm text-text">Mostrar número de página</span>
          </label>

          {config.footerShowPageNumbers && (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <TPField label="Formato">
                <TPComboFixed
                  value={config.footerPageFormat}
                  onChange={(v: string) => set("footerPageFormat", v || "page_of_total")}
                  options={PAGE_FORMAT_OPTIONS}
                />
              </TPField>
              <TPField label="Posición">
                <TPComboFixed
                  value={config.footerPagePosition}
                  onChange={(v: string) => set("footerPagePosition", v || "bottom_right")}
                  options={PAGE_POSITION_OPTIONS}
                />
              </TPField>
            </div>
          )}
        </div>
      </TPCard>
    </>
  );
}
