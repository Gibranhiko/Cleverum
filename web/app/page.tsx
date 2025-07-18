// pages/index.jsx (o donde esté tu HomePage)
"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import PublicNavbar from "./components/public-navbar";
import Hero3DCanvas from "./components/hero3D"; // Importa el nuevo componente
import { ArrowRight, Brain, ChevronDown, Rocket, Zap } from "lucide-react";

// Extiende la interfaz Window para incluir ScrollTrigger
declare global {
  interface Window {
    gsap?: typeof gsap;
    ScrollTrigger?: typeof ScrollTrigger;
  }
}

// gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const mainRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const phoneNumber = "5218186018847";
  const encodedMessage = encodeURIComponent(
    "¡Quiero automatizar mi negocio con Cleverum! Cuéntame cómo podemos empezar."
  );
  const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrolled / maxScroll;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Cargar GSAP si no está disponible
    if (typeof window !== "undefined" && !window.gsap) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js";
      script.onload = () => {
        const scrollTriggerScript = document.createElement("script");
        scrollTriggerScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js";
        scrollTriggerScript.onload = () => {
          initializeAnimations();
        };
        document.head.appendChild(scrollTriggerScript);
      };
      document.head.appendChild(script);
    } else if (window.gsap) {
      initializeAnimations();
    }
  }, []);

  const initializeAnimations = () => {
    if (typeof window === "undefined" || !window.gsap) return;

    const { gsap } = window;

    // Registrar ScrollTrigger
    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Animaciones de entrada para elementos con clases específicas
    gsap.fromTo(
      ".gsap-hero-title",
      { opacity: 0, y: 80 },
      { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.3 }
    );

    gsap.fromTo(
      ".gsap-hero-subtitle",
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.6 }
    );

    gsap.fromTo(
      ".gsap-hero-description",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.9 }
    );

    gsap.fromTo(
      ".gsap-hero-cta",
      { opacity: 0, y: 30, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        delay: 1.2,
      }
    );

    gsap.fromTo(
      ".gsap-chevron",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 1.5 }
    );

    // Animación continua para el chevron
    gsap.to(".gsap-chevron", {
      y: 8,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    // Animaciones para secciones con ScrollTrigger
    if (window.ScrollTrigger) {
      gsap.utils.toArray(".gsap-section").forEach((section, index) => {
        gsap.fromTo(
          section as Element,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section as Element,
              start: "top 75%",
              end: "bottom 25%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      gsap.utils.toArray(".gsap-card").forEach((card, index) => {
        gsap.fromTo(
          card as Element,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card as Element,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play none none reverse",
            },
            delay: index * 0.15,
          }
        );
      });
    }
  };

  const scrollToNextSection = () => {
    document.getElementById("section1")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <PublicNavbar />
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-black/20 z-50">
        <div
          className="h-full bg-gradient-to-r from-blue-400/60 via-indigo-400/60 to-purple-400/60 transition-all duration-300"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <main
        ref={mainRef}
        className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden"
      >
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 md:px-6 py-40 min-h-screen w-full">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-indigo-900/15 to-purple-900/10" />
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <Hero3DCanvas />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-7xl mx-auto">
            <div className="gsap-hero-title opacity-0 mb-12">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-none mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-white/90 tracking-tight">
                Revoluciona tu
                <br />
                <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400/80 via-indigo-400/80 to-purple-400/80">
                  Negocio
                </span>
              </h1>
            </div>
            
            <div className="gsap-hero-subtitle opacity-0 mb-8">
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white/80 tracking-wide">
                La IA no espera
              </div>
            </div>
            
            <div className="gsap-hero-description opacity-0 mb-16">
              <p className="text-lg md:text-xl lg:text-2xl max-w-4xl text-gray-300/90 font-light leading-relaxed">
                En <span className="text-blue-400/90 font-medium">Cleverum</span>, no solo automatizamos procesos.
                <br className="hidden md:block" />
                <span className="text-indigo-400/90 font-medium">Eliminamos la burocracia</span> y te damos el poder de la
                <br className="hidden md:block" />
                <span className="text-purple-400/90 font-medium">Inteligencia Artificial</span> para conquistar tu mercado.
              </p>
            </div>
            
            <div className="gsap-hero-cta opacity-0 mb-20">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center px-10 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white font-medium text-lg rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-500 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"></div>
                <Rocket className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                <span className="relative z-10">Quiero Automatizar Mi Negocio</span>
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </div>
          </div>

          <button 
            onClick={scrollToNextSection}
            className="gsap-chevron opacity-0 absolute bottom-12 left-1/2 transform -translate-x-1/2 text-white/40 hover:text-white/70 transition-all duration-500"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </section>

        {/* Section 1 - Análisis */}
        <section id="section1" className="gsap-section opacity-0 relative px-6 py-32 bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div className="gsap-card opacity-0">
                <div className="professional-card rounded-3xl p-10 transform hover:scale-[1.02] transition-all duration-500">
                  <Zap className="w-14 h-14 text-blue-400/80 mb-8" />
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 leading-tight">
                    ¿Cansado de perder
                    <br />
                    <span className="text-blue-400/90 font-bold">tiempo?</span>
                  </h2>
                  <p className="text-gray-300/90 text-xl leading-relaxed mb-10 font-light">
                    <span className="text-blue-400/90 font-medium">Analizamos</span> tus procesos,
                    <span className="text-indigo-400/90 font-medium"> detectamos</span> lo obsoleto y lo
                    <span className="text-purple-400/90 font-medium"> transformamos</span> con IA.
                  </p>
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-400/60 rounded-full mr-6"></div>
                      <span className="text-gray-300/90 text-lg">Tareas repetitivas → <span className="text-green-400/90 font-medium">Automáticas</span></span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-indigo-400/60 rounded-full mr-6"></div>
                      <span className="text-gray-300/90 text-lg">Tu equipo → <span className="text-green-400/90 font-medium">Imparable</span></span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="gsap-card opacity-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl blur-xl"></div>
                  <div className="relative professional-card rounded-3xl p-10 border border-white/10">
                    <div className="text-center mb-8">
                      <div className="text-3xl font-bold text-white mb-3">
                        Transformación Digital
                      </div>
                      <div className="text-sm text-gray-400/80 font-light">Procesos Inteligentes</div>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <span className="text-gray-300/90 font-light">📊 Análisis de Procesos</span>
                        <span className="text-blue-400/90 font-medium">Completo</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <span className="text-gray-300/90 font-light">🤖 Implementación IA</span>
                        <span className="text-green-400/90 font-medium">Personalizada</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <span className="text-gray-300/90 font-light">🚀 Resultados</span>
                        <span className="text-indigo-400/90 font-medium">Inmediatos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 - Transformación */}
        <section className="gsap-section opacity-0 relative px-6 py-32 bg-gradient-to-br from-blue-900/5 via-indigo-900/10 to-purple-900/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div className="gsap-card opacity-0 md:order-2">
                <div className="professional-card rounded-3xl p-10 transform hover:scale-[1.02] transition-all duration-500">
                  <img
                    src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
                    alt="Cleverum Logo"
                    width={56}
                    height={56}
                    className="mb-8 opacity-90"
                  />
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 leading-tight">
                    Tu futuro
                    <br />
                    <span className="text-indigo-400/90 font-bold">no espera.</span>
                  </h2>
                  <p className="text-gray-300/90 text-xl leading-relaxed mb-10 font-light">
                    Nuestra misión es simple: <span className="text-blue-400/90 font-medium">armar</span> tu empresa
                    con la IA más <span className="text-indigo-400/90 font-medium">efectiva</span>.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center p-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-white/10">
                      <div className="text-3xl mb-3">🚀</div>
                      <div className="text-sm text-gray-300/90 font-light">Innovación</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-white/10">
                      <div className="text-3xl mb-3">⚡</div>
                      <div className="text-sm text-gray-300/90 font-light">Velocidad</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="gsap-card opacity-0 md:order-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl blur-xl"></div>
                  <div className="relative professional-card rounded-3xl p-10 border border-white/10">
                    <div className="text-center mb-10">
                      <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400/80 to-indigo-400/80 mb-3">
                        IA
                      </div>
                      <div className="text-sm text-gray-400/80 font-light">Inteligencia Artificial</div>
                    </div>
                    <div className="space-y-8">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white mb-3">Nuestro Enfoque</div>
                        <div className="text-gray-300/80 text-sm font-light">Tecnología que se adapta a tu negocio</div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center p-4 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl border border-white/10">
                          <div className="w-2 h-2 bg-blue-400/60 rounded-full mr-4"></div>
                          <span className="text-gray-300/90 font-light">Consultoría Personalizada</span>
                        </div>
                        <div className="flex items-center p-4 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-xl border border-white/10">
                          <div className="w-2 h-2 bg-indigo-400/60 rounded-full mr-4"></div>
                          <span className="text-gray-300/90 font-light">Soluciones Escalables</span>
                        </div>
                        <div className="flex items-center p-4 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-xl border border-white/10">
                          <div className="w-2 h-2 bg-purple-400/60 rounded-full mr-4"></div>
                          <span className="text-gray-300/90 font-light">Soporte Continuo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 - CTA Final */}
        <section className="gsap-section opacity-0 relative px-6 py-32 bg-gradient-to-br from-indigo-900/5 via-purple-900/10 to-black/50">
          <div className="max-w-7xl mx-auto text-center">
            <div className="gsap-card opacity-0 mb-20">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-10 leading-tight">
                ¿Listo para dominar
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400/80 via-indigo-400/80 to-purple-400/80 font-bold">
                  tu sector?
                </span>
              </h2>
              <p className="text-gray-300/90 text-xl md:text-2xl leading-relaxed max-w-4xl mx-auto mb-16 font-light">
                Deja de soñar con la eficiencia y empieza a <span className="text-blue-400/90 font-medium">vivirla</span>.
                <br className="hidden md:block" />
                Contáctanos y desatemos el <span className="text-indigo-400/90 font-medium">poder de la IA</span> en tu empresa.
              </p>
            </div>
            
            <div className="gsap-card opacity-0 flex flex-col sm:flex-row gap-8 justify-center items-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center px-12 py-5 bg-white/5 backdrop-blur-sm border border-white/20 text-white font-medium text-lg rounded-full hover:bg-white/10 hover:border-white/30 transition-all duration-500 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"></div>
                <img
                  src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
                  alt="Cleverum"
                  width={20}
                  height={20}
                  className="mr-3 group-hover:rotate-12 transition-transform duration-300"
                />
                <span className="relative z-10">Hablemos por WhatsApp Ahora</span>
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
              
              <div className="text-gray-400/80 text-sm font-light">
                📱 Respuesta inmediata
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-black/30 backdrop-blur-sm border-t border-white/10 py-16">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 rounded-full flex items-center justify-center mr-4 backdrop-blur-sm border border-white/10">
                <img
                  src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
                  alt="Cleverum Logo"
                  width={24}
                  height={24}
                />
              </div>
              <span className="text-2xl font-light text-white">Cleverum</span>
            </div>
            <p className="text-gray-400/80 font-light">
              © 2024 Cleverum. Transformando el futuro con Inteligencia Artificial.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
