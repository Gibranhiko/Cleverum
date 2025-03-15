"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/navbar";
import Image from "next/image";

export default function ChatBotPage() {
  const [qrCodeSrc, setQrCodeSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchQRCode = async () => {
    setLoading(true);
    setDisabled(true);
    setProgress(0);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (disabled) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 3.33;
        });
      }, 1000);

      setTimeout(() => {
        setDisabled(false);
        clearInterval(interval);
        setProgress(100);
      }, 30000);
    }

    return () => clearInterval(interval);
  }, [disabled]);

  const handleButtonClick = async () => {
    fetchQRCode();

    try {
      const response = await fetch(`/api/chatbot?timestamp=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch QR code: ${response.statusText}`);
      }
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setQrCodeSrc(imageUrl);
    } catch (error) {
      console.error("Error fetching QR code:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
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
          onClick={handleButtonClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 relative overflow-hidden"
          disabled={loading || disabled}
        >
          {loading ? "Actualizando..." : "Refrescar QR"}
          {disabled && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-blue-300 transition-all"
              style={{ width: `${progress}%` }}
            />
          )}
        </button>
        <div className="flex items-center mt-4">
          <p className="text-center">
            Haz click en el botón y abre <strong>WhatsApp</strong> en tu celular, conecta tu cuenta escaneando el código QR.
          </p>
        </div>
      </div>
    </>
  );
}
