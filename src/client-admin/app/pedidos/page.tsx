import React from "react";
import OrdersPageClient from "./orders-client";
import Order from "../interfaces/Order";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch orders");
  }

  const orders: Order[] = await res.json();
  const columns = Object.keys(orders[0]).slice(1, -1);

  return <OrdersPageClient columns={columns} initialRows={orders} />;
}
