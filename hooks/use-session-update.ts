"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export const useSessionUpdate = () => {
  const { data: session, status, update } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);

  const forceUpdate = async () => {
    setIsUpdating(true);
    try {
      // Forcer la mise à jour de la session
      await update();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la session:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    session,
    status,
    isUpdating,
    forceUpdate
  };
};

