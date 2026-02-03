"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserData } from "@/actions/user";

interface Adresse {
  id: string;
  streetnum?: string;
  street1?: string;
  street2?: string;
  codepost?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

interface Telephone {
  id: string;
  numero: string;
  type: string;
  estPrincipal: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Cotisation {
  id: string;
  type: string;
  montant: number;
  dateCotisation: string;
  moyenPaiement: string;
  description?: string;
  reference?: string;
  statut: string;
  createdAt: string;
  updatedAt: string;
}

interface ObligationCotisation {
  id: string;
  type: string;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  dateEcheance: string;
  periode: string;
  statut: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Relance {
  id: string;
  type: string;
  statut: string;
  dateEnvoi?: string;
  dateRelance?: string;
  contenu?: string;
  reponse?: string;
  montantRappele?: number;
  createdAt: string;
  updatedAt: string;
}

interface PosteTemplate {
  id: string;
  code: string;
  libelle: string;
  description?: string;
}

interface Adherent {
  id: string;
  civility?: string;
  firstname: string;
  lastname: string;
  created_at?: string;
  updated_at?: string;
  PosteTemplate?: PosteTemplate | null;
  Adresse: Adresse[];
  Telephones: Telephone[];
  Cotisations: Cotisation[];
  ObligationsCotisation: ObligationCotisation[];
  Relances: Relance[];
}

interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  role: string;
  status: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  adherent?: Adherent;
}

export function useUserProfile() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getUserData();
      if (result.success && result.user) {
        setUserProfile(result.user);
      } else {
        if (result.error && result.error !== "Non autorisé") {
          setError(result.error);
        } else {
          setUserProfile(null);
          setError(null);
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement du profil:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { userProfile, loading, error, refetch };
}
