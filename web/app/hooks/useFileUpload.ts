import { useState } from "react";

export const useFileUpload = (
    initialPreviewUrl?: string,
    isImageRequired: boolean = false
  ) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialPreviewUrl || null
  );
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (file.type !== "image/png") {
        setUploadErrorMessage("Only PNG files are allowed.");
        return;
      }
      if (file.size > 500 * 1024) {
        setUploadErrorMessage("File size must not exceed 500KB.");
        return;
      }

      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setUploadErrorMessage(null); // Clear any previous errors
    }
  };

  const validateImage = () => {
    if (isImageRequired && !selectedFile && !imagePreview) {
      setUploadErrorMessage("La imagen es requerida."); // Set the error message
      return false; // Return false to indicate validation failure
    }
    return true; // Return true if validation passes
  };

  return {
    selectedFile,
    imagePreview,
    uploadErrorMessage,
    handleFileSelection,
    setImagePreview,
    validateImage
  };
};