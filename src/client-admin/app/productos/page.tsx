import React from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";
import Product from "../interfaces/Product";

export default function ProductsTable() {
  const columns = ["categoria", "producto", "precio", "incluye"];
  const rows: Product[] = [
    {
      _id: "1",
      categoria: "POLLOS",
      producto: "1 POLLO",
      precio: "$250.00",
      incluye: "Incluye tortillas, totopos, limón, salsas y arroz.",
    },
    {
      _id: "2",
      categoria: "POLLOS",
      producto: "2 POLLOS",
      precio: "$430.00",
      incluye: "Incluye tortillas, totopos, limón, salsas y arroz.",
    },
    {
      _id: "3",
      categoria: "COSTILLAS",
      producto: "1/2 KG COSTILLAS DE PUERCO",
      precio: "$260.00",
      incluye: "Incluye tortillas, limón, salsas, chile toreado y 1 salchicha.",
    },
    {
      _id: "4",
      categoria: "COSTILLAS",
      producto: "1 KG COSTILLAS DE PUERCO",
      precio: "$420.00",
      incluye:
        "Incluye tortillas, dos salchichas, cebolla asada, salsas, limones y chile toreado.",
    },
    {
      _id: "5",
      categoria: "CARNE ASADA",
      producto: "1/2 KG TOP SIRLOIN",
      precio: "$260.00",
      incluye:
        "Incluye una salchicha, cebolla asada, pico de gallo, chile toreado y tortillas.",
    },
    {
      _id: "6",
      categoria: "CARNE ASADA",
      producto: "1 KG TOP SIRLOIN",
      precio: "$430.00",
      incluye:
        "Incluye tortillas, dos salchichas, cebolla asada, salsas, limones y chile toreado.",
    },
    {
      _id: "7",
      categoria: "PAQUETE 1",
      producto: "1 POLLO, 1 KG DE TOP SIRLOIN Y MEDIO LITRO DE FRIJOLES CHARROS.",
      precio: "$660.00",
      incluye:
        "Incluye una salchicha, cebolla asada, pico de gallo, chile toreado y tortillas.",
    },
    {
      _id: "8",
      categoria: "PAQUETE 2",
      producto: "1 KG DE COSTILLA DE PUERCO, 1KG DE TOP SIRLOIN Y 1 POLLO.",
      precio: "$800.00",
      incluye:
        "Incluye tres salchichas, cebolla asada, salsa, limones, chile toreado y tortillas.",
    },
    {
      _id: "9",
      categoria: "BOTANERO",
      producto: "1/2 KG ALITAS PICOSAS",
      precio: "$240.00",
      incluye: "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      _id: "10",
      categoria: "BOTANERO",
      producto: "1 KG ALITAS PICOSAS",
      precio: "$330.00",
      incluye: "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      _id: "11",
      categoria: "BOTANERO",
      producto: "250 GR BONELESS Y PAPAS A LA FRANCESA",
      precio: "$220.00",
      incluye: "Con el sabor de la casa, Incluye apio, zanahoria y aderezo a elegir.",
    },
    {
      _id: "12",
      categoria: "INFANTIL",
      producto: "10 PZ NUGGETS DE PECHUGA",
      precio: "$150.00",
      incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      _id: "13",
      categoria: "INFANTIL",
      producto: "20 PZ NUGGETS DE PECHUGA",
      precio: "$300.00",
      incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      _id: "14",
      categoria: "INFANTIL",
      producto: "250 GR TENDERS",
      precio: "$200.00",
      incluye:
        "Acompañados de papas a la francesa, ketchup y de nuestra respectiva coronita para los principes y princesas del hogar.",
    },
    {
      _id: "15",
      categoria: "BEBIDAS",
      producto: "500 ML COCA COLA",
      precio: "$40.00",
      incluye: "Deliciosa bebida carbonatada en lata.",
    },
    {
      _id: "16",
      categoria: "BEBIDAS",
      producto: "500 ML COCA COLA LIGHT",
      precio: "$40.00",
      incluye: "Deliciosa bebida carbonatada en lata baja en azúcar.",
    },
    {
      _id: "17",
      categoria: "BEBIDAS",
      producto: "1 VASO DE AGUA DE SABOR",
      precio: "$40.00",
      incluye: "Jamaica, Tamarindo y Horchata.",
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
