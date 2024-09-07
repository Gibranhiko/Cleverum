import React from 'react';
import DataTable from '../components/data-table';
import Navbar from '../components/navbar';
import { IOrder } from '../models/Order';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch orders');
  }

  const orders: IOrder[] = await res.json();

  const columns = ['nombre', 'orden', 'telefono', 'fecha', 'status'];

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
        <DataTable columns={columns} rows={orders} />
      </div>
    </>
  );
}
