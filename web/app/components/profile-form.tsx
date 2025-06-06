import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAppContext } from "../context/AppContext";
import InlineLoader from "./inline-loader";
import ImageUpload from "./image-upload";
import { useFileUpload } from "../hooks/useFileUpload";

interface ProfileFormProps {
  profileData: {
    adminName: string;
    companyName: string;
    companyType: string;
    companyAddress: string;
    companyEmail: string;
    whatsappPhone: string;
    facebookLink: string;
    instagramLink: string;
    imageUrl: string;
    useAi: boolean;
  };
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function ProfileForm({
  profileData,
  onSave,
  onClose,
}: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: profileData,
  });

  const { loaders, setLoader } = useAppContext();

  const {
    selectedFile,
    imagePreview,
    uploadErrorMessage,
    handleFileSelection,
    setImagePreview,
    validateImage,
  } = useFileUpload(profileData.imageUrl, true);

  useEffect(() => {
    if (profileData.imageUrl) {
      setImagePreview(profileData.imageUrl);
    }
  }, [profileData.imageUrl, setImagePreview]);

  const onSubmit = async (data: any) => {
    if (!validateImage()) {
      return;
    }
    setLoader("upload", true);

    try {
      // Si hay un archivo seleccionado, subirlo y asignar la URL
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("isProfileForm", "true");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Error uploading file");

        const { fileUrl } = await res.json();
        data.imageUrl = fileUrl; // Agregar URL del archivo subido
      } else {
        // Si no hay archivo nuevo, mantener el logo existente
        data.imageUrl = data.imageUrl ?? null;
      }

      // Guardar los datos del perfil
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "An error occurred");
      }

      const updatedProfile = await res.json();
      onSave(updatedProfile);
    } catch (error: any) {
      console.error("Error:", error.message);
    } finally {
      setLoader("upload", false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1 className="text-xl font-semibold mb-2">Editar Perfil</h1>
      <div className="mb-4">
        <label>Administrador</label>
        <input
          {...register("adminName", { required: "Este campo es obligatorio" })}
          className="border p-2 rounded w-full"
        />
        {errors.adminName && (
          <span className="text-red-500">
            {String(errors.adminName.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Nombre de la Empresa</label>
        <input
          {...register("companyName", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.companyName && (
          <span className="text-red-500">
            {String(errors.companyName.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Giro de la Empresa</label>
        <input
          {...register("companyType", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.companyType && (
          <span className="text-red-500">
            {String(errors.companyType.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Dirección de la Empresa</label>
        <input
          {...register("companyAddress", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.companyAddress && (
          <span className="text-red-500">
            {String(errors.companyAddress.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Correo Electrónico</label>
        <input
          {...register("companyEmail", {
            required: "Este campo es obligatorio",
            pattern: {
              value: /^\S+@\S+$/,
              message: "Formato de email inválido",
            },
          })}
          type="email"
          className="border p-2 rounded w-full"
        />
        {errors.companyEmail && (
          <span className="text-red-500">
            {String(errors.companyEmail.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>WhatsApp</label>
        <input
          {...register("whatsappPhone", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.whatsappPhone && (
          <span className="text-red-500">
            {String(errors.whatsappPhone.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Facebook</label>
        <input
          {...register("facebookLink", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.facebookLink && (
          <span className="text-red-500">
            {String(errors.facebookLink.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <label>Instagram</label>
        <input
          {...register("instagramLink", {
            required: "Este campo es obligatorio",
          })}
          className="border p-2 rounded w-full"
        />
        {errors.instagramLink && (
          <span className="text-red-500">
            {String(errors.instagramLink.message)}
          </span>
        )}
      </div>
      <div className="mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            {...register("useAi")}
            id="useAiMenu"
            className="mr-2"
          />
          <label htmlFor="useAiMenu">Usar flujo con IA</label>
        </div>
      </div>
      <div className="mb-4">
        <ImageUpload
          label="Logo de la Empresa"
          imagePreview={imagePreview}
          register={register}
          errors={errors}
          uploadErrorMessage={uploadErrorMessage}
          handleFileSelection={handleFileSelection}
        />
      </div>
      <div className="mt-4">
        <button
          type="submit"
          className="bg-green-500 text-white py-2 px-4 rounded mr-2"
          disabled={loaders.upload}
        >
          {loaders.upload ? (
            <>
              <InlineLoader margin="mr-2" />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-500 text-white py-2 px-4 rounded"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
