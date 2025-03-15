import React from "react";
import Module from "./components/module";
import Navbar from "./components/navbar";

const HomePage = () => {
  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-4">Bienvenido a Cleverum</h1>
        <p className="text-lg mb-8">Aquí puedes gestionar tus pedidos y conectarte fácilmente con nuestro chatbot.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Module 
            title="Conectar WhatsApp"
            content="Navega a la página de Chatbot para conectar tu WhatsApp Web y empezar a chatear con nosotros."
          />
          <Module 
            title="Ver Pedidos"
            content="Dirígete a la sección de Pedidos para revisar el estado de tus pedidos actuales."
          />
          <Module 
            title="Notificaciones"
            content="Usa la campana de notificaciones para estar al tanto de cualquier actualización sobre tus pedidos."
          />
        </div>
      </div>
    </>
  );
};

export default HomePage;
