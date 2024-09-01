"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "../context/AppContext";

export default function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { state, setState } = useAppContext();

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const updateCurrentPage = useCallback((page: string) => {
    setState((prevState) => ({
      ...prevState,
      currentPage: page,
    }));
  }, [setState]);

  const getNavLinkClasses = (page: string) =>
    `block mt-4 lg:inline-block lg:mt-0 ${
      state.currentPage === page ? "border-b-2 border-yellow-400" : ""
    }`;

  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between relative">
      <div className="flex items-center space-x-8">
        <Image
          src="/images/cleverum-brain.png"
          alt="Cleverum Logo"
          width={40}
          height={40}
          className="mr-2"
        />
        <div className="flex flex-col">
          <Link href="/" onClick={() => updateCurrentPage("")}>
            <span className="text-xl font-bold">Cleverum</span>
          </Link>
          <span className="text-sm font-bold">Restaurant 1.0</span>
        </div>
        <ul className="flex space-x-4 ml-8">
          <li>
            <Link
              href="/pedidos"
              className={getNavLinkClasses("pedidos")}
              onClick={() => updateCurrentPage("pedidos")}
              aria-current={state.currentPage === "pedidos" ? "page" : undefined}
            >
              Pedidos
            </Link>
          </li>
          <li>
            <Link
              href="/productos"
              className={getNavLinkClasses("productos")}
              onClick={() => updateCurrentPage("productos")}
              aria-current={state.currentPage === "productos" ? "page" : undefined}
            >
              Productos
            </Link>
          </li>
          <li>
            <Link
              href="/promociones"
              className={getNavLinkClasses("promociones")}
              onClick={() => updateCurrentPage("promociones")}
              aria-current={state.currentPage === "promociones" ? "page" : undefined}
            >
              Promociones
            </Link>
          </li>
        </ul>
      </div>
      <div className="relative flex items-center space-x-2 z-10">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
          <Image
            src="/images/rey-pollo-logo.png" // Update with your store logo path
            alt="Store Logo"
            width={40}
            height={40}
          />
        </div>
        <span className="font-bold">El rey del pollito</span>
        <button
          onClick={toggleDropdown}
          className="focus:outline-none flex items-center"
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${
              isDropdownOpen ? "transform rotate-180" : "transform rotate-0"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <ul className="absolute right-0 top-full mt-2 w-48 bg-white text-gray-800 shadow-lg rounded-lg z-20">
            <li className="hover:bg-gray-200">
              <Link href="/perfil" className="block px-4 py-2">
                Perfil
              </Link>
            </li>
            <li className="hover:bg-gray-200">
              <Link href="/api-keys" className="block px-4 py-2">
                API keys
              </Link>
            </li>
            <li className="hover:bg-gray-200">
              <Link href="/logout" className="block px-4 py-2">
                Desconectar
              </Link>
            </li>
          </ul>
        )}
      </div>
    </nav>
  );
}
