"use client";

import React, { useEffect, useState } from "react";
import Navbar from "../components/navbar";
import Image from "next/image";

export default function ChatBotPage() {
  const [qrCodeSrc, setQrCodeSrc] = useState("");

  const fetchQRCode = async () => {
    try {
      const response = await fetch("/api/chatbot");
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
  
  useEffect(() => {
    fetchQRCode();
  }, []);  

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Escanea el código QR para iniciar el Bot
        </h1>
        {qrCodeSrc && (
          <Image
            src={qrCodeSrc}
            alt="Código QR"
            width={300}
            height={300}
            className="mb-4"
          />
        )}
        <div className="flex items-center mb-4">
          <p className="text-center">
            Abre <strong>WhatsApp Web</strong> y conecta tu cuenta escaneando el
            código QR.
          </p>
        </div>
      </div>
    </>
  );
}
