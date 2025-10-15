import { useState } from "react";

export const useFileUpload = (
    initialPreviewUrl?: string,
    isImageRequired: boolean = false,
    acceptedTypes: string[] = ["image/png"],
    maxSizeKB: number = 500
  ) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialPreviewUrl || null
  );
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        const typeNames = acceptedTypes.map(type => type.split('/')[1].toUpperCase()).join(' or ');
        setUploadErrorMessage(`Only ${typeNames} files are allowed.`);
        return;
      }

      // Validate file size
      if (file.size > maxSizeKB * 1024) {
        setUploadErrorMessage(`File size must not exceed ${maxSizeKB}KB.`);
        return;
      }

      setSelectedFile(file);

      // Create preview for images only
      if (file.type.startsWith('image/')) {
        setImagePreview(URL.createObjectURL(file));
      }

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