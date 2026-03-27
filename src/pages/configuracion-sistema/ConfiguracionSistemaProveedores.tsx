import React from "react";
import { Truck } from "lucide-react";
import ConfiguracionSistemaEntidades from "./ConfiguracionSistemaEntidades";

export default function ConfiguracionSistemaProveedores() {
  return (
    <ConfiguracionSistemaEntidades
      role="supplier"
      title="Proveedores"
      subtitle="Gestioná la base de proveedores de la joyería"
      icon={<Truck size={22} />}
      detailBasePath="proveedores"
      newLabel="Nuevo proveedor"
      countLabel={(n) => `${n} ${n === 1 ? "proveedor" : "proveedores"}`}
      searchPlaceholder="Buscar por nombre, CUIT, email…"
      emptyText="Todavía no hay proveedores registrados."
      deleteDescription="¿Estás seguro? Solo podés eliminar proveedores sin movimientos en cuenta corriente."
    />
  );
}
