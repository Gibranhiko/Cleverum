import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAppContext } from "../context/AppContext";
import InlineLoader from "./inline-loader";
import ImageUpload from "./image-upload";
import { useFileUpload } from "../hooks/useFileUpload";

interface Client {
  _id: string;
  whatsappPhone?: string;
  isActive: boolean;
  createdAt: string;
  // Profile fields
  adminName?: string;
  companyName: string;
  companyType?: string;
  companyAddress?: string;
  companyEmail?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
  // Google Calendar integration
  googleCalendarKeyFileUrl?: string;
  googleCalendarId?: string;
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
      whatsappPhone: '',
      adminName: '',
      companyName: '',
      companyType: '',
      companyAddress: '',
      companyEmail: '',
      facebookLink: '',
      instagramLink: '',
      imageUrl: '',
      useAi: false,
      googleCalendarKeyFileUrl: null,
      googleCalendarId: ''
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

  const {
    selectedFile: selectedKeyFile,
    uploadErrorMessage: keyFileUploadErrorMessage,
    handleFileSelection: handleKeyFileSelection,
  } = useFileUpload('', false, ['application/json'], 10);

  // Reset form when clientData changes (for editing existing clients)
  useEffect(() => {
    if (clientData && isEditing) {
      reset({
        whatsappPhone: clientData.whatsappPhone || '',
        adminName: clientData.adminName || '',
        companyName: clientData.companyName || '',
        companyType: clientData.companyType || '',
        companyAddress: clientData.companyAddress || '',
        companyEmail: clientData.companyEmail || '',
        facebookLink: clientData.facebookLink || '',
        instagramLink: clientData.instagramLink || '',
        imageUrl: clientData.imageUrl || '',
        useAi: clientData.useAi || false,
        googleCalendarKeyFileUrl: (clientData as any).googleCalendarKeyFileUrl || null,
        googleCalendarId: (clientData as any).googleCalendarId || ''
      });
    } else if (!isEditing) {
      // Reset to empty form for creating new clients
      reset({
        whatsappPhone: '',
        adminName: '',
        companyName: '',
        companyType: '',
        companyAddress: '',
        companyEmail: '',
        facebookLink: '',
        instagramLink: '',
        imageUrl: '',
        useAi: false,
        googleCalendarKeyFileUrl: null,
        googleCalendarId: ''
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
        data.imageUrl = data.imageUrl || null;
      }

      // Handle Google Calendar key file upload if a new file is selected
      if (selectedKeyFile) {
        // Get the correct clientId
        const keyFileClientId = isEditing ? clientData?._id : savedClient._id;
        if (!keyFileClientId) {
          throw new Error('Client ID not available for key file upload');
        }

        const formData = new FormData();
        formData.append("file", selectedKeyFile);
        formData.append("isGoogleCalendarKey", "true");
        formData.append("clientId", keyFileClientId);

        const keyUploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!keyUploadRes.ok) {
          const errorText = await keyUploadRes.text();
          console.error("Key file upload failed:", {
            status: keyUploadRes.status,
            statusText: keyUploadRes.statusText,
            error: errorText
          });
          throw new Error(`Key file upload failed: ${keyUploadRes.status} ${keyUploadRes.statusText}`);
        }

        const keyResponseData = await keyUploadRes.json();
        const { fileUrl } = keyResponseData;
        data.googleCalendarKeyFileUrl = fileUrl;
      }

      // For editing or updating new client with uploaded file URLs
      if (isEditing) {
        await onSave(data);
      } else {
        // Update the newly created client with uploaded file URLs
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
          throw new Error(errorData.message || 'Error updating client with uploaded files');
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
                    Nombre de la Empresa *
                  </label>
                  <input
                    {...register("companyName", { required: "Este campo es obligatorio" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.companyName && (
                    <span className="text-red-500 text-sm mt-1 block">
                      {String(errors.companyName.message)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email de la Empresa
                  </label>
                  <input
                    {...register("companyEmail", {
                      pattern: {
                        value: /^\S+@\S+$/,
                        message: "Formato de email inválido",
                      },
                    })}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.companyEmail && (
                    <span className="text-red-500 text-sm mt-1 block">
                      {String(errors.companyEmail.message)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Empresa
                </label>
                <input
                  {...register("companyType")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* Google Calendar Integration */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Integración con Google Calendar</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Archivo de Clave de Servicio (JSON)
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleKeyFileSelection}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Sube el archivo JSON de clave de servicio de Google Calendar API
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID del Calendario de Google
                  </label>
                  <input
                    {...register("googleCalendarId")}
                    placeholder="ej: primary o calendar-id@group.calendar.google.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    El ID del calendario donde se crearán los eventos de citas
                  </p>
                </div>
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