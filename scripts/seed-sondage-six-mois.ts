#!/usr/bin/env tsx

/**
 * Crée le sondage modèle « Bilan 6 mois » (brouillon, sans envoi d'email).
 * Usage : npm run db:seed-sondage-six-mois
 */

import { PrismaClient, SondageStatus } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

const SATISFACTION = [
  "Très satisfait(e)",
  "Satisfait(e)",
  "Moyennement satisfait(e)",
  "Peu satisfait(e)",
  "Pas du tout satisfait(e)",
];

const OUI_NON = ["Oui", "Non", "Sans opinion"];

const UTILITE = ["Oui, tout à fait", "Oui, plutôt", "Peu utiles", "Pas utiles"];

function opts(labels: string[]) {
  return labels.map((libelle, ordre) => ({ ordre, libelle, permetTexteLibre: false }));
}

async function main() {
  const sujet = "Bilan des 6 premiers mois de la nouvelle équipe dirigeante";

  const existing = await prisma.sondage.findUnique({ where: { sujet } });
  if (existing) {
    console.log("ℹ️  Le sondage existe déjà :", existing.id);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!admin) {
    throw new Error("Aucun utilisateur ADMIN trouvé pour createdBy");
  }

  const dateDebut = new Date();
  const dateFin = new Date();
  dateFin.setDate(dateFin.getDate() + 30);

  const introduction = `Chers adhérents,

Depuis le début de l'année 2026, une nouvelle équipe dirigeante a pris ses fonctions. Votre avis est essentiel. Ce questionnaire a pour objectif d'évaluer les actions menées, d'identifier les points à améliorer et de construire ensemble l'avenir de notre association.

Merci de prendre quelques minutes pour y répondre avec sincérité.`;

  const conclusion = `Merci pour votre participation.
Chaque réponse sera étudiée avec attention.`;

  const questions = [
    {
      ordre: 0,
      section: "Votre satisfaction générale",
      libelle: "Comment évaluez-vous le travail de la nouvelle équipe dirigeante ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(SATISFACTION),
      lignesMatrice: [],
    },
    {
      ordre: 1,
      section: "Communication",
      libelle: "Êtes-vous satisfait(e) de la communication de l'association ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(SATISFACTION),
      lignesMatrice: [],
    },
    {
      ordre: 2,
      section: "Communication",
      libelle: "Les comptes rendus mensuels vous paraissent-ils utiles ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(UTILITE),
      lignesMatrice: [],
    },
    {
      ordre: 3,
      section: "Transparence financière",
      libelle:
        "La présentation mensuelle de la situation financière vous semble-t-elle satisfaisante ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts([
        "Oui, tout à fait",
        "Oui, plutôt",
        "Peu satisfaisante",
        "Pas satisfaisante",
      ]),
      lignesMatrice: [],
    },
    {
      ordre: 4,
      section: "Transparence financière",
      libelle: "Pensez-vous que la gestion financière est aujourd'hui plus transparente ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(OUI_NON),
      lignesMatrice: [],
    },
    {
      ordre: 5,
      section: "Modernisation de l'association",
      libelle: "Que pensez-vous des évolutions suivantes ?",
      type: "Matrice" as const,
      obligatoire: true,
      options: opts(SATISFACTION),
      lignesMatrice: [
        { ordre: 0, libelle: "Création du site Internet" },
        { ordre: 1, libelle: "Paiement des cotisations en ligne" },
        { ordre: 2, libelle: "Paiement par carte bancaire" },
        { ordre: 3, libelle: "Ouverture d'un nouveau compte bancaire" },
        { ordre: 4, libelle: "Informatisation de l'association" },
      ],
    },
    {
      ordre: 6,
      section: "Vie de l'association",
      libelle: "Pensez-vous que les réunions mensuelles sont aujourd'hui :",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts([
        "Plus intéressantes qu'avant",
        "Aussi intéressantes",
        "Moins intéressantes",
        "Je ne participe pas",
      ]),
      lignesMatrice: [],
    },
    {
      ordre: 7,
      section: "Vie de l'association",
      libelle: "Depuis quelques mois, participez-vous davantage aux réunions ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(["Oui", "Non", "Sans changement"]),
      lignesMatrice: [],
    },
    {
      ordre: 8,
      section: "Vie de l'association",
      libelle: "Si oui, pour quelle raison ?",
      type: "TexteLibre" as const,
      obligatoire: false,
      maxCaracteres: 1000,
      options: [],
      lignesMatrice: [],
    },
    {
      ordre: 9,
      section: "Participation aux repas",
      libelle:
        "Selon vous, quelles pourraient être les raisons pour lesquelles certains adhérents ne cotisent pas au repas ?",
      type: "ChoixMultiple" as const,
      obligatoire: false,
      options: [
        ...opts([
          "Le coût est trop élevé",
          "Je ne participe pas au repas",
          "Je ne suis pas concerné(e)",
        ]),
        { ordre: 3, libelle: "Autre", permetTexteLibre: true },
      ],
      lignesMatrice: [],
    },
    {
      ordre: 10,
      section: "Les priorités de demain",
      libelle:
        "Parmi les actions suivantes, lesquelles souhaitez-vous voir développer ? (plusieurs réponses possibles)",
      type: "ChoixMultiple" as const,
      obligatoire: true,
      options: [
        ...opts([
          "Plus d'activités conviviales",
          "Plus de sorties",
          "Plus d'informations sur les finances",
          "Plus de communication",
          "Développement du site Internet",
          "Démarches administratives simplifiées",
        ]),
        { ordre: 6, libelle: "Autre", permetTexteLibre: true },
      ],
      lignesMatrice: [],
    },
    {
      ordre: 11,
      section: "Votre confiance",
      libelle:
        "Faites-vous confiance à la nouvelle équipe dirigeante pour poursuivre le développement de l'association ?",
      type: "ChoixUnique" as const,
      obligatoire: true,
      options: opts(["Oui, tout à fait", "Oui, plutôt", "Pas vraiment", "Pas du tout"]),
      lignesMatrice: [],
    },
    {
      ordre: 12,
      section: "Votre avis libre",
      libelle: "Selon vous, quelles sont les principales réussites de ces six premiers mois ?",
      type: "TexteLibre" as const,
      obligatoire: false,
      maxCaracteres: 3000,
      options: [],
      lignesMatrice: [],
    },
    {
      ordre: 13,
      section: "Votre avis libre",
      libelle: "Quels points devraient être améliorés ?",
      type: "TexteLibre" as const,
      obligatoire: false,
      maxCaracteres: 3000,
      options: [],
      lignesMatrice: [],
    },
    {
      ordre: 14,
      section: "Votre avis libre",
      libelle: "Avez-vous des propositions ou des idées pour améliorer notre association ?",
      type: "TexteLibre" as const,
      obligatoire: false,
      maxCaracteres: 3000,
      options: [],
      lignesMatrice: [],
    },
    {
      ordre: 15,
      section: "Votre avis libre",
      libelle: "Souhaitez-vous ajouter un commentaire ?",
      type: "TexteLibre" as const,
      obligatoire: false,
      maxCaracteres: 2000,
      options: [],
      lignesMatrice: [],
    },
  ];

  const sondage = await prisma.sondage.create({
    data: {
      sujet,
      introduction,
      conclusion,
      dateDebut,
      dateFin,
      status: SondageStatus.Brouillon,
      createdBy: admin.id,
      questions: {
        create: questions.map((q) => ({
          ordre: q.ordre,
          section: q.section,
          libelle: q.libelle,
          type: q.type,
          obligatoire: q.obligatoire,
          maxSelections: "maxSelections" in q ? (q as { maxSelections?: number }).maxSelections : null,
          minCaracteres: null,
          maxCaracteres: "maxCaracteres" in q ? (q as { maxCaracteres?: number }).maxCaracteres : null,
          options: { create: q.options },
          lignesMatrice: { create: q.lignesMatrice },
        })),
      },
    },
  });

  console.log("✅ Sondage modèle créé (brouillon) :", sondage.id);
  console.log("   Sujet :", sujet);
  console.log("   Questions :", questions.length);
  console.log("   Publiez-le depuis /admin/sondages pour notifier les adhérents.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
