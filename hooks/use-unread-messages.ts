import { useState, useEffect } from "react";
import { getUnreadMessagesCount } from "@/actions/chat";

/**
 * Hook pour récupérer le nombre de messages non lus
 * Met à jour automatiquement toutes les 30 secondes
 */
export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const result = await getUnreadMessagesCount();
      if (result.success && typeof result.count === "number") {
        setCount(result.count);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des messages non lus:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    
    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(fetchCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { count, loading, refetch: fetchCount };
}
