"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ElectionStatus, PositionType, CandidacyStatus } from "@prisma/client";

// Types pour les données
interface ElectionData {
  titre: string;
  description?: string;
  dateOuverture: Date;
  dateCloture: Date;
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

import { POSTES_LABELS, getPosteLabel } from "@/lib/elections-constants";

// Server Action pour créer une élection avec ses postes
export async function createElection(
  electionData: ElectionData, 
  selectedPostes: PositionType[]
): Promise<{ success: boolean; election?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des élections" };
    }

    // Validation des postes sélectionnés
    if (!selectedPostes || selectedPostes.length === 0) {
      return { success: false, error: "Veuillez sélectionner au moins un poste" };
    }

    // Créer l'élection avec ses postes en une transaction
    const result = await db.$transaction(async (tx) => {
      // Créer l'élection
      const election = await tx.election.create({
        data: {
          ...electionData,
          createdBy: session.user.id!,
          status: ElectionStatus.Preparation
        }
      });

      // Créer les postes pour cette élection
      const positions = await Promise.all(
        selectedPostes.map(async (posteType) => {
          return await tx.position.create({
            data: {
              electionId: election.id,
              type: posteType,
              titre: POSTES_LABELS[posteType],
              description: `Poste de ${POSTES_LABELS[posteType].toLowerCase()}`,
              nombreMandats: 1, // Par défaut 1 mandat
              dureeMandat: 2, // Par défaut 2 ans
              conditions: "Être membre actif de l'association"
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
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des postes" };
    }

    // Vérifier que l'élection existe
    const election = await db.election.findUnique({
      where: { id: electionId }
    });

    if (!election) {
      return { success: false, error: "Élection introuvable" };
    }

    // Créer le poste personnalisé
    const position = await db.position.create({
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
    const election = await db.election.findUnique({
      where: { id: electionId }
    });

    if (!election) {
      return { success: false, error: "Élection non trouvée" };
    }

    // Créer les postes
    const createdPositions = await Promise.all(
      positions.map(position => 
        db.position.create({
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
    const adherent = await db.adherent.findUnique({
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
    const election = await db.election.findUnique({
      where: { id: candidacyData.electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte aux candidatures" };
    }

    // Vérifier que l'adhérent n'a pas déjà postulé pour ce poste spécifique
    const existingCandidacy = await db.candidacy.findFirst({
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
    const position = await db.position.findFirst({
      where: {
        id: candidacyData.positionId,
        electionId: candidacyData.electionId
      }
    });

    if (!position) {
      return { success: false, error: "Le poste sélectionné n'existe pas pour cette élection" };
    }

    // Créer la candidature
    const candidacy = await db.candidacy.create({
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
    const adherent = await db.adherent.findUnique({
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
    const election = await db.election.findUnique({
      where: { id: electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte aux candidatures" };
    }

    // Vérifier que tous les postes existent et appartiennent à cette élection
    const positions = await db.position.findMany({
      where: {
        id: { in: positionIds },
        electionId: electionId
      }
    });

    if (positions.length !== positionIds.length) {
      return { success: false, error: "Un ou plusieurs postes sélectionnés n'existent pas pour cette élection" };
    }

    // Vérifier qu'il n'y a pas de candidatures existantes pour ces postes
    const existingCandidacies = await db.candidacy.findMany({
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
    const candidacies = await db.$transaction(
      positionIds.map(positionId => 
        db.candidacy.create({
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
    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer toutes les candidatures de l'adhérent
    const candidacies = await db.candidacy.findMany({
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
    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer la candidature avec l'élection associée
    const candidacy = await db.candidacy.findFirst({
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
      const newPosition = await db.position.findFirst({
        where: {
          id: newPositionId,
          electionId: candidacy.position.electionId
        }
      });

      if (!newPosition) {
        return { success: false, error: "Le nouveau poste sélectionné n'existe pas pour cette élection" };
      }

      // Vérifier qu'il n'y a pas déjà une candidature pour ce nouveau poste
      const existingCandidacyForNewPosition = await db.candidacy.findFirst({
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
    const updatedCandidacy = await db.candidacy.update({
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
    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer la candidature existante avec l'élection associée
    const existingCandidacy = await db.candidacy.findFirst({
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
    const validPositions = await db.position.findMany({
      where: {
        id: { in: selectedPositionIds },
        electionId: existingCandidacy.position.electionId
      }
    });

    if (validPositions.length !== selectedPositionIds.length) {
      return { success: false, error: "Un ou plusieurs postes sélectionnés n'existent pas pour cette élection" };
    }

    // Récupérer toutes les candidatures existantes de l'adhérent pour cette élection
    const existingCandidacies = await db.candidacy.findMany({
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
      const existingCandidacyForPosition = await db.candidacy.findFirst({
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
    const results = await db.$transaction(async (tx) => {
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
    const elections = await db.election.findMany({
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
    const candidates = await db.candidacy.findMany({
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
    const candidacies = await db.candidacy.findMany({
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "Admin") {
      return { success: false, error: "Accès refusé - Admin requis" };
    }

    await db.candidacy.update({
      where: { id: candidacyId },
      data: { status }
    });

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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "Admin") {
      return { success: false, error: "Accès refusé - Admin requis" };
    }

    await db.election.update({
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
    const elections = await db.election.findMany({
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

    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    const votes = await db.vote.findMany({
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
    const election = await db.election.findUnique({
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
    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Vérifier que l'élection est ouverte au vote
    const election = await db.election.findUnique({
      where: { id: electionId }
    });

    if (!election || election.status !== ElectionStatus.Ouverte) {
      return { success: false, error: "L'élection n'est pas ouverte au vote" };
    }

    // Vérifier que l'utilisateur n'a pas déjà voté pour ce poste
    const existingVote = await db.vote.findFirst({
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
    const vote = await db.vote.create({
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
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent valider les candidatures" };
    }

    // Mettre à jour la candidature
    const candidacy = await db.candidacy.update({
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
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier le statut des élections" };
    }

    // Mettre à jour l'élection
    const election = await db.election.update({
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
    const election = await db.election.findUnique({
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

// Server Action pour récupérer l'historique des votes de l'utilisateur
export async function getUserVoteHistory(): Promise<{ success: boolean; elections?: any[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Profil adhérent non trouvé" };
    }

    // Récupérer toutes les élections avec les votes de l'utilisateur
    const elections = await db.election.findMany({
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
