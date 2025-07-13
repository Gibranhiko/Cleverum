// pages/index.jsx (o donde esté tu HomePage)
"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import PublicNavbar from "./components/public-navbar";
import Hero3DCanvas from "./components/hero3D"; // Importa el nuevo componente

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const mainRef = useRef(null);

  // Número de teléfono para WhatsApp (asegúrate de que sea el formato internacional sin + ni espacios para el URL)
  const phoneNumber = "5218186018847"; // +52 1 81 8601 8847

  // Mensaje predefinido, codificado para URL
  const encodedMessage = encodeURIComponent("¡Quiero automatizar mi negocio con Cleverum! Cuéntame cómo podemos empezar.");

  // URL completa de WhatsApp
  const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animaciones de secciones
      const sections = gsap.utils.toArray("section");
      sections.forEach((section) => {
        gsap.from(section as Element, {
          scrollTrigger: {
            trigger: section as Element,
            start: "top 85%",
            toggleActions: "play none none none",
            // markers: true, // Descomentar para depurar el ScrollTrigger
          },
          opacity: 0,
          y: 70, // Un poco más de desplazamiento para mayor impacto
          duration: 1, // Duración ligeramente mayor
          ease: "power4.out", // Curva de easing más dramática
        });
      });

      // Animación especial para el H1 del Hero, para más impacto inicial y wide
      gsap.from(".hero-h1", {
        opacity: 0,
        y: 50, // Más desplazamiento inicial
        scale: 0.9, // Empieza un poco más pequeño
        duration: 1.5, // Más duración para una entrada majestuosa
        delay: 0.5, // Un pequeño delay para que el 3D cargue primero
        ease: "power4.out",
      });

      // Animación para el párrafo del Hero
      gsap.from(".hero-p", {
        opacity: 0,
        y: 30,
        duration: 1.2,
        delay: 0.8, // Después del H1
        ease: "power3.out",
      });

      // Animación para el botón de contacto
      gsap.fromTo(
        ".contact-button",
        {
          // Estado inicial (FROM)
          opacity: 0,
          y: 20,
        },
        {
          // Estado final (TO)
          opacity: 1, // Aseguramos que termine completamente visible
          y: 0, // Aseguramos que termine en su posición original
          duration: 1,
          delay: 1.2, // Después del párrafo
          ease: "power2.out",
        }
      );
    }, mainRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <PublicNavbar />

      <main
        ref={mainRef}
        className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden"
      >
        {/* Hero Section con el fondo 3D */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 md:px-6 py-40 min-h-screen w-full">
          {/* Fondo 3D */}
          <Hero3DCanvas />

          {/* Contenido del Hero sobre el 3D */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <h1 className="hero-h1 text-7xl md:text-8xl lg:text-9xl font-extrabold leading-none max-w-6xl mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white drop-shadow-xl tracking-tighter">
              ¡Revoluciona tu Negocio! La IA no espera.
            </h1>
            <p className="hero-p text-xl md:text-2xl lg:text-3xl max-w-4xl text-gray-200 font-light mb-12 leading-relaxed">
              En Cleverum, no solo automatizamos procesos. Eliminamos la burocracia,
              y te damos el poder de la Inteligencia
              Artificial para conquistar tu mercado.
            </p>
            <a
              href={whatsappLink} // <-- Enlace de WhatsApp aquí
              target="_blank" // Abre en una nueva pestaña
              rel="noopener noreferrer" // Mejora la seguridad
              className="contact-button inline-block px-10 py-4 border-2 border-blue-400 text-blue-400 font-bold text-lg rounded-full hover:bg-cyan-400 hover:text-black transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/50"
            >
              ¡Quiero Automatizar Mi Negocio! 🚀
            </a>
          </div>
        </section>

        {/* Resto de Secciones */}
        <section className="bg-[#0a0a0a] px-4 md:px-6 py-32 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-5xl font-extrabold text-white mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 leading-tight">
              ¿Cansado de perder tiempo? Nosotros te ayudamos.
            </h2>
            <p className="text-gray-300 text-xl leading-relaxed max-w-3xl mx-auto">
              Analizamos tus procesos, detectamos lo obsoleto y lo transformamos
              con IA. Tus tareas repetitivas se vuelven automáticas. Tu equipo,
              imparable.
            </p>
          </div>
        </section>

        <section className="px-4 md:px-6 py-32 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-5xl font-extrabold text-white mb-8 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-400 leading-tight">
              Tu futuro no espera.
            </h2>
            <p className="text-gray-300 text-xl leading-relaxed max-w-3xl mx-auto">
              Nuestra misión es simple: armar a tu empresa con la IA más
              más efectiva. Menos esfuerzo, más resultados. Más innovación, menos
              dolores de cabeza.
            </p>
          </div>
        </section>

        <section className="bg-[#0a0a0a] px-4 md:px-6 py-32 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-5xl font-extrabold text-white mb-8 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-400 leading-tight">
              ¿Listo para dominar tu sector?
            </h2>
            <p className="text-gray-300 text-xl leading-relaxed max-w-3xl mx-auto mb-8">
              Deja de soñar con la eficiencia y empieza a vivirla. Contáctanos y
              desatemos el poder de la IA en tu empresa.
            </p>
            <a
              href={whatsappLink} // <-- Enlace de WhatsApp aquí
              target="_blank" // Abre en una nueva pestaña
              rel="noopener noreferrer" // Mejora la seguridad
              className="contact-button inline-block px-10 py-4 border-2 border-yellow-400 text-yellow-400 font-bold text-lg rounded-full hover:bg-yellow-400 hover:text-black transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
            >
              ¡Hablemos por WhatsApp Ahora! 📱
            </a>
          </div>
        </section>
      </main>
    </>
  );
}