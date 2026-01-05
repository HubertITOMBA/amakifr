import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { trackSession, updateSessionActivity } from "@/lib/session-tracker";

/**
 * API route pour tracker les sessions avec les informations complètes (IP, UserAgent)
 * Appelée automatiquement par le client après la connexion
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer l'IP et le UserAgent depuis la requête
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : request.ip || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Récupérer le sessionId depuis la session
    const sessionId = (session.user as any)?.sessionId;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID non trouvé" },
        { status: 400 }
      );
    }

    // Tracker ou mettre à jour la session
    await trackSession(
      session.user.id,
      sessionId,
      session.user.email || "",
      session.user.name || "",
      ipAddress,
      userAgent
    );

    // Mettre à jour l'activité
    await updateSessionActivity(session.user.id, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TrackSession] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors du tracking de la session" },
      { status: 500 }
    );
  }
}
