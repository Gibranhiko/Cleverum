import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { IProduct } from "../api/products/models/Product";

interface AddProductFormProps {
  addProduct: (product: IProduct) => void;
  editingProduct?: IProduct;
  onClose: () => void;
  onSave: (product: IProduct) => void;
}

export default function AddProductForm({
  addProduct,
  editingProduct,
  onClose,
  onSave,
}: AddProductFormProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
    getValues,
  } = useForm<IProduct>({
    defaultValues: {
      name: editingProduct?.name || "",
      category: editingProduct?.category || "",
      description: editingProduct?.description || "",
      type: editingProduct?.type || "",
      options: editingProduct?.options || [{ min: 0, max: 0, price: 0 }],
      includes: editingProduct?.includes || "",
    },
  });

  const { fields, append, remove } = useFieldArray<IProduct>({
    control,
    name: "options",
  });

  const onSubmit = (data: IProduct) => {
    const transformedData = {
      ...data,
      options: data.options.map((option) => ({
        min: Number(option.min),
        max: option.max ? Number(option.max) : undefined,
        price: Number(option.price),
      })),
    };

    if (editingProduct) {
      onSave(transformedData);
    } else {
      addProduct(transformedData);
    }

    onClose();
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1 className="text-xl font-semibold mb-2">
        {editingProduct ? "Editar Producto" : "Agregar Producto"}
      </h1>
      <div>
        <label>Nombre del Producto</label>
        <input
          {...register("name", { required: "El nombre es obligatorio" })}
          className="border p-2 rounded w-full"
        />
        {errors.name?.message && (
          <span className="text-red-500">{String(errors.name.message)}</span>
        )}
      </div>
      <div>
        <label>Categoría</label>
        <input
          {...register("category", { required: "La categoría es obligatoria" })}
          className="border p-2 rounded w-full"
        />
        {errors.category && (
          <span className="text-red-500">
            {String(errors.category.message)}
          </span>
        )}
      </div>
      <div>
        <label>Descripción</label>
        <textarea
          {...register("description", {
            required: "La descripción es obligatoria",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.description && (
          <span className="text-red-500">
            {String(errors.description.message)}
          </span>
        )}
      </div>
      <div>
        <label>Tipo</label>
        <select
          {...register("type", { required: "El tipo es obligatorio" })}
          className="border p-2 rounded w-full"
        >
          <option value="">Seleccionar tipo</option>
          <option value="unidad">Unidad</option>
          <option value="kg">Kilogramos</option>
        </select>
        {errors.type && (
          <span className="text-red-500">{String(errors.type.message)}</span>
        )}
      </div>

      <div className="mt-6">
        <label>Opciones de Precio</label>
        {fields.map((field, index) => (
          <div key={field.id} className="mb-4">
            <div>
              <label>Desde</label>
              <Controller
                control={control}
                name={`options.${index}.min` as const}
                rules={{
                  required: "El valor mínimo es obligatorio",
                  min: {
                    value: 0,
                    message: "El valor mínimo debe ser mayor o igual a 0",
                  },
                }}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      {...field}
                      type="number"
                      className="border p-2 rounded w-full"
                    />
                    {fieldState.error && (
                      <span className="text-red-500">
                        {String(fieldState.error.message)}
                      </span>
                    )}
                  </>
                )}
              />
            </div>
            <div>
              <label>Hasta</label>
              <Controller
                control={control}
                name={`options.${index}.max` as const}
                rules={{
                  min: {
                    value: 0,
                    message: "El valor máximo debe ser mayor o igual a 0",
                  },
                  validate: (value) => {
                    const allValues = getValues();
                    const min = Number(allValues.options[index]?.min);
                    if (value && min > value) {
                      console.log("error");
                      return `El valor máximo (${value}) debe ser mayor o igual al valor mínimo (${min}) o no contener nada.`;
                    }
                    return true;
                  },
                }}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      {...field}
                      type="number"
                      className="border p-2 rounded w-full"
                    />
                    {fieldState.error && (
                      <span className="text-red-500">
                        {String(fieldState.error.message)}
                      </span>
                    )}
                  </>
                )}
              />
            </div>

            <div>
              <label>Precio</label>
              <Controller
                control={control}
                name={`options.${index}.price` as const}
                rules={{
                  required: "El precio es obligatorio",
                  min: {
                    value: 0,
                    message: "El precio debe ser mayor o igual a 0",
                  },
                }}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      {...field}
                      type="number"
                      className="border p-2 rounded w-full"
                    />
                    {fieldState.error && (
                      <span className="text-red-500">
                        {String(fieldState.error.message)}
                      </span>
                    )}
                  </>
                )}
              />
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className="bg-red-500 text-white py-2 px-4 rounded mt-2"
            >
              Eliminar
            </button>
            <hr className="h-px my-6 bg-gray-200 border-0 dark:bg-gray-700"></hr>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => append({ min: 1, price: 0 })}
          className="bg-green-500 text-white py-2 px-4 rounded"
        >
          Añadir Opción
        </button>
      </div>
      <div className="mt-6">
        <label>Incluye</label>
        <textarea
          {...register("includes", {
            required: "El campo 'Incluye' es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.includes && (
          <span className="text-red-500">
            {String(errors.includes.message)}
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="bg-blue-500 text-white py-2 px-4 rounded"
        >
          {editingProduct ? "Actualizar Producto" : "Agregar Producto"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-500 text-white py-2 px-4 rounded ml-2"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
