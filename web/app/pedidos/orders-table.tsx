import React from "react";
import DataTable from "../components/data-table";
import { IOrder } from "../api/orders/models/Order";
import ColumnConfig from "../interfaces/Column";
import { formatOrder } from "../utils/format-data";

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
        }  else if (col.field === "plannedDate") {
          row[col.title] = new Date(order.plannedDate).toLocaleString();
        } else if (col.field === "status") {
          row[col.title] = (
            <button
              onClick={() => onStatusClick(order._id)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors w-full sm:w-auto"
            >
              Entregar
            </button>
          );
        } else if (col.field === "order" && Array.isArray(order[col.field])) {
          const formattedOrder = formatOrder(order[col.field]);
          row[col.title] = (
            <div className="max-w-xs md:max-w-none">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {formattedOrder.map((detail, index) => (
                  <li key={index} className="break-words">{detail}</li>
                ))}
              </ul>
            </div>
          );
        } else if (col.field === "location") {
          if (typeof order[col.field] === "string") {
            row[col.title] = (
              <a
                href={order[col.field]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-500 hover:text-blue-700 hover:underline text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Ubicación
              </a>
            );
          } else {
            row[col.title] = <span className="text-gray-500 text-sm">Ubicación no disponible</span>;
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
