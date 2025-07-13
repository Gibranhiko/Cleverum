// components/public-navbar.jsx
"use client";

import React from "react";
import Link from "next/link";

export default function PublicNavbar() {
  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between relative">
      {/* Elemento de relleno izquierdo para balancear el espacio */}
      {/* Este div no contiene nada y su ancho lo determinará Tailwind.
          Lo usaremos para "empujar" el logo al centro. */}
      <div className="flex-grow"></div>

      {/* Logo + Nombre - Ahora estará centrado */}
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center">
          <img
            src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
            alt="Cleverum Logo"
            width={40}
            height={40}
            className="mr-2"
          />
          <span className="text-xl font-bold select-none">Cleverum</span>
        </Link>
      </div>

      {/* Botón Login */}
      <div className="flex-grow flex justify-end">
        {" "}
        {/* Agregamos flex-grow y justify-end */}
        <Link
          href="/login"
          className="
            border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-md font-semibold transition-colors duration-200
          "
        >
          Iniciar sesión
        </Link>
      </div>
    </nav>
  );
}
