import React from "react";

export default function Modal({ isOpen, onClose, onAccept, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-1/3">
        <h2 className="text-lg font-bold mb-4">Notificación</h2>
        <p>{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onAccept}
            className="bg-blue-500 text-white py-2 px-4 rounded mr-2"
          >
            Aceptar
          </button>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white py-2 px-4 rounded"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
