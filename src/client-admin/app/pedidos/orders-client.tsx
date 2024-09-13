"use client";

import React, { useState } from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";
import Modal from "../components/modal";
import Order from "../interfaces/Order";

interface OrdersPageClientProps {
  columns: string[];
  initialRows: Order[];
}

export default function OrdersPageClient({
  columns,
  initialRows,
}: OrdersPageClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleStatusClick = (orderId: string) => {
    setModalMessage("¿Confirma que la orden ha sido entregada?");
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  const handleAccept = async () => {
    if (selectedOrderId) {
      try {
        const response = await fetch("/api/orders", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: selectedOrderId }),
        });

        if (!response.ok) {
          throw new Error("Failed to update status");
        }

        setRows(
          rows.map((row) =>
            row._id === selectedOrderId ? { ...row, status: true } : row
          )
        );

        setIsModalOpen(false);
      } catch (error) {
        console.error("Error updating status:", error);
      }
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <DataTable
          columns={columns}
          rows={rows}
          onStatusClick={handleStatusClick}
        />
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        onAccept={handleAccept}
        message={modalMessage}
      />
    </>
  );
}
