"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VotePageSimple() {
  const [mounted, setMounted] = useState(false);
  const [test, setTest] = useState("Initial");

  useEffect(() => {
    setMounted(true);
    setTest("Mounted");
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Chargement...</h1>
            <p>État: {test}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Test Page Vote</CardTitle>
          </CardHeader>
          <CardContent>
            <p>État: {test}</p>
            <p>Mounted: {mounted ? "Oui" : "Non"}</p>
            <p>Cette page fonctionne correctement !</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


