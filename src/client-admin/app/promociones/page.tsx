import React from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";
import Promo from "../interfaces/Promo";

export default function PromosTable() {
  const columns = ["dia", "promo", "precio", "descripcion"];
  const rows: Promo[] = [
    {
      _id: "1",
      dia: "LUNES",
      promo: "1/2 KG DE ALITAS 2X1",
      precio: "$240.00",
      descripcion:
        "Todos los lunes son de alitas al 2x1 (Incluye apio, zanahoria y aderezo a elegir).",
    },
    {
      _id: "2",
      dia: "MARTES",
      promo: "3 POLLOS AL PRECIO DE 2",
      precio: "$430.00",
      descripcion:
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
