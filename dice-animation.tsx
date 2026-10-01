
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface DiceAnimationProps {
  className?: string;
  isHovered: boolean;
}

export function DiceAnimation({
  className,
  isHovered,
}: DiceAnimationProps) {
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

    const main = () => {
      let frameId: number;

      const computedStyle = getComputedStyle(currentMount);
      const primaryColorValue = computedStyle.getPropertyValue('--animation-primary-color').trim();
      const primaryColor = new THREE.Color(primaryColorValue);
      
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      currentMount.appendChild(renderer.domElement);

      const light = new THREE.DirectionalLight(0xffffff, 2.5);
      light.position.set(2, 5, 3);
      scene.add(light);
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const dotColor = primaryColor.getStyle();
      
      const backgroundColorValue = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
      const [h, s, l] = backgroundColorValue.split(' ').map(parseFloat);
      const faceColor = new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`).getStyle();

      const createDieFaceMaterial = (dots: { x: number; y: number }[], fgColor: string, bgColor: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return new THREE.MeshStandardMaterial({ color: 0x111111 });

        context.fillStyle = bgColor;
        context.fillRect(0, 0, 128, 128);
        context.fillStyle = fgColor;
        dots.forEach((dot) => {
          context.beginPath();
          context.arc(dot.x, dot.y, 10, 0, Math.PI * 2);
          context.fill();
        });

        return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) });
      };

      const materials = [
        createDieFaceMaterial([{ x: 64, y: 64 }], dotColor, faceColor), // 1
        createDieFaceMaterial([{ x: 32, y: 32 }, { x: 96, y: 96 }], dotColor, faceColor), // 2
        createDieFaceMaterial([{ x: 32, y: 32 }, { x: 64, y: 64 }, { x: 96, y: 96 }], dotColor, faceColor), // 3
        createDieFaceMaterial([{ x: 32, y: 32 }, { x: 96, y: 96 }, { x: 32, y: 96 }, { x: 96, y: 32 }], dotColor, faceColor), // 4
        createDieFaceMaterial([{ x: 32, y: 32 }, { x: 96, y: 96 }, { x: 32, y: 96 }, { x: 96, y: 32 }, { x: 64, y: 64 }], dotColor, faceColor), // 5
        createDieFaceMaterial([{ x: 32, y: 32 }, { x: 96, y: 96 }, { x: 32, y: 64 }, { x: 96, y: 64 }, { x: 32, y: 96 }, { x: 96, y: 32 }], dotColor, faceColor), // 6
      ];

      const dieGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const die1 = new THREE.Mesh(dieGeometry, materials);
      const die2 = new THREE.Mesh(dieGeometry, materials);

      const diceGroup = new THREE.Group();
      die1.position.x = -1.2;
      die2.position.x = 1.2;
      diceGroup.add(die1);
      diceGroup.add(die2);
      
      scene.add(diceGroup);

      const clock = new THREE.Clock();

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        
        const rotationSpeed = isMouseOver.current ? 1.5 : 0.2;
        
        // Rotate the group
        diceGroup.rotation.y += rotationSpeed * delta * 0.8;

        // Rotate individual dice
        die1.rotation.x += rotationSpeed * delta;
        die1.rotation.y += rotationSpeed * delta * 0.5;
        die2.rotation.x -= rotationSpeed * delta * 0.8;
        die2.rotation.y -= rotationSpeed * delta;


        renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        const mRef = mountRef.current;
        if (mRef) {
          camera.aspect = mRef.clientWidth / mRef.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(mRef.clientWidth, mRef.clientHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        const mRef = mountRef.current;
        if (mRef) {
          if(renderer.domElement) mRef.removeChild(renderer.domElement);
        }
        renderer.dispose();
        dieGeometry.dispose();
        materials.forEach(m => {
          m.map?.dispose();
          m.dispose();
        });
      };
    };
    
    animationFrameId = requestAnimationFrame(main);

    return () => {
      cancelAnimationFrame(animationFrameId);
      const mRef = mountRef.current;
      if (mRef) {
        while (mRef.firstChild) {
          mRef.removeChild(mRef.firstChild);
        }
      }
    }
  }, [theme]);

  return <div ref={mountRef} className={cn('h-full w-full', className)} />;
}
