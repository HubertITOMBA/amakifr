"use client";

import { useEffect, useState } from "react";
import { getElections } from "@/actions/elections";

export function DebugVote() {
  const [debug, setDebug] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testElections = async () => {
      try {
        console.log("🔍 Test des élections...");
        const result = await getElections();
        console.log("📊 Résultat getElections:", result);
        setDebug(result);
      } catch (err) {
        console.error("❌ Erreur getElections:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    };

    testElections();
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="font-bold mb-2">🐛 Debug Vote Page</h3>
      {error && (
        <div className="text-red-600 mb-2">
          <strong>Erreur:</strong> {error}
        </div>
      )}
      <pre className="text-xs overflow-auto max-h-40">
        {JSON.stringify(debug, null, 2)}
      </pre>
    </div>
  );
}


