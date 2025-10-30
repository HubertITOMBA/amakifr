"use client";

import { useEffect, useRef } from 'react';

export interface MapComponentProps {
  address: string;
  location?: string;
}

export default function MapComponent({ address, location }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Créer une iframe Google Maps intégrée
    const searchQuery = encodeURIComponent(`${location || ''} ${address}`.trim());
    const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${searchQuery}`;
    
    // Si pas de clé API, utiliser une carte OpenStreetMap
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=-0.1276,51.5074,0.1276,51.5074&layer=mapnik&marker=${encodeURIComponent(address)}`;
      if (mapRef.current) {
        mapRef.current.innerHTML = `
          <iframe 
            width="100%" 
            height="400" 
            frameborder="0" 
            scrolling="no" 
            marginheight="0" 
            marginwidth="0" 
            src="${osmUrl}"
            style="border: 1px solid #ccc; border-radius: 8px;"
          ></iframe>
          <br/>
          <small>
            <a href="https://www.openstreetmap.org/?mlat=51.5074&mlon=-0.1276#map=12/51.5074/-0.1276" target="_blank">
              Voir une carte plus grande
            </a>
          </small>
        `;
      }
    } else {
      if (mapRef.current) {
        mapRef.current.innerHTML = `
          <iframe 
            width="100%" 
            height="400" 
            frameborder="0" 
            style="border:0; border-radius: 8px;" 
            src="${googleMapsUrl}"
            allowfullscreen
          ></iframe>
        `;
      }
    }
  }, [address, location]);

  return (
    <div className="w-full">
      <div ref={mapRef} className="w-full rounded-lg overflow-hidden" />
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        <p><strong>Adresse:</strong> {location && `${location}, `}{address}</p>
      </div>
    </div>
  );
}

