import React from "react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import TPAvatarUploader from "../../../components/ui/TPAvatarUploader";
import { TPAttachmentList } from "../../../components/ui/TPAttachmentList";
import type { SellerRow } from "../../../services/sellers";
import { formatDate, formatCommission, attachmentToTP } from "./vendedor.helpers";

interface Props {
  open: boolean;
  seller: SellerRow | null;
  onClose: () => void;
}

export function VendedorViewModal({ open, seller, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={seller?.displayName ?? "Detalle de vendedor"}
      maxWidth="xl"
      onClose={onClose}
      footer={
        <TPButton variant="secondary" onClick={onClose}>
          Cerrar
        </TPButton>
      }
    >
      {seller && (
        <div className="space-y-4">
          {seller.avatarUrl && (
            <div className="flex justify-center">
              <TPAvatarUploader
                src={seller.avatarUrl}
                name={seller.displayName}
                size={72}
                rounded="full"
                showActions={false}
                onUpload={async () => {}}
              />
            </div>
          )}

          <div className="text-sm divide-y divide-border">
            {(
              [
                ["Nombre completo", seller.displayName],
                [
                  "Documento",
                  seller.documentType || seller.documentNumber
                    ? `${seller.documentType ? seller.documentType + " " : ""}${seller.documentNumber}`
                    : "—",
                ],
                ["Email", seller.email || "—"],
                ["Teléfono", seller.phone || "—"],
                [
                  "Domicilio",
                  [
                    seller.street,
                    seller.streetNumber,
                    seller.city,
                    seller.province,
                    seller.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—",
                ],
                ["Comisión", formatCommission(seller)],
                [
                  "Almacenes",
                  seller.warehouses.length === 0
                    ? "Todos"
                    : seller.warehouses.map((w) => w.warehouse.name).join(", "),
                ],
                ["Estado", seller.isActive ? "Activo" : "Inactivo"],
                ["Creado", formatDate(seller.createdAt)],
                ...(seller.deletedAt
                  ? [["Fecha de baja", formatDate(seller.deletedAt)] as [string, string]]
                  : []),
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <span className="text-muted font-medium">{label}</span>
                <span className="text-text text-right">{value}</span>
              </div>
            ))}

            {seller.notes && (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-muted font-medium">Notas</span>
                <span className="text-text">{seller.notes}</span>
              </div>
            )}
          </div>

          {(seller.attachments ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Archivos adjuntos
              </div>
              <TPAttachmentList
                items={(seller.attachments ?? []).map(attachmentToTP)}
                onView={(item) => item.url && window.open(item.url, "_blank")}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
