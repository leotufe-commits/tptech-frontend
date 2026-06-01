// src/components/sales/__tests__/SendInvoiceEmailModal.test.tsx
// =============================================================================
// 1.G — Cobertura del modal "Enviar factura por mail".
//
// Tests de COMPORTAMIENTO (no de CSS/snapshots). Verifican:
//   · subject default state-aware: BORRADOR / FACTURA ANULADA / Factura
//   · body default state-aware: 3 variantes de la linea descriptiva
//   · precarga del `to` desde customerEmail; vacio + hint si no hay
//   · validaciones inline (email regex / asunto / mensaje requeridos)
//   · boton deshabilitado durante loading
//   · onSubmit recibe payload exacto, saltos de linea preservados
//   · onClose se invoca al cancelar; bloqueado durante loading
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SendInvoiceEmailModal, {
  type SendInvoiceEmailModalProps,
  type SendInvoiceEmailStatus,
} from "../SendInvoiceEmailModal";

function makeProps(over: Partial<SendInvoiceEmailModalProps> = {}): SendInvoiceEmailModalProps {
  return {
    open:           true,
    invoiceNumber:  "A-0001-00000001",
    status:         "PENDING",
    customerEmail:  "cliente@example.com",
    customerName:   "Acme SA",
    jewelryName:    "Joyería Test",
    onClose:        vi.fn(),
    onSubmit:       vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

/** Helper — encuentra un input por label visible (TPInput renderea el label
 *  arriba del input con `text-xs font-medium text-muted`). */
function inputByLabel(label: string): HTMLInputElement | HTMLTextAreaElement {
  const labelEl = screen.getByText(label);
  // El input/textarea es el sibling del label en el wrapper.
  const wrap = labelEl.parentElement!;
  const el = wrap.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  if (!el) throw new Error(`No input under label "${label}"`);
  return el;
}

describe("SendInvoiceEmailModal — subject state-aware (joyería primero, 2026-05-27)", () => {
  it("DRAFT → '<Joyería> - BORRADOR <N°>'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "DRAFT", invoiceNumber: "VTA-0001" })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("Joyería Test - BORRADOR VTA-0001");
  });

  it("CANCELLED → '<Joyería> - FACTURA ANULADA <N°>'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "CANCELLED" })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("Joyería Test - FACTURA ANULADA A-0001-00000001");
  });

  it.each(["PENDING", "PARTIAL", "PAID"] as const)(
    "%s (estado final) → '<Joyería> - FACTURA <N°>' (mayúscula 2026-05-28)",
    (status) => {
      render(<SendInvoiceEmailModal {...makeProps({ status })} />);
      const subject = inputByLabel("Asunto") as HTMLInputElement;
      expect(subject.value).toBe("Joyería Test - FACTURA A-0001-00000001");
    },
  );

  it("sin jewelryName → omite ' - <Joyería>'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ jewelryName: null })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("FACTURA A-0001-00000001");
  });
});

describe("SendInvoiceEmailModal — body state-aware", () => {
  it("DRAFT → 'Te enviamos adjunto el borrador <N°>.'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "DRAFT", invoiceNumber: "VTA-0001" })} />);
    const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
    expect(msg.value).toContain("Te enviamos adjunto el borrador VTA-0001.");
    expect(msg.value).toContain("Hola Acme SA,");
    expect(msg.value).toContain("Muchas gracias.");
    expect(msg.value).toContain("Joyería Test");
  });

  it("CANCELLED → 'Te enviamos adjunta la factura anulada <N°>.'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "CANCELLED" })} />);
    const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
    expect(msg.value).toContain("Te enviamos adjunta la factura anulada A-0001-00000001.");
  });

  it.each(["PENDING", "PARTIAL", "PAID"] as const)(
    "%s → 'Te enviamos adjunta la factura <N°>.'",
    (status) => {
      render(<SendInvoiceEmailModal {...makeProps({ status })} />);
      const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
      expect(msg.value).toContain("Te enviamos adjunta la factura A-0001-00000001.");
    },
  );

  it("sin customerName → greeting genérico 'Hola,'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ customerName: null })} />);
    const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
    expect(msg.value.split("\n")[0]).toBe("Hola,");
  });
});

describe("SendInvoiceEmailModal — precarga email del cliente", () => {
  it("con customerEmail → precarga el campo 'to'", () => {
    render(<SendInvoiceEmailModal {...makeProps({ customerEmail: "x@y.com" })} />);
    const to = inputByLabel("Destinatario") as HTMLInputElement;
    expect(to.value).toBe("x@y.com");
    // No debe mostrar el hint cuando hay email cargado.
    expect(screen.queryByText(/El cliente no tiene email registrado/)).toBeNull();
  });

  it("sin customerEmail → campo vacio + hint visible", () => {
    render(<SendInvoiceEmailModal {...makeProps({ customerEmail: null })} />);
    const to = inputByLabel("Destinatario") as HTMLInputElement;
    expect(to.value).toBe("");
    expect(screen.getByText(/El cliente no tiene email registrado\. Ingresá uno manualmente\./)).toBeTruthy();
  });

  it("customerEmail vacio (string) → tratado como sin email", () => {
    render(<SendInvoiceEmailModal {...makeProps({ customerEmail: "" })} />);
    expect((inputByLabel("Destinatario") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/El cliente no tiene email registrado/)).toBeTruthy();
  });
});

describe("SendInvoiceEmailModal — validaciones inline", () => {
  it("email invalido al editar → error visible y boton deshabilitado", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSubmit })} />);
    const to = inputByLabel("Destinatario") as HTMLInputElement;
    fireEvent.change(to, { target: { value: "no-es-un-email" } });
    expect(screen.getByText("El email no es válido.")).toBeTruthy();
    const sendBtn = screen.getByRole("button", { name: /Enviar/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("asunto vacio en submit → muestra error 'El asunto es requerido.'", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSubmit })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    fireEvent.change(subject, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));
    await waitFor(() => {
      expect(screen.getByText("El asunto es requerido.")).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("mensaje vacio en submit → muestra error 'El mensaje es requerido.'", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSubmit })} />);
    const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
    fireEvent.change(msg, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));
    await waitFor(() => {
      expect(screen.getByText("El mensaje es requerido.")).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("antes del primer touch → no muestra errores (UX no irritante)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ customerEmail: null })} />);
    // El email esta vacio → ERROR existe, pero el touched es false hasta
    // que el operador interactua o intenta enviar.
    expect(screen.queryByText(/Ingresá el email del destinatario\./)).toBeNull();
  });
});

describe("SendInvoiceEmailModal — submit, loading, errores", () => {
  it("submit happy → onSubmit recibe payload con saltos de linea preservados", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSubmit })} />);
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.to).toBe("cliente@example.com");
    expect(payload.subject).toBe("Joyería Test - FACTURA A-0001-00000001");
    // El message default tiene 6 lineas (incluido un blank), separadas por \n.
    expect(payload.message.split("\n").length).toBe(6);
    // No debe haber sido trimmeado.
    expect(payload.message).toContain("\n\n");
  });

  it("loading=true → boton 'Enviando…' deshabilitado", () => {
    render(<SendInvoiceEmailModal {...makeProps({ loading: true })} />);
    const sendBtn = screen.getByRole("button", { name: /Enviando/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
    // Cancelar tambien queda deshabilitado.
    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading=true → onClose NO se invoca al intentar cerrar", () => {
    const onClose = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ loading: true, onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("click Cancelar (sin loading) → onClose se invoca", () => {
    const onClose = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onSubmit que tira error → modal NO se cierra (el caller decide)", async () => {
    // El modal no muestra el toast ni cierra — eso es responsabilidad del
    // caller (VentasFacturas). Aca solo verificamos que el error NO rompe
    // el modal y que onClose no se llama automaticamente.
    const onSubmit = vi.fn().mockRejectedValue(new Error("server boom"));
    const onClose  = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ onSubmit, onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // El modal sigue montado.
    expect(screen.getByText("Enviar factura por mail")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("SendInvoiceEmailModal — open/close lifecycle", () => {
  it("re-open con props distintas → re-hidrata defaults", () => {
    const { rerender } = render(
      <SendInvoiceEmailModal {...makeProps({ status: "DRAFT", invoiceNumber: "VTA-0001" })} />,
    );
    let subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("Joyería Test - BORRADOR VTA-0001");

    // Cerrar.
    rerender(<SendInvoiceEmailModal {...makeProps({ open: false, status: "DRAFT", invoiceNumber: "VTA-0001" })} />);

    // Re-abrir con otro status + invoice number → defaults nuevos.
    rerender(<SendInvoiceEmailModal {...makeProps({ open: true, status: "PAID", invoiceNumber: "A-0001-00000005" })} />);
    subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("Joyería Test - FACTURA A-0001-00000005");
  });
});

// Sanity types — fuerza que el enum se mantenga estable.
function _typeFenceStatus(_s: SendInvoiceEmailStatus): void { /* compile-only */ }
_typeFenceStatus("DRAFT");
_typeFenceStatus("PENDING");
_typeFenceStatus("PARTIAL");
_typeFenceStatus("PAID");
_typeFenceStatus("CANCELLED");

describe("SendInvoiceEmailModal — plantilla persistida (interpolacion)", () => {
  it("con defaultSubjectTemplate → INTERPOLA variables y reemplaza el default state-aware", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      status:                "PENDING",
      defaultSubjectTemplate: "{{estado}} {{numero}} para {{cliente}} de {{joyeria}}",
    })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    expect(subject.value).toBe("Factura A-0001-00000001 para Acme SA de Joyería Test");
  });

  it("con defaultMessageTemplate → interpola y precarga el body", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      status:                 "DRAFT",
      defaultMessageTemplate: "Hola {{cliente}}, adjunto {{estado}} {{numero}}.\nGracias.",
      invoiceNumber:          "VTA-0009",
    })} />);
    const msg = inputByLabel("Mensaje") as HTMLTextAreaElement;
    expect(msg.value).toBe("Hola Acme SA, adjunto BORRADOR VTA-0009.\nGracias.");
  });

  it("CANCELLED + plantilla → {{estado}} = 'FACTURA ANULADA'", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      status:                 "CANCELLED",
      defaultSubjectTemplate: "{{estado}} {{numero}}",
    })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toBe("FACTURA ANULADA A-0001-00000001");
  });

  it("con invoiceDate → {{fecha}} se interpola", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      invoiceDate:            "26/05/2026",
      defaultSubjectTemplate: "Factura {{numero}} - {{fecha}}",
    })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toBe("Factura A-0001-00000001 - 26/05/2026");
  });

  it("plantilla vacia → cae al default state-aware (no rompe)", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      status:                 "PENDING",
      defaultSubjectTemplate: "",
      defaultMessageTemplate: "   ",   // solo whitespace = vacio
    })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toBe("Joyería Test - FACTURA A-0001-00000001");
  });
});

describe("SendInvoiceEmailModal — boton 'Guardar como predeterminado'", () => {
  it("sin onSaveAsTemplate → NO renderea el boton", () => {
    render(<SendInvoiceEmailModal {...makeProps()} />);
    expect(screen.queryByRole("button", { name: /Guardar como predeterminado/i })).toBeNull();
  });

  it("con onSaveAsTemplate → renderea el boton (disabled hasta que haya dirty-state)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn().mockResolvedValue(undefined) })} />);
    const btn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect(btn).toBeTruthy();
    // Al abrir, subject/message coinciden con la baseline → no dirty → disabled.
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Guardar — habilita al modificar el asunto, click llama onSaveAsTemplate con valores actuales", async () => {
    const onSaveAsTemplate = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate })} />);
    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(inputByLabel("Asunto"), { target: { value: "{{estado}} {{numero}} - {{joyeria}}" } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(saveBtn);
    await waitFor(() => expect(onSaveAsTemplate).toHaveBeenCalledTimes(1));
    expect(onSaveAsTemplate.mock.calls[0]![0].subjectTemplate).toBe("{{estado}} {{numero}} - {{joyeria}}");
  });

  it("Guardar — habilita al modificar el mensaje", () => {
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn().mockResolvedValue(undefined) })} />);
    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(inputByLabel("Mensaje"), { target: { value: "Hola {{cliente}}, va el {{numero}}." } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Guardar — vuelve a disabled tras guardar exitosamente (re-baseline)", async () => {
    const onSaveAsTemplate = vi.fn().mockResolvedValue(undefined);
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate })} />);
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "Nuevo {{numero}}" } });
    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(saveBtn);
    await waitFor(() => expect(onSaveAsTemplate).toHaveBeenCalled());
    // Re-baseline: los valores recien guardados son la nueva plantilla.
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Guardar — error al guardar mantiene dirty-state (operador puede reintentar)", async () => {
    const onSaveAsTemplate = vi.fn().mockRejectedValue(new Error("boom"));
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate })} />);
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "Nuevo {{numero}}" } });
    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });

    fireEvent.click(saveBtn);
    await waitFor(() => expect(onSaveAsTemplate).toHaveBeenCalled());
    // El boton vuelve a estar HABILITADO (NO re-baseline porque hubo error).
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Guardar — NO cierra el modal tras guardar (operador puede seguir enviando)", async () => {
    const onSaveAsTemplate = vi.fn().mockResolvedValue(undefined);
    const onClose          = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate, onClose })} />);
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar como predeterminado/i }));
    await waitFor(() => expect(onSaveAsTemplate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Enviar factura por mail")).toBeTruthy();
  });

  it("loading del envio (Enviar) → Guardar tambien deshabilitado", () => {
    render(<SendInvoiceEmailModal {...makeProps({ loading: true, onSaveAsTemplate: vi.fn() })} />);
    const btn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SendInvoiceEmailModal — boton 'Restaurar texto'", () => {
  it("sin onSaveAsTemplate → NO renderea el boton (es parte del bloque de plantilla)", () => {
    render(<SendInvoiceEmailModal {...makeProps()} />);
    expect(screen.queryByRole("button", { name: /Restaurar texto/i })).toBeNull();
  });

  it("disabled inicialmente (no hay dirty-state)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn() })} />);
    const btn = screen.getByRole("button", { name: /Restaurar texto/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("se habilita al modificar y restaura subject + message al default", () => {
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn() })} />);
    const subject = inputByLabel("Asunto")  as HTMLInputElement;
    const msg     = inputByLabel("Mensaje") as HTMLTextAreaElement;
    const original = { subject: subject.value, message: msg.value };

    fireEvent.change(subject, { target: { value: "Hola cambiado" } });
    fireEvent.change(msg,     { target: { value: "Mensaje cambiado" } });
    const restoreBtn = screen.getByRole("button", { name: /Restaurar texto/i });
    expect((restoreBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(restoreBtn);
    expect((inputByLabel("Asunto")  as HTMLInputElement).value).toBe(original.subject);
    expect((inputByLabel("Mensaje") as HTMLTextAreaElement).value).toBe(original.message);
    // Tras restaurar, vuelve a no haber dirty-state.
    expect((restoreBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Restaurar NO cierra el modal ni toca el destinatario", () => {
    const onClose = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn(), onClose })} />);
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "Cambio" } });
    const toValue = (inputByLabel("Destinatario") as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("button", { name: /Restaurar texto/i }));
    expect(onClose).not.toHaveBeenCalled();
    expect((inputByLabel("Destinatario") as HTMLInputElement).value).toBe(toValue);
  });
});

describe("SendInvoiceEmailModal — label de variables (ajuste UX)", () => {
  it("NUNCA se renderea (hint ocultado para simplificar el modal)", () => {
    // Probamos con y sin onSaveAsTemplate; en ningun caso debe aparecer.
    render(<SendInvoiceEmailModal {...makeProps()} />);
    expect(screen.queryByText(/Variables disponibles/i)).toBeNull();
  });

  it("NUNCA se renderea con onSaveAsTemplate (el soporte de variables sigue activo, solo el label esta oculto)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ onSaveAsTemplate: vi.fn() })} />);
    expect(screen.queryByText(/Variables disponibles/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-05-27 — Separacion plantilla / envio + footer alignment + unif TPButton
// ─────────────────────────────────────────────────────────────────────────────

describe("SendInvoiceEmailModal — Guardar/Restaurar independientes del email", () => {
  it("Guardar — habilita al modificar el ASUNTO aunque el destinatario este vacio", () => {
    // Cliente sin email registrado → campo `to` vacio al abrir el modal.
    render(<SendInvoiceEmailModal {...makeProps({
      onSaveAsTemplate: vi.fn(),
      customerEmail: null,
    })} />);

    const to       = inputByLabel("Destinatario") as HTMLInputElement;
    const saveBtn  = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect(to.value).toBe("");
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true); // sin dirty aun

    // Modificamos solo el asunto. El destinatario sigue vacio.
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "Mi asunto nuevo {{numero}}" } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Guardar — habilita al modificar el MENSAJE aunque el destinatario sea invalido", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      onSaveAsTemplate: vi.fn(),
      customerEmail: "esto-no-es-un-email",
    })} />);

    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    fireEvent.change(inputByLabel("Mensaje"), { target: { value: "Hola {{cliente}}, va." } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Enviar — sigue DISABLED si el destinatario es invalido (regla de envio intacta)", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      customerEmail: "invalido-no-arroba",
    })} />);
    const sendBtn = screen.getByRole("button", { name: /Enviar/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Enviar — habilitado cuando hay email valido + subject + message", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      customerEmail: "cliente@example.com",
    })} />);
    const sendBtn = screen.getByRole("button", { name: /Enviar/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Guardar — sigue disabled si SUBJECT esta vacio (contentErrors gana)", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      onSaveAsTemplate: vi.fn(),
      customerEmail: null,
    })} />);
    // Vaciar el asunto → contentErrors.subject = true → Guardar disabled
    fireEvent.change(inputByLabel("Asunto"), { target: { value: "" } });
    const saveBtn = screen.getByRole("button", { name: /Guardar como predeterminado/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Restaurar — funciona sin email cargado", () => {
    render(<SendInvoiceEmailModal {...makeProps({
      onSaveAsTemplate: vi.fn(),
      customerEmail: null,
    })} />);
    const subject = inputByLabel("Asunto") as HTMLInputElement;
    const original = subject.value;
    fireEvent.change(subject, { target: { value: "Cambio sin email" } });

    const restoreBtn = screen.getByRole("button", { name: /Restaurar texto/i });
    expect((restoreBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(restoreBtn);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toBe(original);
  });
});

describe("SendInvoiceEmailModal — Cancelar/Enviar unificados (variantes TPButton)", () => {
  it("Cancelar usa h-[42px] de TP_BTN_SECONDARY (mismo height que TP_BTN_PRIMARY de Enviar)", () => {
    render(<SendInvoiceEmailModal {...makeProps()} />);
    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    const sendBtn   = screen.getByRole("button", { name: /Enviar/i });
    // Ambos comparten la utilidad de altura fija de tp.ts.
    expect(cancelBtn.className).toMatch(/h-\[42px\]/);
    expect(sendBtn.className).toMatch(/h-\[42px\]/);
    // Ambos usan rounded-xl (no rounded-lg del ghost variant viejo).
    expect(cancelBtn.className).toMatch(/rounded-xl/);
    expect(sendBtn.className).toMatch(/rounded-xl/);
  });

  it("Cancelar dispara onClose y NO depende del email", () => {
    const onClose = vi.fn();
    render(<SendInvoiceEmailModal {...makeProps({ customerEmail: null, onClose })} />);
    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SendInvoiceEmailModal — formato asunto Joyería - ESTADO N° (2026-05-27)", () => {
  it("Templates persistidos en DocumentTemplate tienen prioridad sobre el default nuevo", () => {
    // Si el operador ya guardo un template propio, se respeta tal cual
    // interpolado, sin aplicar el nuevo formato "Joyería primero".
    render(<SendInvoiceEmailModal {...makeProps({
      defaultSubjectTemplate: "Documento {{numero}} :: {{joyeria}}",
      status: "PENDING",
    })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value)
      .toBe("Documento A-0001-00000001 :: Joyería Test");
  });

  // 2026-05-28 — Estado SIEMPRE en mayuscula (BORRADOR / FACTURA / FACTURA
  // ANULADA). Uniforma el casing visual y refuerza la identidad del
  // comprobante en la bandeja del cliente.
  it("estado FINAL usa 'FACTURA' en mayuscula (no 'Factura')", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "PENDING" })} />);
    const subject = (inputByLabel("Asunto") as HTMLInputElement).value;
    expect(subject).toMatch(/FACTURA\s/);
    expect(subject).not.toMatch(/\bFactura\s/); // Title case viejo NO debe aparecer
  });

  it("estado DRAFT usa 'BORRADOR' (ya era mayuscula, sanity check)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "DRAFT" })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toMatch(/BORRADOR\s/);
  });

  it("estado CANCELLED usa 'FACTURA ANULADA' (mayuscula compuesta)", () => {
    render(<SendInvoiceEmailModal {...makeProps({ status: "CANCELLED" })} />);
    expect((inputByLabel("Asunto") as HTMLInputElement).value).toMatch(/FACTURA ANULADA/);
  });
});
