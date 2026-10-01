
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface PlinkoAnimationProps {
  className?: string;
  isHovered: boolean;
}

export function PlinkoAnimation({
  className,
  isHovered,
}: PlinkoAnimationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isMouseOver = useRef(isHovered);
  const { theme } = useTheme();

  useEffect(() => {
    isMouseOver.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    let animationFrameId: number;
    const cleanupFunctions: (() => void)[] = [];

    animationFrameId = requestAnimationFrame(() => {
      if (!currentMount) return;

      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColorValue = computedStyle.getPropertyValue('--animation-primary-color').trim();
      const primaryColor = new THREE.Color(primaryColorValue);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
      camera.position.set(0, 8, 10);
      camera.lookAt(0, 2, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      currentMount.appendChild(renderer.domElement);
      cleanupFunctions.push(() => {
        if (renderer.domElement.parentElement === currentMount) {
            currentMount.removeChild(renderer.domElement);
        }
        renderer.dispose();
      });

      // Create surface
      const size = 20;
      const segments = 50;
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
      const positions = geometry.attributes.position.array as Float32Array;
      cleanupFunctions.push(() => geometry.dispose());

      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const dist = Math.sqrt(x * x + y * y);
        positions[i + 2] = 3 * Math.exp(-(dist * dist) / 20);
      }
      geometry.computeVertexNormals();

      const material = new THREE.MeshBasicMaterial({
        wireframe: true,
        transparent: true,
      });
      material.color.set(primaryColor);
      const surface = new THREE.Mesh(geometry, material);
      surface.rotation.x = -Math.PI / 2;
      surface.position.y = 2; // Move the whole surface up
      scene.add(surface);
      cleanupFunctions.push(() => material.dispose());

      const clock = new THREE.Clock();
      let rippleAmplitude = 0.5;

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        const targetAmplitude = isMouseOver.current ? 1.5 : 0.5;
        rippleAmplitude += (targetAmplitude - rippleAmplitude) * 0.05;

        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const y = positions[i + 1];
          const dist = Math.sqrt(x * x + y * y);
          
          const baseHeight = 3 * Math.exp(-(dist * dist) / 20);
          const ripple = Math.sin(time * (isMouseOver.current ? 4 : 2) - dist * 0.8) * rippleAmplitude;
          
          positions[i + 2] = baseHeight + ripple;
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();

        scene.rotation.y = time * 0.08;

        renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (currentMount) {
            camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        }
      };
      window.addEventListener('resize', handleResize);
      cleanupFunctions.push(() => window.removeEventListener('resize', handleResize));
      
      cleanupFunctions.push(() => {
        cancelAnimationFrame(animationFrameId);
      });
    });

    return () => {
      cleanupFunctions.forEach(fn => fn());
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      while (currentMount.firstChild) {
        currentMount.removeChild(currentMount.firstChild);
      }
    };
  }, [theme]);

  return <div ref={mountRef} className={cn('h-full w-full', className)} />;
}
