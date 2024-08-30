"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import "./styles.css";
import { isAuthenticated, login } from "../lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(username, password);

    // Simple credentials check
    if (isAuthenticated()) {
      router.push("/home");
    } else {
      setError("Nombre de usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sesión</h2>
        <input
          type="text"
          placeholder="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}
        <button
          type="submit"
          className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
