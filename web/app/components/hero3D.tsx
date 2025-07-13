// components/Hero3DCanvas.jsx
"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

const Hero3DCanvas = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const objectRef = useRef(null); // Referencia al objeto 3D principal

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    requestAnimationFrame(animate);

    // Animación para el objeto 3D: Rotación y un ligero movimiento
    if (objectRef.current) {
      objectRef.current.rotation.y += 0.001; // Rotación lenta en Y
      objectRef.current.rotation.x += 0.0005; // Rotación más lenta en X

      // Efecto de "respiración" o pulsación sutil en la escala
      const time = Date.now() * 0.0005;
      objectRef.current.scale.setScalar(1 + Math.sin(time * 0.5) * 0.03); // Pulsación sutil
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Escena
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Cámara
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; // Mueve la cámara hacia atrás para ver el objeto
    cameraRef.current = camera;

    // Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Iluminación
    // Para objetos abstractos sin texturas, la iluminación es clave para dar volumen.
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // Luz ambiental más brillante
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xff00ff, 1); // Luz direccional rosada
    directionalLight1.position.set(5, 5, 5).normalize();
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x00ffff, 0.8); // Luz direccional cian
    directionalLight2.position.set(-5, -5, -5).normalize();
    scene.add(directionalLight2);

    // --- Creación del Objeto 3D Abstracto ---
    // Opción 1: Un Icosaedro (una esfera con caras triangulares)
    // Se ve muy bien con un material básico y algo de iluminación.
    const geometry = new THREE.IcosahedronGeometry(2, 0); // Radio 2, detalle 0 (forma básica)
    const material = new THREE.MeshPhongMaterial({
      color: 0x007bff, // Un azul vibrante
      specular: 0x00ffff, // Brillo cian para un efecto metálico o de gema
      shininess: 100, // Intensidad del brillo
      flatShading: true, // Para ver las caras planas del icosaedro
      transparent: true, // Habilitar transparencia
      opacity: 0.9, // Un poco de transparencia para el efecto abstracto
    });

    const icosahedron = new THREE.Mesh(geometry, material);
    scene.add(icosahedron);
    objectRef.current = icosahedron; // Asigna el icosaedro como el objeto principal

    // Opciones alternativas de geometría (descomenta para probar):
    /*
    // Una dona (torus)
    const torusGeometry = new THREE.TorusGeometry(1.5, 0.5, 16, 100);
    const torusMaterial = new THREE.MeshStandardMaterial({ color: 0xffa000, roughness: 0.5, metalness: 0.8 });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    scene.add(torus);
    objectRef.current = torus;

    // Un cubo con bordes biselados (BoxGeometry)
    const boxGeometry = new THREE.BoxGeometry(3, 3, 3, 10, 10, 10);
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x8800ff, wireframe: true }); // Material de alambre
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    scene.add(box);
    objectRef.current = box;
    */

    // Manejar redimensionamiento de ventana
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    // Iniciar animación
    animate();

    // Limpieza al desmontar el componente
    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();

      // Limpieza de la escena: importante para evitar fugas de memoria
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material.isMaterial) {
            object.material.dispose();
          } else if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          }
        }
      });
      scene.clear();
      camera.clear();
    };
  }, [animate]); // `animate` está en las dependencias porque es una función memoizada con useCallback

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};

export default Hero3DCanvas;