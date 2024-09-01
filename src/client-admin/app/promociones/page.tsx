import React from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";

export default function PromosTable() {
  const columns = ["DIA", "PROMO", "PRECIO", "DESCRIPCION"];
  const rows = [
    {
      DIA: "LUNES",
      PROMO: "1/2 KG DE ALITAS 2X1",
      PRECIO: "$240.00",
      DESCRIPCION:
        "Todos los lunes son de alitas al 2x1 (Incluye apio, zanahoria y aderezo a elegir).",
    },
    {
      DIA: "MARTES",
      PROMO: "3 POLLOS AL PRECIO DE 2",
      PRECIO: "$430.00",
      DESCRIPCION:
        "Todos los martes te tratamos como rey (Incluye tortillas, totopos, limón, salsas y arroz).",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Promociones</h1>
        <DataTable columns={columns} rows={rows} />
      </div>
    </>
  );
}
