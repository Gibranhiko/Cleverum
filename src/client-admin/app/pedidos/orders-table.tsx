import React from "react";
import DataTable from "../components/data-table";
import { IOrder } from "../api/orders/models/Order";
import ColumnConfig from "../interfaces/Column";

interface OrdersTableProps {
  orders: IOrder[];
  onStatusClick: (orderId: string) => void;
  columnsConfig: ColumnConfig[];
}

const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  onStatusClick,
  columnsConfig,
}) => {
  const visibleColumns = columnsConfig
    .filter((col) =>
      orders.some(
        (order) => order[col.field] !== null && order[col.field] !== undefined
      )
    )
    .map((col) => col.title);

  const rows = orders.map((order) => {
    const row: Record<string, React.ReactNode> = { _id: order._id };

    columnsConfig.forEach((col) => {
      if (order[col.field] !== null && order[col.field] !== undefined) {
        row[col.title] = order[col.field];
      }
    });
    row["Fecha"] = new Date(order.date).toLocaleString();

    row["Estado"] = (
      <button
        onClick={() => onStatusClick(order._id)}
        className="text-blue-500 hover:underline"
      >
        Entregar
      </button>
    );

    return row;
  });

  return <DataTable columns={visibleColumns} rows={rows} />;
};

export default OrdersTable;
