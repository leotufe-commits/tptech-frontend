import React from "react";
import { Users } from "lucide-react";
import ConfiguracionSistemaEntidades from "./ConfiguracionSistemaEntidades";

export default function ConfiguracionSistemaClientes() {
  return (
    <ConfiguracionSistemaEntidades
      role="client"
      title="Clientes"
      subtitle="Gestioná la base de clientes de la joyería"
      icon={<Users size={22} />}
      detailBasePath="clientes"
      newLabel="Nuevo cliente"
      countLabel={(n) => `${n} ${n === 1 ? "cliente" : "clientes"}`}
      searchPlaceholder="Buscar por nombre, CUIT, email…"
      emptyText="Todavía no hay clientes registrados."
      deleteDescription="¿Estás seguro? Solo podés eliminar clientes sin movimientos en cuenta corriente."
    />
  );
}
