"use client";

import React from "react";

export default function DataTable({ columns, rows }) {
  return (
    <table className="min-w-full bg-white border border-gray-200">
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} className="py-2 px-4 border-b">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: string [], rowIndex: number) => (
          <tr key={rowIndex} className="text-center">
            {columns.map((column, colIndex) =>
              column === "status" ? (
                <td key={colIndex} className="py-2 px-4 border-b">
                  {row[column] ? "Entregado" : "Pendiente"}
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
