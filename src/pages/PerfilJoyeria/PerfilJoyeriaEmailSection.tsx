// src/pages/PerfilJoyeria/PerfilJoyeriaEmailSection.tsx
import React from "react";

import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";

import type { EmailConfigBody } from "./perfilJoyeria.types";

/* =========================
   Tipos
========================= */
type Props = {
  emailConfig: EmailConfigBody;
  setEmailField: <K extends keyof EmailConfigBody>(key: K, value: EmailConfigBody[K]) => void;
  readonly: boolean;
};

/* =========================
   Helpers de presentación
========================= */
const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--card)",
  boxShadow: "var(--shadow)",
};

const boxStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
};

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-sm">{children}</div>;
}

function BlockDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted mt-0.5 mb-4">{children}</p>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-3">
      {children}
    </div>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] leading-snug mt-1"
      style={{ color: "color-mix(in oklab, var(--muted) 70%, var(--text))" }}
    >
      {children}
    </div>
  );
}

/* =========================
   Vista readonly: resumen
========================= */
function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-text break-all">{value}</span>
    </div>
  );
}

function EmailConfigView({ emailConfig }: { emailConfig: EmailConfigBody }) {
  const hasIdentity = emailConfig.emailSenderName || emailConfig.emailSignature;
  const hasContact  = emailConfig.emailReplyTo || emailConfig.emailContact || emailConfig.emailPhone || emailConfig.emailWhatsapp;
  const hasFoot     = emailConfig.emailAddressLine || emailConfig.emailBusinessHours || emailConfig.emailWebsite || emailConfig.emailFooter;

  if (!hasIdentity && !hasContact && !hasFoot) {
    return (
      <div className="text-sm text-muted py-2">
        Sin configuración. Hacé clic en <b>Editar</b> para personalizar los correos del sistema.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hasIdentity && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Identidad del correo
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow label="Nombre del remitente" value={emailConfig.emailSenderName} />
          </div>
          {emailConfig.emailSignature && (
            <div className="mt-2">
              <div className="text-[11px] text-muted uppercase tracking-wide mb-1">Firma</div>
              <p className="text-sm text-text whitespace-pre-line">{emailConfig.emailSignature}</p>
            </div>
          )}
        </div>
      )}

      {hasContact && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Respuestas y contacto
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow label="Responder a"      value={emailConfig.emailReplyTo} />
            <InfoRow label="Email de contacto" value={emailConfig.emailContact} />
            <InfoRow label="Teléfono"          value={emailConfig.emailPhone} />
            <InfoRow label="WhatsApp"          value={emailConfig.emailWhatsapp} />
          </div>
        </div>
      )}

      {hasFoot && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Pie del correo
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow label="Dirección" value={emailConfig.emailAddressLine} />
            <InfoRow label="Horarios"  value={emailConfig.emailBusinessHours} />
            <InfoRow label="Sitio web" value={emailConfig.emailWebsite} />
          </div>
          {emailConfig.emailFooter && (
            <div className="mt-2">
              <div className="text-[11px] text-muted uppercase tracking-wide mb-1">Mensaje final</div>
              <p className="text-sm text-text whitespace-pre-line">{emailConfig.emailFooter}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Vista previa del correo
========================= */
function EmailPreview({ emailConfig }: { emailConfig: EmailConfigBody }) {
  const sender    = emailConfig.emailSenderName || "Tu joyería";
  const replyTo   = emailConfig.emailReplyTo;
  const signature = emailConfig.emailSignature;
  const contact   = emailConfig.emailContact;
  const phone     = emailConfig.emailPhone;
  const whatsapp  = emailConfig.emailWhatsapp;
  const address   = emailConfig.emailAddressLine;
  const hours     = emailConfig.emailBusinessHours;
  const website   = emailConfig.emailWebsite;
  const footer    = emailConfig.emailFooter;

  const hasContact   = contact || phone || whatsapp;
  const hasMeta      = address || hours || website;
  const hasFooter    = Boolean(footer);
  const hasSignature = Boolean(signature);

  return (
    <div
      className="rounded-2xl overflow-hidden text-sm"
      style={{ border: "1px solid var(--border)", background: "var(--surface2)" }}
    >
      {/* Cabecera tipo cliente de mail */}
      <div
        className="px-4 py-3 space-y-0.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="text-muted w-16 shrink-0">De:</span>
          <span className="text-text font-medium">
            {sender}{" "}
            <span className="text-muted font-normal">&lt;no-reply@tptech.com&gt;</span>
          </span>
        </div>
        {replyTo && (
          <div className="flex items-baseline gap-1.5 text-xs">
            <span className="text-muted w-16 shrink-0">Responder a:</span>
            <span className="text-text">{replyTo}</span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="text-muted w-16 shrink-0">Asunto:</span>
          <span className="text-muted italic">Asunto del correo automático</span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-4 py-4 space-y-3">
        {/* Cuerpo simulado */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full w-3/4" style={{ background: "var(--border)" }} />
          <div className="h-2.5 rounded-full w-full"   style={{ background: "var(--border)" }} />
          <div className="h-2.5 rounded-full w-5/6"   style={{ background: "var(--border)" }} />
        </div>

        {/* Firma */}
        {hasSignature && (
          <div
            className="pt-3 mt-1"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p className="text-xs text-muted whitespace-pre-line leading-relaxed">{signature}</p>
          </div>
        )}
      </div>

      {/* Pie */}
      {(hasContact || hasMeta || hasFooter) && (
        <div
          className="px-4 py-3 space-y-1"
          style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}
        >
          {hasContact && (
            <p className="text-[11px] text-muted">
              {[contact, phone, whatsapp].filter(Boolean).join("  ·  ")}
            </p>
          )}
          {hasMeta && (
            <p className="text-[11px] text-muted">
              {[address, hours, website].filter(Boolean).join("  ·  ")}
            </p>
          )}
          {hasFooter && (
            <p className="text-[11px] text-muted whitespace-pre-line">{footer}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Componente principal
========================= */
export default function PerfilJoyeriaEmailSection({ emailConfig, setEmailField, readonly }: Props) {
  let t = 100;

  /* ── Modo vista ─────────────────────────────────────────────── */
  if (readonly) {
    return (
      <div className="rounded-2xl p-4 sm:p-6 space-y-4" style={cardStyle}>
        <div className="font-semibold text-sm">Correos del sistema</div>
        <EmailConfigView emailConfig={emailConfig} />
        <div>
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
            Vista previa
          </div>
          <EmailPreview emailConfig={emailConfig} />
        </div>
      </div>
    );
  }

  /* ── Modo edición ───────────────────────────────────────────── */
  return (
    <div className="rounded-2xl p-4 sm:p-6 space-y-5" style={cardStyle}>

      {/* ── Bloque 1: Identidad del correo ──────────────────────── */}
      <div className="rounded-2xl p-4 sm:p-5" style={boxStyle}>
        <BlockTitle>Identidad del correo</BlockTitle>
        <BlockDesc>Así se verá el remitente cuando llegue el correo.</BlockDesc>

        <TPField label="Nombre del remitente">
          <TPInput
            tabIndex={t++}
            value={emailConfig.emailSenderName}
            onChange={(v) => setEmailField("emailSenderName", v)}
            placeholder="Ej: Joyería Pérez"
            disabled={readonly}
          />
          <HelpText>
            El cliente verá: <em>{emailConfig.emailSenderName || "Tu joyería"} &lt;no-reply@tptech.com&gt;</em>
          </HelpText>
        </TPField>

        <div className="mt-4">
          <TPField label="Firma">
            <TPTextarea
              tabIndex={t++}
              value={emailConfig.emailSignature}
              onChange={(v) => setEmailField("emailSignature", v)}
              placeholder={"Ej:\nEquipo de Joyería Pérez\nBuenos Aires, Argentina"}
              readOnly={readonly}
              disabled={readonly}
              className="min-h-[80px]"
            />
            <HelpText>Aparece al cierre del correo, antes del pie final.</HelpText>
          </TPField>
        </div>
      </div>

      {/* ── Bloque 2: Respuestas y contacto ─────────────────────── */}
      <div className="rounded-2xl p-4 sm:p-5" style={boxStyle}>
        <BlockTitle>Respuestas y contacto</BlockTitle>
        <BlockDesc>
          Configurá a dónde llegan las respuestas y qué datos de contacto se muestran en el correo.
        </BlockDesc>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TPField label="Email de respuesta">
            <TPInput
              tabIndex={t++}
              value={emailConfig.emailReplyTo}
              onChange={(v) => setEmailField("emailReplyTo", v)}
              placeholder="ventas@joyeriaperez.com"
              disabled={readonly}
            />
            <HelpText>Las respuestas de los clientes se enviarán a este correo.</HelpText>
          </TPField>

          <TPField label="Email de contacto">
            <TPInput
              tabIndex={t++}
              value={emailConfig.emailContact}
              onChange={(v) => setEmailField("emailContact", v)}
              placeholder="contacto@joyeriaperez.com"
              disabled={readonly}
            />
            <HelpText>Se muestra como contacto visible en el correo.</HelpText>
          </TPField>

          <TPField label="Teléfono">
            <TPInput
              tabIndex={t++}
              value={emailConfig.emailPhone}
              onChange={(v) => setEmailField("emailPhone", v)}
              placeholder="+54 11 1234-5678"
              disabled={readonly}
            />
          </TPField>

          <TPField label="WhatsApp">
            <TPInput
              tabIndex={t++}
              value={emailConfig.emailWhatsapp}
              onChange={(v) => setEmailField("emailWhatsapp", v)}
              placeholder="+54 9 11 1234-5678"
              disabled={readonly}
            />
          </TPField>
        </div>
      </div>

      {/* ── Bloque 3: Información del pie del correo ────────────── */}
      <div className="rounded-2xl p-4 sm:p-5 space-y-5" style={boxStyle}>
        <div>
          <BlockTitle>Información del pie del correo</BlockTitle>
          <BlockDesc>Estos datos se mostrarán al final de cada correo automático.</BlockDesc>
        </div>

        {/* Sub-grupo A: Datos del negocio */}
        <div>
          <SubLabel>Datos del negocio</SubLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TPField label="Dirección resumida">
              <TPInput
                tabIndex={t++}
                value={emailConfig.emailAddressLine}
                onChange={(v) => setEmailField("emailAddressLine", v)}
                placeholder="Florida 123, Buenos Aires"
                disabled={readonly}
              />
            </TPField>

            <TPField label="Horarios de atención">
              <TPInput
                tabIndex={t++}
                value={emailConfig.emailBusinessHours}
                onChange={(v) => setEmailField("emailBusinessHours", v)}
                placeholder="Lun–Vie 9–18 h"
                disabled={readonly}
              />
            </TPField>

            <TPField label="Sitio web">
              <TPInput
                tabIndex={t++}
                value={emailConfig.emailWebsite}
                onChange={(v) => setEmailField("emailWebsite", v)}
                placeholder="https://www.joyeriaperez.com"
                disabled={readonly}
              />
            </TPField>
          </div>
        </div>

        {/* Sub-grupo B: Mensaje final */}
        <div>
          <SubLabel>Mensaje final</SubLabel>
          <TPField label="Pie del correo">
            <TPTextarea
              tabIndex={t++}
              value={emailConfig.emailFooter}
              onChange={(v) => setEmailField("emailFooter", v)}
              placeholder={"Ej:\nEste mensaje fue enviado desde el sistema de gestión de Joyería Pérez.\nPor favor no respondas directamente a este correo."}
              readOnly={readonly}
              disabled={readonly}
              className="min-h-[80px]"
            />
            <HelpText>Mensaje legal o de cierre que va al pie del correo.</HelpText>
          </TPField>
        </div>
      </div>

      {/* ── Vista previa ─────────────────────────────────────────── */}
      <div>
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
          Vista previa
        </div>
        <EmailPreview emailConfig={emailConfig} />
      </div>

    </div>
  );
}
