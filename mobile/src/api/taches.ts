import { authenticatedFetch } from "@/auth/session";
import type {
  MyTacheDto,
  CreateMyTacheCommentaireInput,
  CreateMyTacheCommentaireResult,
} from "@/api/types";

/**
 * GET /api/v1/me/taches — tâches affectées à l'adhérent connecté.
 */
export async function getMyTaches(): Promise<MyTacheDto[]> {
  return authenticatedFetch<MyTacheDto[]>("/api/v1/me/taches");
}

/**
 * POST /api/v1/me/taches/[id]/commentaires — ajouter un commentaire.
 */
export async function createMyTacheCommentaire(
  tacheId: string,
  input: CreateMyTacheCommentaireInput
): Promise<CreateMyTacheCommentaireResult> {
  return authenticatedFetch<CreateMyTacheCommentaireResult>(
    `/api/v1/me/taches/${encodeURIComponent(tacheId)}/commentaires`,
    {
      method: "POST",
      body: input,
    }
  );
}
