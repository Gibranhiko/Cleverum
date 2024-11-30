"use client";

import React from "react";
import Order from "../interfaces/Order";
import Product from "../interfaces/Product";
import Promo from "../interfaces/Promo";

interface DataTableProps {
  columns: string[];
  rows: Order[] | Product[] | Promo[];
  onStatusClick?: (orderId: string) => void;
}

export default function DataTable({
  columns = [],
  rows = [],
  onStatusClick,
}: DataTableProps) {
  const getPendingBtnLayout = (orderId: string) => (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onStatusClick(orderId);
      }}
      className="text-blue-500 hover:underline"
    >
      Pendiente
    </a>
  );

  if (!columns.length || !rows.length) {
    return <p>No data available.</p>;
  }

  return (
    <table
      className="min-w-full bg-white border border-gray-200 table-fixed"
      style={{ tableLayout: "fixed", width: "100%" }}
    >
      <thead>
        <tr>
          {columns.map((column: string, index: number) => (
            <th
              key={index}
              className="py-2 px-4 border border-gray-300 bg-gray-100 text-center"
            >
              {column.toUpperCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: Order | Product | Promo) => (
          <tr key={row._id} className="text-center">
            {columns.map((column: string, colIndex: number) => {
              if (column === "status") {
                return (
                  <td
                    key={colIndex}
                    className="py-2 px-4 border border-gray-300"
                  >
                    {row[column] ? "Entregado" : getPendingBtnLayout(row._id)}
                  </td>
                );
              } else if (column === "orden") {
                return (
                  <td
                    key={colIndex}
                    className="py-2 px-4 border border-gray-300 text-left"
                  >
                    {row[column].map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </td>
                );
              } else if (column === "ubicacion" && row[column]) {
                return (
                  <td
                    key={colIndex}
                    className="py-2 px-4 border border-gray-300"
                  >
                    <a
                      href={row[column]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Ubicación
                    </a>
                  </td>
                );
              } else if (column === "fecha") {
                const formattedDate = new Date(row[column]).toLocaleString(
                  "es-MX",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                    hour12: true,
                  }
                );
                return (
                  <td
                    key={colIndex}
                    className="py-2 px-4 border border-gray-300"
                  >
                    {formattedDate}
                  </td>
                );
              } else {
                return (
                  <td
                    key={colIndex}
                    className="py-2 px-4 border border-gray-300"
                  >
                    {row[column]}
                  </td>
                );
              }
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
