"use server"

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ElectionStatus, PositionType, CandidacyStatus } from "@prisma/client";

// Types pour les données
interface ElectionData {
  titre: string;
  description?: string;
  dateOuverture: Date;
  dateCloture: Date;
  dateClotureCandidature: Date; // Obligatoire: dateOuverture < dateClotureCandidature < dateScrutin < dateCloture
  dateScrutin: Date;
  nombreMandats?: number;
  quorumRequis?: number;
  majoriteRequis?: string;
}

interface PositionData {
  type: PositionType;
  titre: string;
  description?: string;
  nombreMandats?: number;
  dureeMandat?: number;
  conditions?: string;
}

interface CandidacyData {
  electionId: string;
  positionId: string;
  motivation?: string;
  programme?: string;
  documents?: string[];
}

import { POSTES_LABELS, getPosteLabel, POSITION_TYPE_TO_CODE } from "@/lib/elections-constants";
import { getAllPostesTemplates } from "@/actions/postes";

// Server Action pour créer une élection avec ses postes
// Accepte soit des IDs de PosteTemplate (nouveau système) soit des PositionType (rétrocompatibilité)
export async function createElection(
  electionData: ElectionData, 
  selectedPostes: string[] // IDs de PosteTemplate ou PositionType pour rétrocompatibilité
): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des élections" };
    }

    // Validation des postes sélectionnés
    if (!selectedPostes || selectedPostes.length === 0) {
      return { success: false, error: "Veuillez sélectionner au moins un poste" };
    }

    // Validation des dates selon les règles:
    // 1. dateOuverture < dateClotureCandidature
    // 2. dateClotureCandidature < dateScrutin
    // 3. dateCloture > dateScrutin
    if (!electionData.dateClotureCandidature) {
      return { success: false, error: "La date de clôture des candidatures est obligatoire" };
    }

    const dateOuverture = new Date(electionData.dateOuverture);
    const dateClotureCandidature = new Date(electionData.dateClotureCandidature);
    const dateScrutin = new Date(electionData.dateScrutin);
    const dateCloture = new Date(electionData.dateCloture);

    if (dateOuverture >= dateClotureCandidature) {
      return { success: false, error: "La date d'ouverture doit être antérieure à la date de clôture des candidatures" };
    }

    if (dateClotureCandidature >= dateScrutin) {
      return { success: false, error: "La date de clôture des candidatures doit être antérieure à la date du scrutin" };
    }

    if (dateCloture <= dateScrutin) {
      return { success: false, error: "La date de clôture doit être postérieure à la date du scrutin" };
    }

    // Créer l'élection avec ses postes en une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Préparer les données en excluant les champs undefined
      const electionCreateData: any = {
        titre: electionData.titre,
        dateOuverture: electionData.dateOuverture,
        dateCloture: electionData.dateCloture,
        dateClotureCandidature: electionData.dateClotureCandidature,
        dateScrutin: electionData.dateScrutin,
        createdBy: session.user.id!,
        status: ElectionStatus.Preparation
      };

      // Ajouter les champs optionnels seulement s'ils sont définis
      if (electionData.description !== undefined) electionCreateData.description = electionData.description;
      if (electionData.nombreMandats !== undefined) electionCreateData.nombreMandats = electionData.nombreMandats;
      if (electionData.quorumRequis !== undefined) electionCreateData.quorumRequis = electionData.quorumRequis;
      if (electionData.majoriteRequis !== undefined) electionCreateData.majoriteRequis = electionData.majoriteRequis;

      // Créer l'élection
      const election = await tx.election.create({
        data: electionCreateData
      });

      // Récupérer les postes depuis la base de données
      const postesTemplates = await prisma.posteTemplate.findMany({
        where: {
          id: { in: selectedPostes },
          actif: true
        }
      });

      // Si pas de postes trouvés, essayer avec PositionType (rétrocompatibilité)
      if (postesTemplates.length === 0) {
        // Traitement de rétrocompatibilité avec l'ancien système
        const positions = await Promise.all(
          selectedPostes.map(async (posteId) => {
            // Essayer de convertir en PositionType si c'est une valeur d'enum
            const posteType = posteId as PositionType;
            if (Object.values(PositionType).includes(posteType)) {
              // Trouver le template correspondant au type en utilisant le mapping
              // Essayer d'abord avec le nouveau code (6 caractères), puis l'ancien pour rétrocompatibilité
              const newCode = POSITION_TYPE_TO_CODE[posteType];
              const oldCode = posteType.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
              
              const template = await prisma.posteTemplate.findFirst({
                where: {
                  OR: [
                    { code: newCode },
                    { code: oldCode }
                  ]
                }
              });

              return await tx.position.create({
                data: {
                  electionId: election.id,
                  type: posteType,
                  titre: POSTES_LABELS[posteType] || posteType,
                  description: template?.description || `Poste de ${POSTES_LABELS[posteType]?.toLowerCase() || posteType.toLowerCase()}`,
                  nombreMandats: template?.nombreMandatsDefaut || 1,
                  dureeMandat: template?.dureeMandatDefaut || 24,
                  conditions: "Être membre actif de l'association",
                  posteTemplateId: template?.id || null
                }
              });
            } else {
              throw new Error(`Type de poste invalide: ${posteId}`);
            }
          })
        );
        return { election, positions };
      }

      // Créer les postes pour cette élection avec les templates
      const positions = await Promise.all(
        postesTemplates.map(async (template) => {
          // Mapper le code du template à un PositionType pour la rétrocompatibilité
          const codeToTypeMap: Record<string, PositionType> = {
            // Nouveaux codes (6 caractères)
            'PRESID': PositionType.President,
            'VICEPR': PositionType.VicePresident,
            'SECRET': PositionType.Secretaire,
            'VICESE': PositionType.ViceSecretaire,
            'TRESOR': PositionType.Tresorier,
            'VICETR': PositionType.ViceTresorier,
            'COMCPT': PositionType.CommissaireComptes,
            'MEMCDI': PositionType.MembreComiteDirecteur,
            // Anciens codes (pour rétrocompatibilité)
            'president': PositionType.President,
            'vice_president': PositionType.VicePresident,
            'secretaire': PositionType.Secretaire,
            'vice_secretaire': PositionType.ViceSecretaire,
            'tresorier': PositionType.Tresorier,
            'vice_tresorier': PositionType.ViceTresorier,
            'commissaire_comptes': PositionType.CommissaireComptes,
            'membre_comite_directeur': PositionType.MembreComiteDirecteur,
          };

          const positionType = codeToTypeMap[template.code.toUpperCase()] || codeToTypeMap[template.code] || PositionType.MembreComiteDirecteur;

          return await tx.position.create({
            data: {
              electionId: election.id,
              type: positionType,
              titre: template.libelle,
              description: template.description || `Poste de ${template.libelle.toLowerCase()}`,
              nombreMandats: template.nombreMandatsDefaut,
              dureeMandat: template.dureeMandatDefaut || 24,
              conditions: "Être membre actif de l'association",
              posteTemplateId: template.id
            }
          });
        })
      );

      return { election, positions };
    });

    return { success: true, election: result.election };

  } catch (error) {
    console.error("Erreur lors de la création de l'élection:", error);
    return { success: false, error: "Erreur lors de la création de l'élection" };
  }
}

// Server Action pour créer un poste personnalisé
export async function createCustomPosition(
  electionId: string,
  positionData: PositionData
): Promise<{ success: boolean; position?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des postes" };
    }

    // Vérifier que l'élection existe
    const election = await prisma.election.findUnique({
      where: { id: electionId }
    });

    if (!election) {
      return { success: false, error: "Élection introuvable" };
    }

    // Créer le poste personnalisé
    const position = await prisma.position.create({
      data: {
        electionId,
        ...positionData
      }
    });

    return { success: true, position };

  } catch (error) {
    console.error("Erreur lors de la création du poste:", error);
    return { success: false, error: "Erreur lors de la création du poste" };
  }
}

// Server Action pour ajouter des postes à une élection
export async function addPositionsToElection(
  electionId: string, 
  positions: PositionData[]
): Promise<{ success: boolean; positions?: any[]; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'élection existe
    const election = await prisma.election.findUnique({
      where: { id: electionId }
    });

    if (!election) {
      return { success: false, error: "Élection non trouvée" };
    }

    // Créer les postes
    const createdPositions = await Promise.all(
      positions.map(position => 
        prisma.position.create({
          data: {
            ...position,
            electionId,
            titre: position.titre || POSTES_LABELS[position.type]
          }
        })
      )
    );

    return { success: true, positions: createdPositions };

  } catch (error) {
    console.error("Erreur lors de l'ajout des postes:", error);
    return { success: false, error: "Erreur lors de l'ajout des postes" };
  }
}

// Server Action pour créer une candidature
export async function createCandidacy(candidacyData: CandidacyData): Promise<{ success: boolean; candidacy?: any; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est bien un adhérent
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        User: true,
        Adresse: true,
        Telephones: true
      }
    });

    if (!adherent) {
      return { 
        success: false, 
        error: "Vous devez être adhérent pour pouvoir postuler. Veuillez compléter votre profil adhérent depuis votre espace personnel." 
      };
    }

    // Vérifier que l'adhérent a complété ses informations (adresse ou téléphone)
    const hasAddress = adherent.Adresse && adherent.Adresse.length > 0 && 
      adherent.Adresse.some(addr => addr.street1 && addr.city && addr.codepost);
    const hasPhone = adherent.Telephones && adherent.Telephones.length > 0 &&
      adherent.Telephones.some(tel => tel.numero && tel.numero.trim() !== "");

    if (!hasAddress && !hasPhone) {
      return { 
        success: false, 
        error: "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir postuler à un poste." 
      };
    }

    // Vérifier que l'élection est ouverte aux candidatures
    const election = await prisma.election.findUnique({
      where: { id: candidacyData.electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte aux candidatures" };
    }

    // Vérifier que la date de clôture des candidatures n'est pas dépassée
    if (election.dateClotureCandidature && new Date() > new Date(election.dateClotureCandidature)) {
      return { success: false, error: "La période de candidature est fermée. La date limite était le " + new Date(election.dateClotureCandidature).toLocaleDateString('fr-FR') };
    }

    // Vérifier que l'adhérent n'a pas déjà postulé pour ce poste spécifique
    const existingCandidacy = await prisma.candidacy.findFirst({
      where: {
        adherentId: adherent.id,
        electionId: candidacyData.electionId,
        positionId: candidacyData.positionId
      }
    });

    if (existingCandidacy) {
      return { success: false, error: "Vous avez déjà postulé pour ce poste dans cette élection." };
    }

    // Vérifier que le poste existe et appartient à cette élection
    const position = await prisma.position.findFirst({
      where: {
        id: candidacyData.positionId,
        electionId: candidacyData.electionId
      }
    });

    if (!position) {
      return { success: false, error: "Le poste sélectionné n'existe pas pour cette élection" };
    }

    // Créer la candidature
    const candidacy = await prisma.candidacy.create({
      data: {
        ...candidacyData,
        adherentId: adherent.id,
        status: CandidacyStatus.EnAttente,
        documents: candidacyData.documents ? JSON.stringify(candidacyData.documents) : null
      },
      include: {
        position: true,
        adherent: {
          include: {
            User: true
          }
        }
      }
    });

    return { success: true, candidacy };

  } catch (error) {
    console.error("Erreur lors de la création de la candidature:", error);
    return { success: false, error: "Erreur lors de la création de la candidature" };
  }
}

// Server Action pour créer plusieurs candidatures
export async function createMultipleCandidacies(
  electionId: string,
  positionIds: string[],
  motivation: string,
  programme: string
): Promise<{ success: boolean; candidacies?: any[]; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est bien un adhérent
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        User: true
      }
    });

    if (!adherent) {
      return { 
        success: false, 
        error: "Vous devez être adhérent pour pouvoir postuler. Veuillez compléter votre profil adhérent depuis votre espace personnel." 
      };
    }

    // Vérifier que l'élection est ouverte aux candidatures
    const election = await prisma.election.findUnique({
      where: { id: electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte aux candidatures" };
    }

    // Vérifier que la date de clôture des candidatures n'est pas dépassée
    if (election.dateClotureCandidature && new Date() > new Date(election.dateClotureCandidature)) {
      return { success: false, error: "La période de candidature est fermée. La date limite était le " + new Date(election.dateClotureCandidature).toLocaleDateString('fr-FR') };
    }

    // Vérifier que tous les postes existent et appartiennent à cette élection
    const positions = await prisma.position.findMany({
      where: {
        id: { in: positionIds },
        electionId: electionId
      }
    });

    if (positions.length !== positionIds.length) {
      return { success: false, error: "Un ou plusieurs postes sélectionnés n'existent pas pour cette élection" };
    }

    // Vérifier qu'il n'y a pas de candidatures existantes pour ces postes
    const existingCandidacies = await prisma.candidacy.findMany({
      where: {
        adherentId: adherent.id,
        electionId: electionId,
        positionId: { in: positionIds }
      }
    });

    if (existingCandidacies.length > 0) {
      const existingPositions = existingCandidacies.map(c => c.positionId);
      return { 
        success: false, 
        error: `Vous avez déjà postulé pour certains postes. Veuillez retirer les postes déjà candidatés.` 
      };
    }

    // Créer toutes les candidatures en une transaction
    const candidacies = await prisma.$transaction(
      positionIds.map(positionId => 
        prisma.candidacy.create({
          data: {
            electionId,
            positionId,
            adherentId: adherent.id,
            motivation,
            programme,
            status: CandidacyStatus.EnAttente
          },
          include: {
            position: true,
            adherent: {
              include: {
                User: true
              }
            }
          }
        })
      )
    );

    return { success: true, candidacies };

  } catch (error) {
    console.error("Erreur lors de la création des candidatures:", error);
    return { success: false, error: "Erreur lors de la création des candidatures" };
  }
}

// Server Action pour récupérer les candidatures de l'utilisateur connecté
export async function getUserCandidacies(): Promise<{ success: boolean; candidacies?: any[]; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer toutes les candidatures de l'adhérent
    const candidacies = await prisma.candidacy.findMany({
      where: {
        adherentId: adherent.id
      },
      include: {
        position: {
          include: {
            election: {
              include: {
                positions: true
              }
            }
          }
        },
        adherent: {
          include: {
            User: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, candidacies };

  } catch (error) {
    console.error("Erreur lors de la récupération des candidatures:", error);
    return { success: false, error: "Erreur lors de la récupération des candidatures" };
  }
}

// Server Action pour mettre à jour une candidature
export async function updateCandidacy(
  candidacyId: string,
  motivation: string,
  programme: string,
  newPositionId?: string
): Promise<{ success: boolean; candidacy?: any; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer la candidature avec l'élection associée
    const candidacy = await prisma.candidacy.findFirst({
      where: {
        id: candidacyId,
        adherentId: adherent.id
      },
      include: {
        position: {
          include: {
            election: true
          }
        }
      }
    });

    if (!candidacy) {
      return { success: false, error: "Candidature non trouvée" };
    }

    // Vérifier que l'élection est encore ouverte
    if (candidacy.position.election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est plus ouverte aux modifications" };
    }

    // Si changement de poste, vérifier que le nouveau poste existe et appartient à la même élection
    if (newPositionId && newPositionId !== candidacy.positionId) {
      const newPosition = await prisma.position.findFirst({
        where: {
          id: newPositionId,
          electionId: candidacy.position.electionId
        }
      });

      if (!newPosition) {
        return { success: false, error: "Le nouveau poste sélectionné n'existe pas pour cette élection" };
      }

      // Vérifier qu'il n'y a pas déjà une candidature pour ce nouveau poste
      const existingCandidacyForNewPosition = await prisma.candidacy.findFirst({
        where: {
          adherentId: adherent.id,
          electionId: candidacy.position.electionId,
          positionId: newPositionId,
          id: { not: candidacyId } // Exclure la candidature actuelle
        }
      });

      if (existingCandidacyForNewPosition) {
        return { success: false, error: "Vous avez déjà une candidature pour ce poste dans cette élection" };
      }
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      motivation,
      programme
    };

    // Ajouter le changement de poste si spécifié
    if (newPositionId && newPositionId !== candidacy.positionId) {
      updateData.positionId = newPositionId;
    }

    // Mettre à jour la candidature
    const updatedCandidacy = await prisma.candidacy.update({
      where: {
        id: candidacyId
      },
      data: updateData,
      include: {
        position: {
          include: {
            election: true
          }
        },
        adherent: {
          include: {
            User: true
          }
        }
      }
    });

    return { success: true, candidacy: updatedCandidacy };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la candidature:", error);
    return { success: false, error: "Erreur lors de la mise à jour de la candidature" };
  }
}

// Server Action pour modifier les postes d'une candidature (ajout/suppression)
export async function updateCandidacyPositions(
  candidacyId: string,
  motivation: string,
  programme: string,
  selectedPositionIds: string[]
): Promise<{ success: boolean; candidacies?: any[]; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer la candidature existante avec l'élection associée
    const existingCandidacy = await prisma.candidacy.findFirst({
      where: {
        id: candidacyId,
        adherentId: adherent.id
      },
      include: {
        position: {
          include: {
            election: {
              include: {
                positions: true
              }
            }
          }
        }
      }
    });

    if (!existingCandidacy) {
      return { success: false, error: "Candidature non trouvée" };
    }

    // Vérifier que l'élection est encore ouverte
    if (existingCandidacy.position.election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est plus ouverte aux modifications" };
    }

    // Vérifier que tous les postes sélectionnés existent et appartiennent à cette élection
    const validPositions = await prisma.position.findMany({
      where: {
        id: { in: selectedPositionIds },
        electionId: existingCandidacy.position.electionId
      }
    });

    if (validPositions.length !== selectedPositionIds.length) {
      return { success: false, error: "Un ou plusieurs postes sélectionnés n'existent pas pour cette élection" };
    }

    // Récupérer toutes les candidatures existantes de l'adhérent pour cette élection
    const existingCandidacies = await prisma.candidacy.findMany({
      where: {
        adherentId: adherent.id,
        electionId: existingCandidacy.position.electionId
      }
    });

    // Identifier les postes à ajouter et à supprimer
    const currentPositionIds = existingCandidacies.map(c => c.positionId);
    const positionsToAdd = selectedPositionIds.filter(id => !currentPositionIds.includes(id));
    const positionsToRemove = currentPositionIds.filter(id => !selectedPositionIds.includes(id));

    // Vérifier qu'il n'y a pas de conflits pour les nouveaux postes
    for (const positionId of positionsToAdd) {
      const existingCandidacyForPosition = await prisma.candidacy.findFirst({
        where: {
          adherentId: adherent.id,
          electionId: existingCandidacy.position.electionId,
          positionId: positionId
        }
      });

      if (existingCandidacyForPosition) {
        return { success: false, error: `Vous avez déjà une candidature pour le poste ${validPositions.find(p => p.id === positionId)?.type || positionId}` };
      }
    }

    // Effectuer les modifications en transaction
    const results = await prisma.$transaction(async (tx) => {
      const updatedCandidacies = [];

      // Supprimer les candidatures pour les postes non sélectionnés
      if (positionsToRemove.length > 0) {
        await tx.candidacy.deleteMany({
          where: {
            adherentId: adherent.id,
            electionId: existingCandidacy.position.electionId,
            positionId: { in: positionsToRemove }
          }
        });
      }

      // Mettre à jour la candidature existante (motivation et programme)
      if (selectedPositionIds.includes(existingCandidacy.positionId)) {
        const updatedCandidacy = await tx.candidacy.update({
          where: { id: candidacyId },
          data: { motivation, programme },
          include: {
            position: {
              include: {
                election: true
              }
            },
            adherent: {
              include: {
                User: true
              }
            }
          }
        });
        updatedCandidacies.push(updatedCandidacy);
      }

      // Créer de nouvelles candidatures pour les nouveaux postes
      for (const positionId of positionsToAdd) {
        const newCandidacy = await tx.candidacy.create({
          data: {
            electionId: existingCandidacy.position.electionId,
            positionId: positionId,
            adherentId: adherent.id,
            motivation,
            programme,
            status: CandidacyStatus.EnAttente
          },
          include: {
            position: {
              include: {
                election: true
              }
            },
            adherent: {
              include: {
                User: true
              }
            }
          }
        });
        updatedCandidacies.push(newCandidacy);
      }

      return updatedCandidacies;
    });

    return { success: true, candidacies: results };

  } catch (error) {
    console.error("Erreur lors de la modification des postes de candidature:", error);
    return { success: false, error: "Erreur lors de la modification des postes de candidature" };
  }
}

// Server Action pour récupérer les élections
export async function getElections(): Promise<{ success: boolean; elections?: any[]; error?: string }> {
  try {
    const elections = await prisma.election.findMany({
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: true
                  }
                }
              }
            }
          }
        },
        candidacies: {
          include: {
            adherent: {
              include: {
                User: true
              }
            },
            position: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, elections };

  } catch (error) {
    console.error("Erreur lors de la récupération des élections:", error);
    return { success: false, error: "Erreur lors de la récupération des élections" };
  }
}

// Server Action pour récupérer tous les candidats avec leurs informations
export async function getAllCandidates(): Promise<{ success: boolean; candidates?: any[]; error?: string }> {
  try {
    const candidates = await prisma.candidacy.findMany({
      include: {
        adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            Telephones: true
          }
        },
        position: {
          include: {
            election: {
              select: {
                id: true,
                titre: true,
                status: true,
                dateOuverture: true,
                dateCloture: true
              }
            }
          }
        }
      },
      orderBy: [
        { position: { election: { dateOuverture: 'desc' } } },
        { adherent: { User: { name: 'asc' } } }
      ]
    });

    // Grouper les candidatures par adhérent et élection
    const candidatesByAdherentAndElection = candidates.reduce((acc: any, candidacy: any) => {
      const key = `${candidacy.adherent.id}-${candidacy.position.election.id}`;
      
      if (!acc[key]) {
        acc[key] = {
          adherent: candidacy.adherent,
          election: candidacy.position.election,
          positions: [],
          candidacies: []
        };
      }
      
      acc[key].positions.push(candidacy.position);
      acc[key].candidacies.push(candidacy);
      
      return acc;
    }, {});

    // Convertir en tableau et trier
    const candidatesList = Object.values(candidatesByAdherentAndElection).map((group: any) => ({
      ...group,
      // Prendre la motivation et le programme de la première candidature (elles sont identiques)
      motivation: group.candidacies[0].motivation,
      programme: group.candidacies[0].programme,
      status: group.candidacies[0].status,
      createdAt: group.candidacies[0].createdAt
    }));

    return { success: true, candidates: candidatesList };

  } catch (error) {
    console.error("Erreur lors de la récupération des candidats:", error);
    return { success: false, error: "Erreur lors de la récupération des candidats" };
  }
}

// Server Action pour récupérer toutes les candidatures pour l'admin
export async function getAllCandidaciesForAdmin(): Promise<{ success: boolean; candidacies?: any[]; error?: string }> {
  try {
    const candidacies = await prisma.candidacy.findMany({
      include: {
        adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            Telephones: true
          }
        },
        position: {
          include: {
            election: {
              select: {
                id: true,
                titre: true,
                status: true,
                dateOuverture: true,
                dateCloture: true
              }
            }
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' },
        { adherent: { User: { name: 'asc' } } }
      ]
    });

    return { success: true, candidacies };
  } catch (error) {
    console.error("Erreur lors de la récupération des candidatures:", error);
    return { success: false, error: "Erreur lors de la récupération des candidatures" };
  }
}

// Server Action pour valider/rejeter une candidature
export async function updateCandidacyStatus(
  candidacyId: string,
  status: CandidacyStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès refusé - Admin requis" };
    }

    // Récupérer la candidature avec les informations nécessaires pour l'email
    const candidacy = await prisma.candidacy.findUnique({
      where: { id: candidacyId },
      include: {
        adherent: {
          include: {
            User: {
              select: {
                email: true,
                name: true
              }
            }
          }
        },
        position: {
          include: {
            election: {
              select: {
                titre: true
              }
            }
          }
        }
      }
    });

    if (!candidacy) {
      return { success: false, error: "Candidature non trouvée" };
    }

    // Mettre à jour le statut
    await prisma.candidacy.update({
      where: { id: candidacyId },
      data: { status }
    });

    // Envoyer un email de notification
    try {
      const { sendCandidacyStatusEmail } = await import("@/lib/mail");
      const statusLabels = {
        [CandidacyStatus.Validee]: "Validée" as const,
        [CandidacyStatus.Rejetee]: "Rejetée" as const,
        [CandidacyStatus.EnAttente]: "En attente" as const,
      };
      const statusLabel = statusLabels[status] || "En attente";
      const candidatNom = `${candidacy.adherent.civility || ''} ${candidacy.adherent.firstname || ''} ${candidacy.adherent.lastname || ''}`.trim();
      
      if (candidacy.adherent.User?.email) {
        await sendCandidacyStatusEmail(
          candidacy.adherent.User.email,
          candidatNom,
          candidacy.position.election.titre,
          candidacy.position.titre,
          statusLabel
        );
      }
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      // Ne pas bloquer la mise à jour si l'email échoue
    }

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }
}

// Server Action pour clôturer une élection
export async function closeElection(electionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès refusé - Admin requis" };
    }

    await prisma.election.update({
      where: { id: electionId },
      data: { 
        status: ElectionStatus.Cloturee,
        dateCloture: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la clôture de l'élection:", error);
    return { success: false, error: "Erreur lors de la clôture de l'élection" };
  }
}

// Server Action pour récupérer toutes les élections pour l'admin
export async function getAllElectionsForAdmin(): Promise<{ success: boolean; elections?: any[]; error?: string }> {
  try {
    const elections = await prisma.election.findMany({
      orderBy: {
        dateScrutin: 'desc' // Trier par date de scrutin décroissante
      },
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            },
            votes: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      },
      orderBy: { dateOuverture: 'desc' }
    });

    return { success: true, elections };
  } catch (error) {
    console.error("Erreur lors de la récupération des élections:", error);
    return { success: false, error: "Erreur lors de la récupération des élections" };
  }
}

// Server Action pour récupérer les votes de l'utilisateur pour une élection
export async function getUserVotes(electionId: string): Promise<{ success: boolean; votes?: any[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    const votes = await prisma.vote.findMany({
      where: {
        electionId: electionId,
        adherentId: adherent.id
      },
      include: {
        position: {
          select: {
            id: true,
            type: true,
            titre: true
          }
        },
        candidacy: {
          include: {
            adherent: {
              include: {
                User: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return { success: true, votes };
  } catch (error) {
    console.error("Erreur lors de la récupération des votes:", error);
    return { success: false, error: "Erreur lors de la récupération des votes" };
  }
}

// Server Action pour récupérer une élection spécifique
export async function getElectionById(electionId: string): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: true
                  }
                }
              }
            }
          }
        },
        candidacies: {
          include: {
            adherent: {
              include: {
                User: true
              }
            },
            position: true
          }
        },
        votes: {
          include: {
            adherent: {
              include: {
                User: true
              }
            },
            candidacy: {
              include: {
                adherent: {
                  include: {
                    User: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!election) {
      return { success: false, error: "Élection non trouvée" };
    }

    return { success: true, election };

  } catch (error) {
    console.error("Erreur lors de la récupération de l'élection:", error);
    return { success: false, error: "Erreur lors de la récupération de l'élection" };
  }
}

/**
 * Récupère les candidats d'une élection organisés par poste
 * 
 * @param electionId - L'ID de l'élection
 * @returns Un objet avec success (boolean), candidatesByPosition (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getCandidatesByPositionForElection(electionId: string): Promise<{ success: boolean; candidatesByPosition?: any[]; election?: any; error?: string }> {
  try {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        positions: {
          include: {
            PosteTemplate: {
              select: {
                ordre: true
              }
            },
            candidacies: {
              where: {
                status: { in: ["Validee", "EnAttente"] } // Seulement les candidatures valides ou en attente
              },
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                      }
                    }
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            titre: 'asc'
          }
        }
      }
    });

    if (!election) {
      return { success: false, error: "Élection non trouvée" };
    }

    // Organiser les candidats par poste et trier par ordre du template
    const sortedPositions = [...election.positions].sort((a, b) => {
      const ordreA = a.PosteTemplate?.ordre ?? 999;
      const ordreB = b.PosteTemplate?.ordre ?? 999;
      if (ordreA !== ordreB) return ordreA - ordreB;
      return (a.titre || "").localeCompare(b.titre || "");
    });

    const candidatesByPosition = sortedPositions.map(position => ({
      position: {
        id: position.id,
        titre: position.titre,
        type: position.type
      },
      candidates: position.candidacies.map(candidacy => ({
        id: candidacy.id,
        adherent: {
          id: candidacy.adherent.id,
          firstname: candidacy.adherent.firstname,
          lastname: candidacy.adherent.lastname,
          civility: candidacy.adherent.civility,
          User: candidacy.adherent.User
        },
        status: candidacy.status,
        createdAt: candidacy.createdAt
      }))
    }));

    return {
      success: true,
      candidatesByPosition,
      election: {
        id: election.id,
        titre: election.titre,
        dateScrutin: election.dateScrutin,
        dateOuverture: election.dateOuverture,
        dateCloture: election.dateCloture,
        dateClotureCandidatures: election.dateClotureCandidatures
      }
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des candidats par poste:", error);
    return { success: false, error: "Erreur lors de la récupération des candidats" };
  }
}

// Server Action pour voter
export async function vote(
  electionId: string,
  positionId: string,
  candidacyId?: string
): Promise<{ success: boolean; vote?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        Adresse: true,
        Telephones: true
      }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé. Veuillez compléter vos informations d'adhérent dans votre profil." };
    }

    // Vérifier que l'adhérent a complété ses informations (adresse ou téléphone)
    const hasAddress = adherent.Adresse && adherent.Adresse.length > 0 && 
      adherent.Adresse.some(addr => addr.street1 && addr.city && addr.codepost);
    const hasPhone = adherent.Telephones && adherent.Telephones.length > 0 &&
      adherent.Telephones.some(tel => tel.numero && tel.numero.trim() !== "");

    if (!hasAddress && !hasPhone) {
      return { 
        success: false, 
        error: "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir voter." 
      };
    }

    // Vérifier que l'élection est ouverte au vote
    const election = await prisma.election.findUnique({
      where: { id: electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte au vote" };
    }

    // Vérifier que l'utilisateur n'a pas déjà voté pour ce poste
    const existingVote = await prisma.vote.findFirst({
      where: {
        electionId,
        positionId,
        adherentId: adherent.id
      }
    });

    if (existingVote) {
      return { success: false, error: "Vous avez déjà voté pour ce poste" };
    }

    // Créer le vote
    const vote = await prisma.vote.create({
      data: {
        electionId,
        positionId,
        adherentId: adherent.id,
        candidacyId: candidacyId || null,
        status: candidacyId ? "Valide" : "Blanc"
      },
      include: {
        candidacy: {
          include: {
            adherent: {
              include: {
                User: true
              }
            }
          }
        }
      }
    });

    return { success: true, vote };

  } catch (error) {
    console.error("Erreur lors du vote:", error);
    return { success: false, error: "Erreur lors du vote" };
  }
}

// Server Action pour valider une candidature (admin)
export async function validateCandidacy(
  candidacyId: string,
  status: CandidacyStatus,
  commentaires?: string
): Promise<{ success: boolean; candidacy?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent valider les candidatures" };
    }

    // Mettre à jour la candidature
    const candidacy = await prisma.candidacy.update({
      where: { id: candidacyId },
      data: {
        status,
        valideePar: session.user.id,
        dateValidation: new Date(),
        commentaires
      },
      include: {
        adherent: {
          include: {
            User: true
          }
        },
        position: true
      }
    });

    return { success: true, candidacy };

  } catch (error) {
    console.error("Erreur lors de la validation de la candidature:", error);
    return { success: false, error: "Erreur lors de la validation de la candidature" };
  }
}

// Server Action pour changer le statut d'une élection
export async function updateElectionStatus(
  electionId: string,
  status: ElectionStatus
): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier le statut des élections" };
    }

    // Mettre à jour l'élection
    const election = await prisma.election.update({
      where: { id: electionId },
      data: { status },
      include: {
        positions: true,
        candidacies: {
          include: {
            adherent: {
              include: {
                User: true
              }
            },
            position: true
          }
        }
      }
    });

    return { success: true, election };

  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }
}

// Server Action pour obtenir les résultats d'une élection
export async function getElectionResults(electionId: string): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                      }
                    }
                  }
                },
                votes: true
              }
            },
            votes: true
          }
        }
      }
    });

    if (!election) {
      return { success: false, error: "Élection non trouvée" };
    }

    // Calculer les résultats par poste
    const results = election.positions.map(position => {
      const candidacies = position.candidacies.map(candidacy => ({
        ...candidacy,
        votesCount: candidacy.votes.length,
        percentage: position.votes.length > 0 ? (candidacy.votes.length / position.votes.length) * 100 : 0
      }));

      // Trier par nombre de votes (décroissant)
      candidacies.sort((a, b) => b.votesCount - a.votesCount);

      return {
        position,
        candidacies,
        totalVotes: position.votes.length,
        blankVotes: position.votes.filter(vote => vote.status === "Blanc").length
      };
    });

    return { 
      success: true, 
      results: {
        election,
        positions: results
      }
    };

  } catch (error) {
    console.error("Erreur lors du calcul des résultats:", error);
    return { success: false, error: "Erreur lors du calcul des résultats" };
  }
}

// ========================= VOTES (ADMIN) =========================
export async function getAllVotesForAdmin(): Promise<{ success: boolean; votes?: any[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    const votes = await prisma.vote.findMany({
      include: {
        election: { select: { id: true, titre: true, status: true } },
        position: { select: { id: true, titre: true } },
        adherent: { include: { User: { select: { id: true, name: true, email: true } } } },
        candidacy: {
          include: {
            adherent: { include: { User: { select: { id: true, name: true, email: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, votes };
  } catch (e) {
    console.error("Erreur getAllVotesForAdmin:", e);
    return { success: false, error: "Erreur lors de la récupération des votes" };
  }
}

export async function adminCreateVote(data: { electionId: string; positionId: string; adherentId: string; candidacyId?: string | null; status?: "Valide" | "Blanc" | "Annule" }): Promise<{ success: boolean; vote?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    // Vérifications de cohérence
    const election = await prisma.election.findUnique({ where: { id: data.electionId } });
    if (!election) return { success: false, error: "Élection introuvable" };

    const position = await prisma.position.findFirst({ where: { id: data.positionId, electionId: data.electionId } });
    if (!position) return { success: false, error: "Poste introuvable pour cette élection" };

    const adherent = await prisma.adherent.findUnique({ where: { id: data.adherentId } });
    if (!adherent) return { success: false, error: "Adhérent introuvable" };

    if (data.candidacyId) {
      const candOk = await prisma.candidacy.findFirst({ where: { id: data.candidacyId, electionId: data.electionId, positionId: data.positionId } });
      if (!candOk) return { success: false, error: "Candidature invalide pour ce poste/élection" };
    }

    // Unicité (un vote par adhérent/poste/élection)
    const exists = await prisma.vote.findFirst({ where: { electionId: data.electionId, positionId: data.positionId, adherentId: data.adherentId } });
    if (exists) return { success: false, error: "Un vote existe déjà pour cet adhérent sur ce poste" };

    const vote = await prisma.vote.create({
      data: {
        electionId: data.electionId,
        positionId: data.positionId,
        adherentId: data.adherentId,
        candidacyId: data.candidacyId || null,
        status: (data.status as any) || (data.candidacyId ? "Valide" : "Blanc")
      },
      include: {
        election: { select: { id: true, titre: true, status: true } },
        position: { select: { id: true, titre: true } },
        adherent: { include: { User: { select: { id: true, name: true, email: true } } } },
        candidacy: { include: { adherent: { include: { User: true } } } }
      }
    });

    return { success: true, vote };
  } catch (e) {
    console.error("Erreur adminCreateVote:", e);
    return { success: false, error: "Erreur lors de la création du vote" };
  }
}

export async function adminUpdateVote(voteId: string, data: { candidacyId?: string | null; status?: "Valide" | "Blanc" | "Annule" }): Promise<{ success: boolean; vote?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    const current = await prisma.vote.findUnique({ where: { id: voteId } });
    if (!current) return { success: false, error: "Vote introuvable" };

    if (typeof data.candidacyId !== 'undefined' && data.candidacyId) {
      const candOk = await prisma.candidacy.findFirst({ where: { id: data.candidacyId, electionId: current.electionId, positionId: current.positionId } });
      if (!candOk) return { success: false, error: "Candidature invalide pour ce poste/élection" };
    }

    const updated = await prisma.vote.update({
      where: { id: voteId },
      data: {
        candidacyId: typeof data.candidacyId === 'undefined' ? undefined : (data.candidacyId || null),
        status: data.status as any || undefined,
      },
      include: {
        election: { select: { id: true, titre: true, status: true } },
        position: { select: { id: true, titre: true } },
        adherent: { include: { User: { select: { id: true, name: true, email: true } } } },
        candidacy: { include: { adherent: { include: { User: true } } } }
      }
    });

    return { success: true, vote: updated };
  } catch (e) {
    console.error("Erreur adminUpdateVote:", e);
    return { success: false, error: "Erreur lors de la mise à jour du vote" };
  }
}

export async function adminDeleteVote(voteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    await prisma.vote.delete({ where: { id: voteId } });
    return { success: true };
  } catch (e) {
    console.error("Erreur adminDeleteVote:", e);
    return { success: false, error: "Erreur lors de la suppression du vote" };
  }
}

export async function adminUpdateVoteStatus(voteId: string, status: "Valide" | "Blanc" | "Annule"): Promise<{ success: boolean; vote?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    const updated = await prisma.vote.update({
      where: { id: voteId },
      data: { status: status as any },
      include: {
        election: { select: { id: true, titre: true, status: true } },
        position: { select: { id: true, titre: true } },
        adherent: { include: { User: { select: { id: true, name: true, email: true } } } },
        candidacy: { include: { adherent: { include: { User: true } } } }
      }
    });
    return { success: true, vote: updated };
  } catch (e) {
    console.error("Erreur adminUpdateVoteStatus:", e);
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }
}

// Light candidatures par poste (pour sélectionner un candidat lors d’un vote)
export async function getCandidaciesForPositionLight(positionId: string): Promise<{ success: boolean; candidacies?: Array<{ id: string; label: string }>; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const candidacies = await prisma.candidacy.findMany({
      where: { positionId },
      select: {
        id: true,
        adherent: { select: { id: true, User: { select: { name: true, email: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, candidacies: candidacies.map(c => ({ id: c.id, label: `${c.adherent.User?.name || ''} • ${c.adherent.User?.email || ''}`.trim() })) };
  } catch (e) {
    console.error("Erreur getCandidaciesForPositionLight:", e);
    return { success: false, error: "Erreur lors de la récupération des candidatures" };
  }
}

// Server Action pour récupérer l'historique des votes de l'utilisateur
export async function getUserVoteHistory(): Promise<{ success: boolean; elections?: any[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer toutes les élections avec les votes de l'utilisateur
    const elections = await prisma.election.findMany({
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: true
                  }
                }
              }
            },
            votes: {
              where: {
                adherentId: adherent.id
              },
              include: {
                candidacy: {
                  include: {
                    adherent: {
                      include: {
                        User: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      },
      orderBy: {
        dateOuverture: 'desc'
      }
    });

    return { success: true, elections };

  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique des votes:", error);
    return { success: false, error: "Erreur lors de la récupération de l'historique des votes" };
  }
}

// Server Action pour récupérer une candidature par ID (pour admin)
export async function getCandidacyById(candidacyId: string) {
  try {
    const candidacy = await prisma.candidacy.findUnique({
      where: { id: candidacyId },
      include: {
        adherent: {
          include: {
            User: true,
            Adresse: true
          }
        },
        position: {
          include: {
            election: true
          }
        }
      }
    });

    if (!candidacy) {
      return { success: false, error: "Candidature non trouvée" };
    }

    return { success: true, data: candidacy };

  } catch (error) {
    console.error("Erreur lors de la récupération de la candidature:", error);
    return { success: false, error: "Erreur lors de la récupération de la candidature" };
  }
}

export async function updateElection(
  electionId: string,
  data: Partial<ElectionData>
): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier une élection" };
    }

    // Récupérer l'élection actuelle pour valider avec les nouvelles dates
    const currentElection = await prisma.election.findUnique({
      where: { id: electionId }
    });

    if (!currentElection) {
      return { success: false, error: "Élection introuvable" };
    }

    // Préparer les dates pour la validation
    const dateOuverture = data.dateOuverture ? new Date(data.dateOuverture) : new Date(currentElection.dateOuverture);
    // Si dateClotureCandidature est null dans la base (cas de migration), calculer à partir de dateScrutin
    const currentDateClotureCandidature = currentElection.dateClotureCandidature 
      ? new Date(currentElection.dateClotureCandidature)
      : (() => {
          const calculated = new Date(currentElection.dateScrutin);
          calculated.setDate(calculated.getDate() - 10);
          return calculated;
        })();
    const dateClotureCandidature = data.dateClotureCandidature ? new Date(data.dateClotureCandidature) : currentDateClotureCandidature;
    const dateScrutin = data.dateScrutin ? new Date(data.dateScrutin) : new Date(currentElection.dateScrutin);
    const dateCloture = data.dateCloture ? new Date(data.dateCloture) : new Date(currentElection.dateCloture);

    // Validation des dates selon les règles:
    // 1. dateOuverture < dateClotureCandidature
    // 2. dateClotureCandidature < dateScrutin
    // 3. dateCloture > dateScrutin
    if (dateOuverture >= dateClotureCandidature) {
      return { success: false, error: "La date d'ouverture doit être antérieure à la date de clôture des candidatures" };
    }

    if (dateClotureCandidature >= dateScrutin) {
      return { success: false, error: "La date de clôture des candidatures doit être antérieure à la date du scrutin" };
    }

    if (dateCloture <= dateScrutin) {
      return { success: false, error: "La date de clôture doit être postérieure à la date du scrutin" };
    }

    const allowedData: any = {};
    if (typeof data.titre !== "undefined") allowedData.titre = data.titre;
    if (typeof data.description !== "undefined") allowedData.description = data.description;
    if (typeof data.dateOuverture !== "undefined") allowedData.dateOuverture = data.dateOuverture;
    if (typeof data.dateCloture !== "undefined") allowedData.dateCloture = data.dateCloture;
    if (typeof data.dateClotureCandidature !== "undefined") allowedData.dateClotureCandidature = data.dateClotureCandidature;
    if (typeof data.dateScrutin !== "undefined") allowedData.dateScrutin = data.dateScrutin;
    if (typeof data.nombreMandats !== "undefined") allowedData.nombreMandats = data.nombreMandats;
    if (typeof data.quorumRequis !== "undefined") allowedData.quorumRequis = data.quorumRequis;
    if (typeof data.majoriteRequis !== "undefined") allowedData.majoriteRequis = data.majoriteRequis;

    const election = await prisma.election.update({
      where: { id: electionId },
      data: allowedData,
    });

    return { success: true, election };
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'élection:", error);
    return { success: false, error: "Erreur lors de la mise à jour de l'élection" };
  }
}

export async function updatePosition(
  positionId: string,
  data: { titre?: string; description?: string; nombreMandats?: number; dureeMandat?: number; conditions?: string }
): Promise<{ success: boolean; position?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Seuls les administrateurs peuvent modifier un poste" };

    const position = await prisma.position.update({
      where: { id: positionId },
      data,
    });
    return { success: true, position };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du poste:", error);
    return { success: false, error: "Erreur lors de la mise à jour du poste" };
  }
}

export async function deletePosition(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Seuls les administrateurs peuvent supprimer un poste" };

    await prisma.position.delete({ where: { id: positionId } });
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression du poste:", error);
    return { success: false, error: "Erreur lors de la suppression du poste" };
  }
}

export async function getElectionsLightForAdmin(): Promise<{ success: boolean; elections?: any[]; error?: string }> {
  try {
    const elections = await prisma.election.findMany({
      select: {
        id: true,
        titre: true,
        description: true,
        status: true,
        dateOuverture: true,
        dateCloture: true,
        dateScrutin: true,
        nombreMandats: true,
        quorumRequis: true,
        majoriteRequis: true,
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { dateOuverture: 'desc' },
    });

    return { success: true, elections };
  } catch (error) {
    console.error("Erreur (light) lors de la récupération des élections:", error);
    return { success: false, error: "Erreur lors de la récupération des élections" };
  }
}

export async function adminCreateCandidacy(data: { electionId: string; positionId: string; adherentId: string; motivation?: string; programme?: string; status?: CandidacyStatus }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    // Vérifications de base
    const election = await prisma.election.findUnique({ where: { id: data.electionId } });
    if (!election) return { success: false, error: "Élection introuvable" };

    const position = await prisma.position.findFirst({ where: { id: data.positionId, electionId: data.electionId } });
    if (!position) return { success: false, error: "Poste introuvable pour cette élection" };

    const adherent = await prisma.adherent.findUnique({ where: { id: data.adherentId } });
    if (!adherent) return { success: false, error: "Adhérent introuvable" };

    // Unicité par adhérent/élection/poste
    const exists = await prisma.candidacy.findFirst({ where: { adherentId: data.adherentId, electionId: data.electionId, positionId: data.positionId } });
    if (exists) return { success: false, error: "Candidature déjà existante pour cet adhérent et ce poste" };

    const candidacy = await prisma.candidacy.create({
      data: {
        electionId: data.electionId,
        positionId: data.positionId,
        adherentId: data.adherentId,
        motivation: data.motivation || "",
        programme: data.programme || "",
        status: data.status || CandidacyStatus.EnAttente,
      },
      include: {
        position: { include: { election: true } },
        adherent: { include: { User: true } },
      },
    });

    return { success: true, candidacy };
  } catch (e) {
    console.error("Erreur adminCreateCandidacy:", e);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function adminUpdateCandidacy(candidacyId: string, data: { motivation?: string; programme?: string; status?: CandidacyStatus; positionId?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    // Récupérer la candidature actuelle avec toutes les infos nécessaires
    const current = await prisma.candidacy.findUnique({ 
      where: { id: candidacyId }, 
      include: { 
        position: { include: { election: { select: { titre: true, id: true } } } },
        adherent: { 
          select: {
            id: true,
            civility: true,
            firstname: true,
            lastname: true,
            User: { select: { email: true, name: true } }
          }
        }
      } 
    });
    if (!current) return { success: false, error: "Candidature introuvable" };

    // Vérifier si le statut change
    const statusChanged = data.status !== undefined && data.status !== current.status;

    // Si changement de poste, vérifier cohérence d'élection et unicité
    if (data.positionId && data.positionId !== current.positionId) {
      const electionId = current.position.election.id;
      const newPos = await prisma.position.findFirst({ where: { id: data.positionId, electionId } });
      if (!newPos) return { success: false, error: "Nouveau poste invalide pour cette élection" };
      const dup = await prisma.candidacy.findFirst({ where: { adherentId: current.adherent.id, electionId, positionId: data.positionId } });
      if (dup) return { success: false, error: "Une candidature existe déjà pour ce poste" };
    }

    // Récupérer le nouveau poste si changement
    let positionTitre = current.position.titre;
    if (data.positionId && data.positionId !== current.positionId) {
      const newPos = await prisma.position.findUnique({ 
        where: { id: data.positionId },
        select: { titre: true }
      });
      if (newPos) positionTitre = newPos.titre;
    }

    const updated = await prisma.candidacy.update({
      where: { id: candidacyId },
      data: {
        motivation: data.motivation,
        programme: data.programme,
        status: data.status,
        positionId: data.positionId || undefined,
      },
      include: {
        position: { include: { election: true } },
        adherent: { include: { User: true } },
      },
    });

    // Envoyer un email si le statut a changé
    if (statusChanged && data.status) {
      try {
        const { sendCandidacyStatusEmail } = await import("@/lib/mail");
        const statusLabels = {
          [CandidacyStatus.Validee]: "Validée" as const,
          [CandidacyStatus.Rejetee]: "Rejetée" as const,
          [CandidacyStatus.EnAttente]: "En attente" as const,
        };
        const statusLabel = statusLabels[data.status] || "En attente";
        const candidatNom = `${current.adherent.civility || ''} ${current.adherent.firstname || ''} ${current.adherent.lastname || ''}`.trim();
        
        if (current.adherent.User?.email) {
          await sendCandidacyStatusEmail(
            current.adherent.User.email,
            candidatNom,
            current.position.election.titre,
            positionTitre,
            statusLabel
          );
        }
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas bloquer la mise à jour si l'email échoue
      }
    }

    return { success: true, candidacy: updated };
  } catch (e) {
    console.error("Erreur adminUpdateCandidacy:", e);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function adminDeleteCandidacy(candidacyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    await prisma.candidacy.delete({ where: { id: candidacyId } });
    return { success: true };
  } catch (e) {
    console.error("Erreur adminDeleteCandidacy:", e);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function getPositionsForElectionLight(electionId: string): Promise<{ success: boolean; positions?: Array<{ id: string; titre: string; type: string }>; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const positions = await prisma.position.findMany({
      where: { electionId },
      select: { id: true, titre: true, type: true },
      orderBy: { titre: 'asc' }
    });
    return { success: true, positions };
  } catch (e) {
    console.error("Erreur getPositionsForElectionLight:", e);
    return { success: false, error: "Erreur lors de la récupération des postes" };
  }
}

export async function adminDeleteElection(electionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    await prisma.election.delete({ where: { id: electionId } });
    return { success: true };
  } catch (e) {
    console.error("Erreur adminDeleteElection:", e);
    return { success: false, error: "Erreur lors de la suppression de l'élection" };
  }
}

export async function getElectionWithDetails(electionId: string): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") return { success: false, error: "Admin requis" };

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        positions: {
          include: {
            candidacies: {
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          },
          orderBy: { titre: 'asc' }
        },
        _count: {
          select: {
            votes: true,
            positions: true,
            candidacies: true
          }
        }
      }
    });

    return { success: true, election };
  } catch (e) {
    console.error("Erreur getElectionWithDetails:", e);
    return { success: false, error: "Erreur lors de la récupération de l'élection" };
  }
}

/**
 * Récupère les candidats de l'élection du 29/11/2025 organisés par poste
 * 
 * @returns Un objet avec success (boolean), candidatesByPosition (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getCandidatesForElection2025(): Promise<{ 
  success: boolean; 
  candidatesByPosition?: Array<{
    position: PositionType;
    candidates: Array<{
      civility: string | null;
      firstname: string | null;
      lastname: string | null;
    }>;
  }>;
  election?: any;
  error?: string;
}> {
  try {
    // Trouver l'élection du 29/11/2025
    const electionDate = new Date("2025-11-29T00:00:00.000Z");
    const election = await prisma.election.findFirst({
      where: {
        dateScrutin: {
          gte: new Date("2025-11-29T00:00:00.000Z"),
          lt: new Date("2025-11-30T00:00:00.000Z")
        }
      },
      include: {
        positions: {
          include: {
            candidacies: {
              where: {
                status: { in: ["Validee", "EnAttente"] }
              },
              include: {
                adherent: {
                  select: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    civility: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            titre: 'asc'
          }
        }
      }
    });

    if (!election) {
      return { 
        success: false, 
        error: "Élection du 29/11/2025 non trouvée" 
      };
    }

    // Organiser les candidats par PositionType
    const candidatesByPosition: Array<{
      position: PositionType;
      candidates: Array<{
        civility: string | null;
        firstname: string | null;
        lastname: string | null;
      }>;
    }> = [];

    // Tous les PositionType possibles
    const allPositionTypes = [
      PositionType.President,
      PositionType.VicePresident,
      PositionType.Secretaire,
      PositionType.ViceSecretaire,
      PositionType.Tresorier,
      PositionType.ViceTresorier,
      PositionType.CommissaireComptes,
      PositionType.MembreComiteDirecteur
    ];

    for (const positionType of allPositionTypes) {
      const position = election.positions.find(p => p.type === positionType);
      
      candidatesByPosition.push({
        position: positionType,
        candidates: position?.candidacies.map(c => ({
          civility: c.adherent.civility,
          firstname: c.adherent.firstname,
          lastname: c.adherent.lastname
        })) || []
      });
    }

    return {
      success: true,
      candidatesByPosition,
      election: {
        id: election.id,
        titre: election.titre,
        dateScrutin: election.dateScrutin,
        dateClotureCandidature: election.dateClotureCandidature
      }
    };
  } catch (error: any) {
    console.error("Erreur lors de la récupération des candidats:", error);
    return { 
      success: false, 
      error: error.message || "Erreur lors de la récupération des candidats" 
    };
  }
}

/**
 * Importe les candidats statiques de la page /candidats dans la base de données
 * pour l'élection du 29/11/2025
 * 
 * ⚠️ IMPORTANT : Cette fonction N'ENVOIE AUCUN EMAIL aux candidats lors de l'import.
 * Les candidatures sont créées avec le statut "EnAttente" sans notification par email.
 * 
 * @returns Un objet avec success (boolean), message (string) en cas de succès,
 *          ou error (string) en cas d'échec, et details (array) avec les résultats
 */
export async function importStaticCandidates(): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
  details?: Array<{ candidate: string; position: string; status: 'created' | 'exists' | 'not_found' | 'error'; error?: string }>;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent importer les candidats" };
    }

    // Données statiques des candidats avec informations complémentaires depuis ancien_adherents.md
    const STATIC_CANDIDATES = [
      {
        position: PositionType.President,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Simon", 
            lastname: "BAVUEZA TONGI",
            email: "f3sbtevry@gmail.com",
            phone: "+33661197784"
          }
        ]
      },
      {
        position: PositionType.VicePresident,
        candidates: [
          { 
            civility: "Madame", 
            firstname: "Thaty", 
            lastname: "BISUBULA",
            email: "bisubula.sidonie@gmail.com",
            phone: "+33628730747",
            alternateFirstname: "Sidonie" // Le prénom dans la base est "Sidonie" selon ancien_adherents.md
          },
          { 
            civility: "Monsieur", 
            firstname: "Simon", 
            lastname: "BAVUEZA TONGI",
            email: "f3sbtevry@gmail.com",
            phone: "+33661197784"
          }
        ]
      },
      {
        position: PositionType.Secretaire,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Hubert", 
            lastname: "ITOMBA",
            email: "hubert.itomba@orange.fr",
            phone: "+33607034364"
          }
        ]
      },
      {
        position: PositionType.ViceSecretaire,
        candidates: [] // Aucun candidat
      },
      {
        position: PositionType.Tresorier,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Jimmy", 
            lastname: "DIMONEKENE",
            email: "dimonekene2017@hotmail.com",
            phone: "+33783919977"
          },
          { 
            civility: "Monsieur", 
            firstname: "Saintho", 
            lastname: "MANKENDA",
            email: "sainthoservices@outlook.fr",
            phone: "+33769504591",
            alternateFirstname: "Thomas" // Le prénom dans la base peut être "Thomas"
          }
        ]
      },
      {
        position: PositionType.ViceTresorier,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Saintho", 
            lastname: "MANKENDA",
            email: "sainthoservices@outlook.fr",
            phone: "+33769504591",
            alternateFirstname: "Thomas"
          },
          { 
            civility: "Monsieur", 
            firstname: "Dominique", 
            lastname: "BENGA",
            email: "gabrielbenga@yahoo.com",
            phone: "+33663160865"
          }
        ]
      },
      {
        position: PositionType.CommissaireComptes,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Hubert", 
            lastname: "ITOMBA",
            email: "hubert.itomba@orange.fr",
            phone: "+33607034364"
          },
          { 
            civility: "Monsieur", 
            firstname: "Saintho", 
            lastname: "MANKENDA",
            email: "sainthoservices@outlook.fr",
            phone: "+33769504591",
            alternateFirstname: "Thomas"
          }
        ]
      },
      {
        position: PositionType.MembreComiteDirecteur,
        candidates: [
          { 
            civility: "Monsieur", 
            firstname: "Hubert", 
            lastname: "ITOMBA",
            email: "hubert.itomba@orange.fr",
            phone: "+33607034364"
          },
          { 
            civility: "Monsieur", 
            firstname: "Simon", 
            lastname: "BAVUEZA TONGI",
            email: "f3sbtevry@gmail.com",
            phone: "+33661197784"
          },
          { 
            civility: "Madame", 
            firstname: "Marie", 
            lastname: "MUILU",
            email: "mariemuilu243@gmail.com",
            phone: "+33634310747"
          },
          { 
            civility: "Monsieur", 
            firstname: "Jimmy", 
            lastname: "DIMONEKENE",
            email: "dimonekene2017@hotmail.com",
            phone: "+33783919977"
          }
        ]
      }
    ];

    // Trouver l'élection du 29/11/2025
    const electionDate = new Date("2025-11-29T00:00:00.000Z");
    const election = await prisma.election.findFirst({
      where: {
        dateScrutin: {
          gte: new Date("2025-11-29T00:00:00.000Z"),
          lt: new Date("2025-11-30T00:00:00.000Z")
        }
      },
      include: {
        positions: true
      }
    });

    if (!election) {
      return { 
        success: false, 
        error: "Élection du 29/11/2025 non trouvée. Veuillez d'abord créer l'élection." 
      };
    }

    const details: Array<{ candidate: string; position: string; status: 'created' | 'exists' | 'not_found' | 'error'; error?: string }> = [];
    let createdCount = 0;
    let existsCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    // Traiter chaque groupe de candidats
    for (const group of STATIC_CANDIDATES) {
      // Trouver la position correspondante dans l'élection
      const position = election.positions.find(p => p.type === group.position);
      
      if (!position) {
        console.warn(`Position ${group.position} non trouvée dans l'élection ${election.id}`);
        continue;
      }

      // Traiter chaque candidat
      for (const candidate of group.candidates) {
        const candidateName = `${candidate.firstname} ${candidate.lastname}`;
        const positionLabel = POSTES_LABELS[group.position] || group.position;

        try {
          // Rechercher l'adhérent avec plusieurs critères (nom, email, téléphone)
          let adherent = null;
          
          // 1. Recherche par email si disponible
          if (candidate.email) {
            const userByEmail = await prisma.user.findFirst({
              where: {
                email: { equals: candidate.email, mode: 'insensitive' }
              },
              include: {
                adherent: true
              }
            });
            if (userByEmail?.adherent) {
              adherent = userByEmail.adherent;
              // Ajouter la référence User à l'adhérent pour compatibilité
              (adherent as any).User = userByEmail;
            }
          }
          
          // 2. Si pas trouvé par email, recherche par nom et prénom
          if (!adherent) {
            const searchConditions: any[] = [
              { lastname: { equals: candidate.lastname, mode: 'insensitive' } }
            ];
            
            // Chercher avec le prénom principal ou alternatif
            const firstnamesToSearch = [candidate.firstname];
            if ((candidate as any).alternateFirstname) {
              firstnamesToSearch.push((candidate as any).alternateFirstname);
            }
            
            searchConditions.push({
              OR: firstnamesToSearch.map(fn => ({
                firstname: { equals: fn, mode: 'insensitive' }
              }))
            });
            
            const foundAdherent = await prisma.adherent.findFirst({
              where: {
                AND: searchConditions
              },
              include: {
                User: true
              }
            });
            
            if (foundAdherent) {
              adherent = foundAdherent;
            }
          }
          
          // 3. Si pas trouvé, recherche par téléphone si disponible
          if (!adherent && candidate.phone) {
            const phoneNumber = candidate.phone.replace(/\s+/g, ''); // Enlever les espaces
            const adherentByPhone = await prisma.adherent.findFirst({
              where: {
                Telephones: {
                  some: {
                    numero: {
                      contains: phoneNumber,
                      mode: 'insensitive'
                    }
                  }
                }
              },
              include: {
                User: true,
                Telephones: true
              }
            });
            
            if (adherentByPhone) {
              adherent = adherentByPhone;
            }
          }

          if (!adherent) {
            details.push({
              candidate: candidateName,
              position: positionLabel,
              status: 'not_found',
              error: `Adhérent non trouvé: ${candidateName}`
            });
            notFoundCount++;
            continue;
          }

          // Vérifier si la candidature existe déjà
          const existingCandidacy = await prisma.candidacy.findFirst({
            where: {
              electionId: election.id,
              positionId: position.id,
              adherentId: adherent.id
            }
          });

          if (existingCandidacy) {
            details.push({
              candidate: candidateName,
              position: positionLabel,
              status: 'exists',
              error: 'Candidature déjà existante'
            });
            existsCount++;
            continue;
          }

          // Créer la candidature
          // ⚠️ IMPORTANT : Aucun email n'est envoyé lors de la création de la candidature
          await prisma.candidacy.create({
            data: {
              electionId: election.id,
              positionId: position.id,
              adherentId: adherent.id,
              status: CandidacyStatus.EnAttente,
              motivation: "",
              programme: ""
            }
          });

          details.push({
            candidate: candidateName,
            position: positionLabel,
            status: 'created'
          });
          createdCount++;

        } catch (error: any) {
          console.error(`Erreur lors de la création de la candidature pour ${candidateName}:`, error);
          details.push({
            candidate: candidateName,
            position: positionLabel,
            status: 'error',
            error: error.message || "Erreur inconnue"
          });
          errorCount++;
        }
      }
    }

    const message = `Import terminé: ${createdCount} créée(s), ${existsCount} existante(s), ${notFoundCount} non trouvé(s), ${errorCount} erreur(s)`;

    return {
      success: true,
      message,
      details
    };

  } catch (error: any) {
    console.error("Erreur lors de l'import des candidats statiques:", error);
    return { 
      success: false, 
      error: error.message || "Erreur lors de l'import des candidats statiques" 
    };
  }
}
