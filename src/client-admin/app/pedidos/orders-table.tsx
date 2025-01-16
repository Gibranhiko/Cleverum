import React from "react";
import DataTable from "../components/data-table";
import { IOrder } from "../api/orders/models/Order";
import ColumnConfig from "../interfaces/Column";
import { formatOrder } from "../../../chatbot/utils/order";

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
        if (col.field === "date") {
          row[col.title] = new Date(order.date).toLocaleString();
        } else if (col.field === "status") {
          row[col.title] = (
            <button
              onClick={() => onStatusClick(order._id)}
              className="text-blue-500 hover:underline"
            >
              Entregar
            </button>
          );
        } else if (col.field === "order" && Array.isArray(order[col.field])) {
          const formattedOrder = formatOrder(order[col.field]);
          row[col.title] = (
            <ul>
              {formattedOrder.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          );
        } else if (col.field === "location") {
          if (typeof order[col.field] === "string") {
            row[col.title] = (
              <a
                href={order[col.field]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {order[col.field]}
              </a>
            );
          } else {
            row[col.title] = "Ubicación no disponible";
          }
        } else {
          row[col.title] = order[col.field];
        }
      } else {
        row[col.title] = "-";
      }
    });

    return row;
  });

  return <DataTable columns={visibleColumns} rows={rows} />;
};

export default OrdersTable;
