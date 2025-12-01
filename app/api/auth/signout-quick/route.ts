import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Invalidation côté client: on vide les cookies de session NextAuth (JWT)
  // Couvre les variantes sécurisées et non sécurisées
  // Cette route est utilisée pour la déconnexion rapide (fermeture d'onglet)
  // et ne nécessite pas de token CSRF car elle est appelée via sendBeacon
  const expires = new Date(0).toUTCString();

  const cookies: string[] = [
    `next-auth.session-token=; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`,
    `__Secure-next-auth.session-token=; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax; Secure`,
    `next-auth.csrf-token=; Path=/; Expires=${expires}; SameSite=Lax`,
    `__Host-next-auth.csrf-token=; Path=/; Expires=${expires}; SameSite=Lax; Secure`,
    `authjs.session-token=; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`,
    `authjs.csrf-token=; Path=/; Expires=${expires}; SameSite=Lax`,
  ];

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Set-Cookie": cookies,
      "Cache-Control": "no-store",
    },
  });
}
