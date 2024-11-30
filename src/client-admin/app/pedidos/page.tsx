"use client";

import React, { useState } from "react";
import DataTable from "../components/data-table";
import Navbar from "../components/navbar";
import Modal from "../components/modal";
import { useAppContext } from "../context/AppContext";

export default function OrdersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { state, setState } = useAppContext();

  const currentOrders = state.orders.filter((order) => order.status === false);
  const deliveryOrders = currentOrders.filter(
    (order) => order.tipoEntrega === "domicilio"
  );
  const pickupOrders = currentOrders.filter(
    (order) => order.tipoEntrega === "recoger"
  );

  const deliveryColumns = [
    "nombre",
    "orden",
    "telefono",
    "fecha",
    "direccion",
    "ubicacion",
    "metodoPago",
    "pagoCliente",
    "total",
    "status",
  ];
  const pickupColumns = [
    "nombre",
    "orden",
    "telefono",
    "fecha",
    "total",
    "status",
  ];

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

        setState((prevState) => ({
          ...prevState,
          orders: prevState.orders.map((order) =>
            order._id === selectedOrderId ? { ...order, status: true } : order
          ),
        }));

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

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Envios a Domicilio</h2>
          <DataTable
            columns={deliveryColumns}
            rows={deliveryOrders}
            onStatusClick={handleStatusClick}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Recoger en Tienda</h2>
          <DataTable
            columns={pickupColumns}
            rows={pickupOrders}
            onStatusClick={handleStatusClick}
          />
        </div>
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
