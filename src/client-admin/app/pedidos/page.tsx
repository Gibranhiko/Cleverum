import React from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";

export default function OrdersTable() {
  const columns = ["Nombre", "Orden", "Telefono", "Fecha"];
  const rows = [
    {
      Nombre: "Hector",
      Orden: "3 pollo, 2kg carne asada, 1 coca cola",
      Telefono: "423423432",
      Fecha: "August 27th, 2024, 11:52 AM",
    },
    {
      Nombre: "Hikio",
      Orden: "4 pollo, 1 coca cola",
      Telefono: "312312",
      Fecha: "August 28th, 2024, 3:45 PM",
    },
    {
      Nombre: "Gibran Villarreal",
      Orden: "2 pollo, 1 coca cola",
      Telefono: "8119939079",
      Fecha: "August 29th, 2024, 8:35 PM",
    },
    {
      Nombre: "Gibran V",
      Orden: "2 pollo",
      Telefono: "4123423",
      Fecha: "August 30th, 2024, 2:47 PM",
    },
    {
      Nombre: "Gibran",
      Orden: "1 pollo, 1/2kg costillas",
      Telefono: "123112",
      Fecha: "August 30th, 2024, 4:27 PM",
    },
    {
      Nombre: "Lobo",
      Orden: "3 pollo, 1 coca cola, 1kg costillas",
      Telefono: "124121324",
      Fecha: "August 30th, 2024, 4:28 PM",
    },
    {
      Nombre: "hiko",
      Orden: "3 pollo, 1kg costillas, 1 boneless, 3 pollo, 1 coca cola",
      Telefono: "4132423",
      Fecha: "August 31st, 2024, 1:26 PM",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <DataTable columns={columns} rows={rows} />
      </div>
    </>
  );  
}
