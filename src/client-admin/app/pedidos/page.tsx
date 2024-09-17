"use client";

import React, { useEffect, useState } from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";
import Modal from "../components/modal";
import { useAppContext } from "../context/AppContext";

export default function OrdersPage() {
  const { state } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [localOrders, setLocalOrders] = useState([...state.orders || []]);

  useEffect(() => {
    setLocalOrders([...state.orders || []]);
  }, [state.orders]);

  const currentOrders = localOrders.filter(order => order.status === false);
  const columns = ["nombre", "orden", "telefono", "fecha", "status"];

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

        setLocalOrders(prevOrders =>
          prevOrders.map(order =>
            order._id === selectedOrderId ? { ...order, status: true } : order
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
          rows={currentOrders}
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
