import React from "react";
import DataTable from "../components/data-table";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { IProduct } from "../api/products/models/Product";
import { formatPrice } from "../utils/format-data";
import ColumnConfig from "../interfaces/Column";

interface ProductTableProps {
  products: IProduct[];
  openModalForEdit: (product: IProduct) => void;
  openModalForDelete: (product: IProduct) => void;
  columnsConfig: ColumnConfig[];
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  openModalForEdit,
  openModalForDelete,
  columnsConfig,
}) => {
  const rows = products.map((product) => {
    const row: Record<string, React.ReactNode> = { _id: product._id };

    columnsConfig.forEach((col) => {
      if (product[col.field] !== null && product[col.field] !== undefined) {
        row[col.title] = product[col.field];
      }
    });

    row["Precio"] = formatPrice(product.options);
    row["Imagen"] = (
      <img src={product.imageUrl} alt="Imagen del producto" className="h-20 w-auto" />
    );

    row["Acciones"] = (
      <div className="flex space-x-2">
        <button
          onClick={() => openModalForEdit(product)}
          className="text-blue-500 hover:underline"
        >
          <PencilSquareIcon className="h-5 w-5 inline-block" />
          Editar
        </button>
        <button
          onClick={() => openModalForDelete(product)}
          className="text-red-500 hover:underline"
        >
          <TrashIcon className="h-5 w-5 inline-block" />
          Eliminar
        </button>
      </div>
    );

    return row;
  });

  return (
    <DataTable columns={columnsConfig.map((col) => col.title)} rows={rows} />
  );
};

export default ProductTable;
