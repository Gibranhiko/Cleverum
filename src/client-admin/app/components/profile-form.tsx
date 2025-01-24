import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

interface ProfileFormProps {
  profileData: {
    adminName: string;
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    whatsappPhone: string;
    facebookLink: string;
    instagramLink: string;
    logoUrl: string;
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profileData.logoUrl) {
      setLogoPreview(profileData.logoUrl);
    }
  }, [profileData.logoUrl]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: any) => {
    if (selectedFile) {
      if (selectedFile.type !== "image/png") {
        setErrorMessage("Only PNG files are allowed.");
        return;
      }
      if (selectedFile.size > 500 * 1024) {
        setErrorMessage("File size must not exceed 500KB.");
        return;
      }
      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Error uploading file");
        const { fileUrl } = await res.json();

        data.logoUrl = fileUrl; // Add uploaded file URL to data
      } catch (error) {
        console.error("Error uploading file:", error);
        return;
      }
    } else {
      // If no file is selected, set logoUrl to null
      data.logoUrl = null;
    }

    // Save profile data via PUT request
    try {
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
      // Display error message
      console.error("Error saving profile:", error.message);
      setErrorMessage(error.message);
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
        <label>Logo de la Empresa</label>
        {logoPreview && (
          <div className="mb-2">
            <img
              src={logoPreview}
              alt="Vista previa del logo"
              className="h-20 w-auto object-contain border rounded"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/png"
          {...register("logoUrl")}
          onChange={handleFileSelection}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {errors.logoUrl && (
          <span className="text-red-500">{String(errors.logoUrl.message)}</span>
        )}
        {errorMessage && (
          <span className="text-red-500">
            Selecciona otra imagen
          </span>
        )}
      </div>
      <div className="mt-4">
        <button
          type="submit"
          className="bg-green-500 text-white py-2 px-4 rounded mr-2"
        >
          Guardar
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
