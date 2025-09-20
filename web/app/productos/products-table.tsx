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
      <div className="flex justify-center md:justify-start">
        <img
          src={product.imageUrl}
          alt="Imagen del producto"
          className="h-16 w-16 md:h-20 md:w-auto object-cover rounded"
        />
      </div>
    );

    row["Acciones"] = (
      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
        <button
          onClick={() => openModalForEdit(product)}
          className="flex items-center justify-center space-x-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded text-sm"
        >
          <PencilSquareIcon className="h-4 w-4" />
          <span>Editar</span>
        </button>
        <button
          onClick={() => openModalForDelete(product)}
          className="flex items-center justify-center space-x-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-sm"
        >
          <TrashIcon className="h-4 w-4" />
          <span>Eliminar</span>
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
