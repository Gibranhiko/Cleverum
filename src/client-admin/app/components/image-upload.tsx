import React from 'react';

const ImageUpload = ({
  label,
  imagePreview,
  register,
  errors,
  uploadErrorMessage,
  handleFileSelection,
  accept = "image/png",
}) => {
  return (
    <div className="mb-4">
      <label>{label}</label>
      {imagePreview && (
        <div className="mb-2">
          <img
            src={imagePreview}
            alt="Vista previa de la imagen"
            className="h-20 w-auto object-contain border rounded"
          />
        </div>
      )}
      <input
        type="file"
        accept={accept}
        {...register("imageUrl")}
        onChange={handleFileSelection}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {errors?.imageUrl && (
        <span className="text-red-500">{String(errors.imageUrl.message)}</span>
      )}
      {uploadErrorMessage && (
        <span className="text-red-500">{uploadErrorMessage}</span>
      )}
    </div>
  );
};

export default ImageUpload;