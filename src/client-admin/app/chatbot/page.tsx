"use client";

import React, { useEffect, useState } from "react";
import Navbar from "../components/navbar";
import Image from "next/image";

export default function ChatBotPage() {
  const [qrCodeSrc, setQrCodeSrc] = useState("");
  const [botActive, setBotActive] = useState(false);
  const [userId, setUserId] = useState("user123"); // Example user ID, replace with dynamic user identifier

  const fetchQRCode = async () => {
    try {
      const response = await fetch(`/getqr/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch QR code: ${response.statusText}`);
      }
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setQrCodeSrc(imageUrl);
    } catch (error) {
      console.error("Error fetching QR code:", error);
    }
  };

  const startBot = async () => {
    try {
      const response = await fetch(`/api/chatbotApi/start-bot/${userId}`, { method: "POST" });
      if (response.ok) {
        setBotActive(true);
        fetchQRCode();
      } else {
        console.error("Error starting chatbot:", response.statusText);
      }
    } catch (error) {
      console.error("Error starting chatbot:", error);
    }
  };

  const stopBot = async () => {
    try {
      const response = await fetch(`/delete-bot/${userId}`, { method: "DELETE" });
      if (response.ok) {
        setBotActive(false);
        setQrCodeSrc("");
      }
    } catch (error) {
      console.error("Error stopping chatbot:", error);
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Escanea el código QR para iniciar el Bot
        </h1>
        {!botActive && (
          <button
            onClick={startBot}
            className="bg-green-500 text-white px-4 py-2 rounded mb-4"
          >
            Sincronizar Chatbot
          </button>
        )}
        {botActive && (
          <>
            {qrCodeSrc && (
              <Image
                src={qrCodeSrc}
                alt="Código QR"
                width={300}
                height={300}
                className="mb-4"
              />
            )}
            <button
              onClick={stopBot}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Desconectar Chatbot
            </button>
          </>
        )}
        <div className="flex items-center mb-4">
          <p className="text-center">
            Abre <strong>WhatsApp</strong> y conecta tu cuenta escaneando el
            código QR.
          </p>
        </div>
      </div>
    </>
  );
}
