// components/public-navbar.jsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

// Componente del Navbar
export default function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? "bg-black/70 backdrop-blur-xl border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex-grow"></div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="flex items-center">
              <img
                src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
                alt="Cleverum Logo"
                width={36}
                height={36}
                className="mr-3"
              />
              <span className="text-2xl font-bold text-white tracking-wide">
                Cleverum
              </span>
            </div>
          </div>
        </div>

        <div className="flex-grow flex justify-end">
          <button className="relative group overflow-hidden border border-white/20 bg-white/5 backdrop-blur-sm text-white/90 hover:bg-white/10 hover:border-white/30 px-8 py-3 rounded-full font-medium transition-all duration-500 transform hover:scale-[1.02]">
            <span className="relative z-10">Iniciar sesión</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </button>
        </div>
      </div>
    </nav>
  );
}

