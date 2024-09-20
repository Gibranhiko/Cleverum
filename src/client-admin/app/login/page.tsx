"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import "./styles.css";
import Image from "next/image";
import Link from "next/link";
import Toast from "../components/toast";
import { useAppContext } from "../context/AppContext";

type FormData = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const router = useRouter();
  
  // State for success and error messages
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {setState} = useAppContext();

  const onSubmit = async (data: FormData) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage("Inicio de sesión exitoso. Redirigiendo...");
        setErrorMessage(null);

        setState((prevState) => ({
          ...prevState,
          isAuthenticated: true
        }));

        // Redirect to home
        router.push("/");
      } else {
        // Handle login error
        setErrorMessage(result.message);
        setSuccessMessage(null);
      }
    } catch (error) {
      setErrorMessage("Error al iniciar sesión" + error);
      setSuccessMessage(null);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900">
      <Image
        src="/images/cleverum-logo.png"
        alt="Cleverum Logo"
        width={200}
        height={200}
        className="mb-6"
      />

      {/* Toast for Success */}
      {successMessage && (
        <Toast 
          type="success" 
          message={successMessage} 
        />
      )}

      {/* Toast for Error */}
      {errorMessage && (
        <Toast 
          type="error" 
          message={errorMessage} 
        />
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sesión</h2>
        <input
          type="text"
          placeholder="Nombre de usuario"
          {...register("username", { required: "Nombre de usuario es requerido" })}
          className={`mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${errors.username ? 'border-red-500' : ''}`}
        />
        {errors.username && (
          <p className="text-red-500 text-sm mb-4 text-center">{errors.username.message}</p>
        )}
        <input
          type="password"
          placeholder="Contraseña"
          {...register("password", { required: "Contraseña es requerida" })}
          className={`mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${errors.password ? 'border-red-500' : ''}`}
        />
        {errors.password && (
          <p className="text-red-500 text-sm mb-4 text-center">{errors.password.message}</p>
        )}
        <button
          type="submit"
          className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors w-full"
        >
          Ingresar
        </button>
        <p className="mt-4 text-center">
          ¿No tienes una cuenta?{" "}
          <Link href="/registro" className="text-blue-500 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
