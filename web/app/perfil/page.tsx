"use client";

import React, { useState } from "react";
import Navbar from "../components/navbar";
import ProfileForm from "../components/profile-form";
import Modal from "../components/modal";
import { useAppContext } from "../context/AppContext";

export default function ProfilePage() {
  const { state, setState } = useAppContext();
  const { profileData } = state;
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const updateProfile = async (updatedData: typeof profileData) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) throw new Error("Error updating profile");

      const savedData = await res.json();
      setState((prevState) => ({
        ...prevState,
        profileData: savedData,
      }));
      setEditModalOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  if (!profileData) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 mt-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Perfil de la Empresa</h1>
          <button
            onClick={() => setEditModalOpen(true)}
            className="bg-blue-500 text-white py-2 px-4 rounded"
          >
            Editar Perfil
          </button>
        </div>
        <div className="border p-4 rounded">
          <p>
            <strong>Administrador:</strong>{" "}
            {profileData.adminName || "No especificado"}
          </p>
          <p>
            <strong>Nombre de la Empresa:</strong>{" "}
            {profileData.companyName || "No especificado"}
          </p>
          <p>
            <strong>Giro de la Empresa:</strong>{" "}
            {profileData.companyType || "No especificado"}
          </p>
          <p>
            <strong>Dirección:</strong>{" "}
            {profileData.companyAddress || "No especificado"}
          </p>
          <p>
            <strong>Email:</strong>{" "}
            {profileData.companyEmail || "No especificado"}
          </p>
          <p>
            <strong>WhatsApp:</strong>{" "}
            {profileData.whatsappPhone || "No especificado"}
          </p>
          <p>
            <strong>Facebook:</strong>{" "}
            <a
              href={profileData.facebookLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {profileData.facebookLink || "No especificado"}
            </a>
          </p>
          <p>
            <strong>Instagram:</strong>{" "}
            <a
              href={profileData.instagramLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {profileData.instagramLink || "No especificado"}
            </a>
          </p>
          <p>
            <strong>Flujo con IA:</strong>{" "}
            {profileData.useAi ? "Activado" : "Desactivado"}
          </p>
          <h2 className="text-lg font-bold mt-4">Logo</h2>
          {profileData.imageUrl ? (
            <img
              src={profileData.imageUrl}
              alt="Logo de la empresa"
              className="h-16 w-16 object-contain"
            />
          ) : (
            <p>No se ha subido un logo.</p>
          )}
        </div>
      </div>
      <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)}>
        <ProfileForm
          profileData={profileData}
          onSave={updateProfile}
          onClose={() => setEditModalOpen(false)}
        />
      </Modal>
    </>
  );
}
