"use client";

import { useEffect, useRef } from 'react';

export interface QRCodeComponentProps {
  url: string;
  size?: number;
}

export default function QRCodeComponent({ url, size = 200 }: QRCodeComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Utiliser une API QR Code simple sans dépendance externe
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Créer un QR Code simple avec une API en ligne
    // Alternative: utiliser qrcode.react si installé
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
    
    // Créer une image pour le QR Code
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      // Fallback: dessiner un QR code simple
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'black';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('QR Code', size / 2, size / 2 - 10);
      ctx.fillText('Indisponible', size / 2, size / 2 + 10);
    };
    img.src = qrUrl;
  }, [url, size]);

  return (
    <div className="flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        className="border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-white"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline mt-2 break-all text-center max-w-xs"
      >
        {url}
      </a>
    </div>
  );
}

