"use client";

import { useEffect, useState } from "react";

/**
 * Compte à rebours jusqu'à expiresAt (ISO) — mis à jour chaque seconde.
 */
export function useExpiresCountdown(expiresAt: string | null | undefined): {
  label: string;
  expired: boolean;
  remainingMs: number;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) {
    return { label: "—", expired: true, remainingMs: 0 };
  }
  const end = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, end - now);
  const expired = remainingMs <= 0;
  if (expired) {
    return { label: "Expirée", expired: true, remainingMs: 0 };
  }
  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0 || days > 0) parts.push(`${hours} h`);
  parts.push(`${mins} min`);
  if (days === 0) parts.push(`${secs} s`);
  return { label: parts.join(" "), expired: false, remainingMs };
}
