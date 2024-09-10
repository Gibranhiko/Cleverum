"use client";

import React, { useState } from "react";
import Modal from "../components/modal"; // Adjust the path as necessary

interface DataTableProps {
  columns: string[];
  initialRows: any[];
}

export default function DataTable({ columns = [], initialRows = [] }: DataTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const getPendingBtnLayout = (orderId: string) => (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        handleStatusClick(orderId);
      }}
      className="text-blue-500 hover:underline"
    >
      Pendiente
    </a>
  );

  const handleStatusClick = (orderId: string) => {
    setModalMessage("¿Confirma que la orden ha sido entregada?");
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  const handleAccept = async () => {
    if (selectedOrderId) {
      try {
        const response = await fetch('/api/orders', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: selectedOrderId }),
        });

        if (!response.ok) {
          throw new Error('Failed to update status');
        }

        // Update the status in the local rows state
        setRows(rows.map(row =>
          row._id === selectedOrderId ? { ...row, status: true } : row
        ));

        setIsModalOpen(false); // Close the modal
      } catch (error) {
        console.error("Error updating status:", error);
      }
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false); // Close the modal
  };

  if (!columns.length || !rows.length) {
    return <p>No data available.</p>; // Handle empty or undefined data gracefully
  }

  return (
    <>
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        onAccept={handleAccept}
        message={modalMessage}
      />
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
          {rows.map((row: any) => (
            <tr key={row._id} className="text-center">
              {columns.map((column: string, colIndex: number) =>
                column === "status" ? (
                  <td key={colIndex} className="py-2 px-4 border-b">
                    {row[column]
                      ? "Entregado"
                      : getPendingBtnLayout(row._id)}
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
    </>
  );
}
