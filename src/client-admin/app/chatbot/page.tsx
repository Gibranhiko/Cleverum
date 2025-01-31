"use client";

import React, { useEffect, useState } from "react";
import Navbar from "../components/navbar";
import Image from "next/image";
import { useAppContext } from "../context/AppContext";
import InlineLoader from "../components/inline-loader";

export default function ChatBotPage() {
  const [qrCodeSrc, setQrCodeSrc] = useState("");
  const [botActive, setBotActive] = useState(false);
  const [userId, setUserId] = useState("user123"); // Example user ID, replace with dynamic user identifier
  const { loaders, setLoader, setState } = useAppContext();

  const fetchQRCode = async () => {
    setLoader("qr", true);
    try {
      const response = await fetch(`http://localhost:3000/get-qr/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch QR code: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.qr) {
        const imageUrl = `data:image/png;base64,${data.qr.split(",")[1]}`; // Assuming the QR data is a base64 string
        setQrCodeSrc(imageUrl);
        return true;  // Indicating that QR code is available
      } else {
        console.log("QR code not available yet.");
        return false;  // QR code not yet available
      }
    } catch (error) {
      console.error("Error fetching QR code:", error);
      return false;
    } finally {
      setLoader("qr", false);
    }
  };

  const startBot = async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/start-bot/${userId}`,
        { method: "POST" }
      );
      console.log(response);
      if (response.ok) {
        setBotActive(true);
  
        let attempts = 0;  // Attempt counter
        const maxAttempts = 3;  // Max retry attempts
  
        // Poll for QR code availability every 2 seconds
        const intervalId = setInterval(async () => {
          const isQRCodeFetched = await fetchQRCode();
          if (isQRCodeFetched) {
            clearInterval(intervalId);  // Stop polling if QR code is fetched
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(intervalId);  // Stop polling after max attempts
              console.error("Failed to retrieve QR code after multiple attempts.");
            }
          }
        }, 2000);
      } else {
        console.error("Error starting chatbot:", response.statusText);
      }
    } catch (error) {
      console.error("Error starting chatbot:", error);
    }
  };

  const stopBot = async () => {
    try {
      const response = await fetch(`/delete-bot/${userId}`, {
        method: "DELETE",
      });
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
        {!botActive && (
          <button
            onClick={startBot}
            className="bg-green-500 text-white px-4 py-2 rounded mb-4"
          >
            {loaders.qr ? (
            <>
              <InlineLoader margin="mr-2" />
              Procesando...
            </>
          ) : (
            "Conectar Chatbot"
          )}
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
            Para sincronizar presiona el botón y escanea el código QR con tu <strong>WhatsApp</strong> y conecta tu cuenta.
          </p>
        </div>
      </div>
    </>
  );
}
