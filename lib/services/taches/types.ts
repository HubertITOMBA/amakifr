/**
 * DTOs tâches self-service mobile (aucune donnée sensible, pas de structure Prisma).
 */

export type MyTacheCommentaireAuteurDto = {
  id: string;
  firstname: string | null;
  lastname: string | null;
};

export type MyTacheCommentaireDto = {
  id: string;
  contenu: string;
  pourcentageAvancement: number | null;
  auteur: MyTacheCommentaireAuteurDto;
  createdAt: string;
};

export type MyTacheProjetDto = {
  id: string;
  titre: string;
};

export type MyTacheDto = {
  id: string;
  titre: string;
  description: string;
  statut: string;
  dateDebut: string | null;
  dateFin: string | null;
  projet: MyTacheProjetDto;
  responsable: boolean;
  commentaires: MyTacheCommentaireDto[];
};

export type CreateMyTacheCommentaireInput = {
  contenu: string;
  pourcentageAvancement?: number | null;
};

export type CreateMyTacheCommentaireResult = {
  id: string;
};
