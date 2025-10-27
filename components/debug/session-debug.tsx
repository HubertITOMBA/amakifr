"use client";

import { useSession } from "next-auth/react";

export function SessionDebug() {
  const { data: session, status } = useSession();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Session Debug</h3>
      <div>Status: {status}</div>
      <div>Session: {session ? 'Present' : 'None'}</div>
      <div>User: {session?.user?.name || 'None'}</div>
    </div>
  );
}

