import React from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";

export default function ProductsTable() {
  const columns = ["Categoría", "Producto", "Precio", "Incluye"];
  const rows = [
    {
      Categoría: "POLLOS",
      Producto: "1 POLLO",
      Precio: "$250.00",
      Incluye: "Incluye tortillas, totopos, limón, salsas y arroz.",
    },
    {
      Categoría: "POLLOS",
      Producto: "2 POLLOS",
      Precio: "$430.00",
      Incluye: "Incluye tortillas, totopos, limón, salsas y arroz.",
    },
    {
      Categoría: "COSTILLAS",
      Producto: "1/2 KG COSTILLAS DE PUERCO",
      Precio: "$260.00",
      Incluye: "Incluye tortillas, limón, salsas, chile toreado y 1 salchicha.",
    },
    {
      Categoría: "COSTILLAS",
      Producto: "1 KG COSTILLAS DE PUERCO",
      Precio: "$420.00",
      Incluye:
        "Incluye tortillas, dos salchichas, cebolla asada, salsas, limones y chile toreado.",
    },
    {
      Categoría: "CARNE ASADA",
      Producto: "1/2 KG TOP SIRLOIN",
      Precio: "$260.00",
      Incluye:
        "Incluye una salchicha, cebolla asada, pico de gallo, chile toreado y tortillas.",
    },
    {
      Categoría: "CARNE ASADA",
      Producto: "1  KG TOP SIRLOIN",
      Precio: "$430.00",
      Incluye:
        "Incluye tortillas, dos salchichas, cebolla asada, salsas, limones y chile toreado.",
    },
    {
      Categoría: "PAQUETE 1",
      Producto:
        "1 POLLO, 1 KG DE TOP SIRLOIN Y MEDIO LITRO DE FRIJOLES CHARROS.",
      Precio: "$660.00",
      Incluye:
        "Incluye una salchicha, cebolla asada, pico de gallo, chile toreado y tortillas.",
    },
    {
      Categoría: "PAQUETE 2",
      Producto: "1 KG DE COSTILLA DE PUERCO, 1KG DE TOP SIRLOIN Y 1 POLLO.",
      Precio: "$800.00",
      Incluye:
        "Incluye tres salchichas, cebolla asada, salsa, limones, chile toreado y tortillas.",
    },
    {
      Categoría: "BOTANERO",
      Producto: "1/2 KG ALITAS PICOSAS",
      Precio: "$240.00",
      Incluye:
        "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      Categoría: "BOTANERO",
      Producto: "1 KG ALITAS PICOSAS",
      Precio: "$330.00",
      Incluye:
        "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      Categoría: "BOTANERO",
      Producto: "250 GR BONELESS Y PAPAS A LA FRANCESA",
      Precio: "$220.00",
      Incluye:
        "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      Categoría: "INFANTIL",
      Producto: "10 PZ NUGGETS DE PECHUGA",
      Precio: "$150.00",
      Incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      Categoría: "INFANTIL",
      Producto: "20 PZ NUGGETS DE PECHUGA",
      Precio: "$300.00",
      Incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      Categoría: "INFANTIL",
      Producto: "250 GR TENDERS",
      Precio: "$200.00",
      Incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      Categoría: "BEBIDAS",
      Producto: "500 ML COCA COLA",
      Precio: "$40.00",
      Incluye: "Deliciosa bebida carbonatada en lata.",
    },
    {
      Categoría: "BEBIDAS",
      Producto: "500 ML COCA COLA LIGHT",
      Precio: "$40.00",
      Incluye: "Deliciosa bebida carbonatada en lata baja en azúcar.",
    },
    {
      Categoría: "BEBIDAS",
      Producto: "1 VASO DE AGUA DE SABOR",
      Precio: "$40.00",
      Incluye: "Jamaica, Tamarindo y Horchata.",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Productos</h1>
        <DataTable columns={columns} rows={rows} />
      </div>
    </>
  );
}
