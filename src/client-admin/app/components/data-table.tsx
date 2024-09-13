import React from "react";
import Order from "../interfaces/Order";

interface DataTableProps {
  columns: string[];
  rows: Order[];
  onStatusClick: (orderId: string) => void;
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
    <table className="min-w-full bg-white border border-gray-200">
      <thead>
        <tr>
          {columns.map((column: string, index: number) => (
            <th key={index} className="py-2 px-4 border-b">
              {column.toUpperCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: Order) => (
          <tr key={row._id} className="text-center">
            {columns.map((column: string, colIndex: number) =>
              column === "status" ? (
                <td key={colIndex} className="py-2 px-4 border-b">
                  {row[column] ? "Entregado" : getPendingBtnLayout(row._id)}
                </td>
              ) : (
                <td key={colIndex} className="py-2 px-4 border-b">
                  {row[column]}
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
