"use client";

import React from "react";
import { RegisterOptions, useForm } from "react-hook-form";
import Image from "next/image";
import { passwordValidation } from "../utils/form";
import Toast from "../components/toast";
import Link from "next/link";

type FormData = {
  username: string;
  password: string;
};

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    // Send a POST request to the register API route
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        setSuccessMessage("Gracias por registrarse.");
        setError(null);
        reset();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Falla en el registro de usuario. " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-cyan-900">
      <img
        src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-logo.png"
        alt="Cleverum Logo"
        width={200}
        height={200}
        className="mb-6"
      />

      {successMessage && (
        <Toast
          type="success"
          message={successMessage}
          actionMessage={
            <p>
              Ahora puede ir al{" "}
              <Link href="/login" className="underline">
                Login
              </Link>
            </p>
          }
        />
      )}

      {error && <Toast type="error" message={error} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">
          Registrar Usuario
        </h2>
        <input
          type="text"
          placeholder="Username"
          {...register("username", {
            required: "El nombre de usuario es requerido",
          })}
          className="mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
        />
        {errors.username && (
          <p className="text-red-500 text-sm mb-4 text-center">
            {errors.username.message?.toString()}
          </p>
        )}
        <input
          type="password"
          placeholder="Password"
          {...register(
            "password",
            passwordValidation() as RegisterOptions<FormData>
          )}
          className="mb-4 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
        />
        {errors.password && (
          <p className="text-red-500 text-sm mb-4 text-center">
            {errors.password.message?.toString()}
          </p>
        )}
        <button
          type="submit"
          className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors w-full"
        >
          Registrar
        </button>
        <p className="mt-4 text-center">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
