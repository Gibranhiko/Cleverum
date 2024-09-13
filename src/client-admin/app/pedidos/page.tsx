import React, { useState } from 'react';
import DataTable from '../components/data-table';
import Modal from '../components/modal';
import Navbar from '../components/navbar';
import Order from '../interfaces/Order';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Failed to fetch orders');
    }

    const fetchedOrders: Order[] = await res.json();
    setOrders(fetchedOrders);
  };

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

        // Update the status locally
        setOrders(orders.map(order =>
          order._id === selectedOrderId ? { ...order, status: true } : order
        ));

        setIsModalOpen(false); // Close the modal
      } catch (error) {
        console.error("Error updating status:", error);
      }
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  React.useEffect(() => {
    fetchOrders();
  }, []);

  if (!orders.length) {
    return <p>Loading...</p>;
  }

  const columns = Object.keys(orders[0]).slice(1, -1);

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <DataTable columns={columns} rows={orders} onStatusClick={handleStatusClick} />
        <Modal
          isOpen={isModalOpen}
          onClose={handleCancel}
          onAccept={handleAccept}
          message={modalMessage}
        />
      </div>
    </>
  );
}
