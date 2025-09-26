import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAppContext } from "../context/AppContext";
import InlineLoader from "./inline-loader";
import ImageUpload from "./image-upload";
import { useFileUpload } from "../hooks/useFileUpload";

interface Client {
  _id: string;
  name: string;
  description?: string;
  whatsappPhone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  // Profile fields
  adminName?: string;
  companyName?: string;
  companyType?: string;
  companyAddress?: string;
  companyEmail?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
}

interface ClientFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  clientData: Client | null;
  onSave: (data: any) => Promise<Client>;
  onClose: () => void;
  onSuccess?: () => void; // Called when all operations complete successfully
}

export default function ClientFormModal({
  isOpen,
  isEditing,
  clientData,
  onSave,
  onClose,
  onSuccess
}: ClientFormModalProps) {
  const { loaders, setLoader } = useAppContext();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      whatsappPhone: '',
      email: '',
      adminName: '',
      companyName: '',
      companyType: '',
      companyAddress: '',
      companyEmail: '',
      facebookLink: '',
      instagramLink: '',
      imageUrl: '',
      useAi: false
    }
  });

  const {
    selectedFile,
    imagePreview,
    uploadErrorMessage,
    handleFileSelection,
    setImagePreview,
    validateImage,
  } = useFileUpload('', true);

  // Reset form when clientData changes (for editing existing clients)
  useEffect(() => {
    if (clientData && isEditing) {
      reset({
        name: clientData.name || '',
        description: clientData.description || '',
        whatsappPhone: clientData.whatsappPhone || '',
        email: clientData.email || '',
        adminName: clientData.adminName || '',
        companyName: clientData.companyName || '',
        companyType: clientData.companyType || '',
        companyAddress: clientData.companyAddress || '',
        companyEmail: clientData.companyEmail || '',
        facebookLink: clientData.facebookLink || '',
        instagramLink: clientData.instagramLink || '',
        imageUrl: clientData.imageUrl || '',
        useAi: clientData.useAi || false
      });
    } else if (!isEditing) {
      // Reset to empty form for creating new clients
      reset({
        name: '',
        description: '',
        whatsappPhone: '',
        email: '',
        adminName: '',
        companyName: '',
        companyType: '',
        companyAddress: '',
        companyEmail: '',
        facebookLink: '',
        instagramLink: '',
        imageUrl: '',
        useAi: false
      });
    }
  }, [clientData, isEditing, reset]);

  useEffect(() => {
    if (clientData?.imageUrl) {
      setImagePreview(clientData.imageUrl);
    } else if (!isEditing) {
      // Clear image preview for new clients
      setImagePreview('');
    }
  }, [clientData?.imageUrl, isEditing, setImagePreview]);

  const onSubmit = async (data: any) => {
    if (!validateImage()) {
      return;
    }
    setLoader("upload", true);

    try {
      // For new clients, create client first without image to get clientId
      let savedClient: Client;
      if (!isEditing) {
        const clientDataWithoutImage = { ...data };
        delete clientDataWithoutImage.imageUrl; // Remove imageUrl for initial creation
        savedClient = await onSave(clientDataWithoutImage);
      }

      // Handle image upload if a new file is selected
      if (selectedFile) {
        // Validate file before upload
        if (!selectedFile.type.startsWith('image/')) {
          throw new Error('Solo se permiten archivos de imagen');
        }

        if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
          throw new Error('El archivo es demasiado grande (máximo 5MB)');
        }

        // Set loading state for this client's image
        const currentClientId = isEditing ? clientData?._id : savedClient._id;
        if (currentClientId) {
          setLoader(`client-image-${currentClientId}`, true);
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("isClientForm", "true");

        // Use the correct clientId
        formData.append("clientId", currentClientId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Upload failed:", {
            status: res.status,
            statusText: res.statusText,
            error: errorText
          });
          throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
        }

        const responseData = await res.json();
        const { fileUrl } = responseData;
        data.imageUrl = fileUrl;

        // Clear loading state
        if (currentClientId) {
          setLoader(`client-image-${currentClientId}`, false);
        }
      } else {
        // Keep existing image or set to null
        data.imageUrl = data.imageUrl ?? null;
      }

      // For editing or updating new client with imageUrl
      if (isEditing) {
        await onSave(data);
      } else {
        // Update the newly created client with imageUrl
        const updateResponse = await fetch('/api/clients', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: savedClient._id,
            ...data
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.message || 'Error updating client with image');
        }
      }

      // Close modal
      onClose();

      // Notify parent of successful completion
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error:", error.message);
    } finally {
      setLoader("upload", false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
          </h2>
        </div>

        {/* Scrollable Form Content */}
        <div className="px-6 py-4 max-h-[calc(90vh-140px)] overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Client Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Cliente *
                  </label>
                  <input
                    {...register("name", { required: "Este campo es obligatorio" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.name && (
                    <span className="text-red-500 text-sm mt-1 block">
                      {String(errors.name.message)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email del Cliente
                  </label>
                  <input
                    {...register("email", {
                      pattern: {
                        value: /^\S+@\S+$/,
                        message: "Formato de email inválido",
                      },
                    })}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.email && (
                    <span className="text-red-500 text-sm mt-1 block">
                      {String(errors.email.message)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  {...register("description")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono WhatsApp
                </label>
                <input
                  {...register("whatsappPhone")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Company Profile Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información de la Empresa</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Administrador
                  </label>
                  <input
                    {...register("adminName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de la Empresa
                </label>
                <input
                  {...register("companyAddress")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facebook
                  </label>
                  <input
                    {...register("facebookLink")}
                    type="url"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram
                  </label>
                  <input
                    {...register("instagramLink")}
                    type="url"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center">
                  <input
                    {...register("useAi")}
                    type="checkbox"
                    id="useAiClient"
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useAiClient" className="text-sm font-medium text-gray-700">
                    Usar flujo con IA
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <ImageUpload
                  label="Logo de la Empresa"
                  imagePreview={imagePreview}
                  register={register}
                  errors={errors}
                  uploadErrorMessage={uploadErrorMessage}
                  handleFileSelection={handleFileSelection}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={loaders.upload}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loaders.upload ? (
                <>
                  <InlineLoader margin="mr-2" />
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                isEditing ? 'Actualizar Cliente' : 'Crear Cliente'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}