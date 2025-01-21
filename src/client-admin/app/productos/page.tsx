"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/navbar";
import AddProductForm from "../components/add-products-form";
import Modal from "../components/modal";
import ProductTable from "./products-table";
import ColumnConfig from "../interfaces/Column";
import { productFields } from "../utils/constants";
import { IProduct } from "../api/products/models/Product";
import { useAppContext } from "../context/AppContext";
import InlineLoader from "../components/inline-loader";

export default function ProductsPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<IProduct | null>(null);
  const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>([]);
  const { loaders, setLoader } = useAppContext();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch products");
        const data: IProduct[] = await res.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    setColumnsConfig(productFields);
  }, []);

  const addProduct = async (newProduct: IProduct) => {
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (!res.ok) throw new Error("Error adding product");
      const savedProduct = await res.json();
      setProducts((prev) => [...prev, savedProduct]);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const editProduct = async (updatedProduct: IProduct) => {
    if (!editingProduct) return;
    try {
      const res = await fetch(`/api/products/${editingProduct._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProduct),
      });
      if (!res.ok) throw new Error("Error updating product");
      const updated = await res.json();
      setProducts((prev) =>
        prev.map((prod) => (prod._id === updated._id ? updated : prod))
      );
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const deleteProduct = async (productId: string) => {
    setLoader("deleteProduct", true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error deleting product");
      setProducts((prev) => prev.filter((prod) => prod._id !== productId));
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting product:", error);
    } finally {
      setLoader("deleteProduct", false);
    }
  };

  const openAddEditModal = (product: IProduct | null = null) => {
    setIsEditing(!!product);
    setEditingProduct(product);
    setAddEditModalOpen(true);
  };

  const openDeleteModal = (product: IProduct) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Productos</h1>
          <button
            onClick={() => openAddEditModal()}
            className="bg-blue-500 text-white py-2 px-4 rounded"
          >
            + Agregar Producto
          </button>
        </div>
        <ProductTable
          products={products}
          openModalForEdit={openAddEditModal}
          openModalForDelete={openDeleteModal}
          columnsConfig={columnsConfig}
        />
      </div>
      <Modal
        isOpen={isAddEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
      >
        <AddProductForm
          addProduct={addProduct}
          editingProduct={isEditing ? editingProduct : null}
          onSave={(product: IProduct) => {
            isEditing ? editProduct(product) : addProduct(product);
            setAddEditModalOpen(false);
          }}
          onClose={() => setAddEditModalOpen(false)}
        />
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      >
        <div>
          <h2 className="text-xl font-bold">Confirmar eliminación</h2>
          <p>
            ¿Estás seguro que deseas eliminar el producto{" "}
            <strong>{productToDelete?.name}</strong>?
          </p>
          <div className="mt-4 flex justify-end space-x-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="bg-gray-500 text-white py-2 px-4 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteProduct(productToDelete!._id)}
              className="bg-red-500 text-white py-2 px-4 rounded"
              disabled={loaders.deleteProduct}
            >
              {loaders.deleteProduct ? (
                <>
                  <InlineLoader margin="mr-2" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
