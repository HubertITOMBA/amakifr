"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Schémas de validation
const CreateConversationSchema = z.object({
  titre: z.string().optional(),
  type: z.enum(["Privee", "Groupe", "Evenement"]).default("Privee"),
  evenementId: z.string().optional(),
  participantIds: z.array(z.string()).min(1, "Au moins un participant requis"),
});

const SendMessageSchema = z.object({
  conversationId: z.string().min(1, "ID de conversation requis"),
  content: z.string().min(1, "Le contenu du message est requis"),
  type: z.enum(["Texte", "Image", "Fichier", "System"]).default("Texte"),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  replyToId: z.string().optional(),
});

const EditMessageSchema = z.object({
  messageId: z.string().min(1, "ID de message requis"),
  content: z.string().min(1, "Le contenu du message est requis"),
});

const AddReactionSchema = z.object({
  messageId: z.string().min(1, "ID de message requis"),
  reaction: z.string().min(1, "Réaction requise").max(10),
});

// Types
export interface ConversationData {
  id: string;
  titre: string | null;
  type: string;
  evenementId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    id: string;
    userId: string;
    role: string;
    joinedAt: Date;
    leftAt: Date | null;
    User: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: Date;
    User: {
      id: string;
      name: string | null;
      image: string | null;
    };
  } | null;
  unreadCount?: number;
}

export interface MessageData {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  type: string;
  fileUrl: string | null;
  fileName: string | null;
  replyToId: string | null;
  edited: boolean;
  editedAt: Date | null;
  deleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  User: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  ReplyTo?: MessageData | null;
  Reactions: Array<{
    id: string;
    userId: string;
    reaction: string;
    createdAt: Date;
    User: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
}

/**
 * Créer une nouvelle conversation
 */
export async function createConversation(data: z.infer<typeof CreateConversationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateConversationSchema.parse(data);

    // Créer la conversation
    const conversation = await prisma.conversation.create({
      data: {
        titre: validatedData.titre,
        type: validatedData.type,
        evenementId: validatedData.evenementId,
        createdBy: session.user.id,
        Participants: {
          create: [
            // Ajouter le créateur
            {
              userId: session.user.id,
              role: "Admin",
            },
            // Ajouter les autres participants
            ...validatedData.participantIds.map((userId) => ({
              userId,
              role: "Participant",
            })),
          ],
        },
      },
      include: {
        Participants: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/chat");
    return { success: true, data: conversation };
  } catch (error) {
    console.error("Erreur lors de la création de la conversation:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la création de la conversation" };
  }
}

/**
 * Récupérer toutes les conversations de l'utilisateur
 */
export async function getUserConversations() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer les conversations où l'utilisateur est participant et n'a pas quitté
    const participantConversations = await prisma.conversationParticipant.findMany({
      where: {
        userId: session.user.id,
        leftAt: null,
      },
      include: {
        Conversation: {
          include: {
            Participants: {
              where: {
                leftAt: null,
              },
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
            Messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            _count: {
              select: {
                Messages: {
                  where: {
                    deleted: false,
                    createdAt: {
                      gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Messages des 7 derniers jours
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        Conversation: {
          updatedAt: "desc",
        },
      },
    });

    const conversations = participantConversations.map((pc) => ({
      ...pc.Conversation,
      lastMessage: pc.Conversation.Messages[0] || null,
    }));

    return { success: true, data: conversations };
  } catch (error) {
    console.error("Erreur lors de la récupération des conversations:", error);
    return { success: false, error: "Erreur lors de la récupération des conversations" };
  }
}

/**
 * Récupérer une conversation par son ID avec ses messages (avec pagination)
 */
export async function getConversationById(
  conversationId: string,
  page: number = 1,
  limit: number = 50,
  searchQuery?: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est participant à la conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: session.user.id,
        leftAt: null,
      },
    });

    if (!participant) {
      return { success: false, error: "Vous n'êtes pas autorisé à accéder à cette conversation" };
    }

    // Construire la condition de recherche
    const where: any = {
      conversationId,
      deleted: false,
    };

    if (searchQuery) {
      where.content = {
        contains: searchQuery,
        mode: "insensitive",
      };
    }

    // Calculer le skip pour la pagination
    const skip = (page - 1) * limit;

    // Récupérer les messages avec pagination
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          ReplyTo: {
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
          Reactions: {
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    // Inverser l'ordre pour afficher du plus ancien au plus récent
    const orderedMessages = messages.reverse();

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        Participants: {
          where: {
            leftAt: null,
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        Evenement: {
          select: {
            id: true,
            titre: true,
          },
        },
      },
    });

    if (!conversation) {
      return { success: false, error: "Conversation non trouvée" };
    }

    return {
      success: true,
      data: {
        ...conversation,
        Messages: orderedMessages,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: skip + limit < totalCount,
        },
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la conversation:", error);
    return { success: false, error: "Erreur lors de la récupération de la conversation" };
  }
}

/**
 * Envoyer un message dans une conversation
 */
export async function sendMessage(data: z.infer<typeof SendMessageSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = SendMessageSchema.parse(data);

    // Vérifier que l'utilisateur est participant à la conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: validatedData.conversationId,
        userId: session.user.id,
        leftAt: null,
      },
    });

    if (!participant) {
      return { success: false, error: "Vous n'êtes pas autorisé à envoyer des messages dans cette conversation" };
    }

    const message = await prisma.message.create({
      data: {
        conversationId: validatedData.conversationId,
        userId: session.user.id,
        content: validatedData.content,
        type: validatedData.type,
        fileUrl: validatedData.fileUrl,
        fileName: validatedData.fileName,
        replyToId: validatedData.replyToId,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        ReplyTo: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        Reactions: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Mettre à jour la date de mise à jour de la conversation
    await prisma.conversation.update({
      where: { id: validatedData.conversationId },
      data: { updatedAt: new Date() },
    });

    // Créer des notifications pour tous les autres participants
    const conversation = await prisma.conversation.findUnique({
      where: { id: validatedData.conversationId },
      include: {
        Participants: {
          where: {
            leftAt: null,
            userId: { not: session.user.id }, // Exclure l'expéditeur
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (conversation && conversation.Participants.length > 0) {
      // Créer une notification pour chaque participant
      const senderName = session.user.name || session.user.email || "Un utilisateur";
      const conversationTitle = conversation.titre || "Conversation";
      const messagePreview = validatedData.content.length > 50 
        ? validatedData.content.substring(0, 50) + "..." 
        : validatedData.content;

      const notifications = conversation.Participants.map((participant) => ({
        userId: participant.userId,
        type: "Chat" as const,
        titre: `Nouveau message de ${senderName}`,
        message: `${conversationTitle}: ${messagePreview}`,
        lien: `/chat/${validatedData.conversationId}`,
        lue: false,
      }));

      await prisma.notification.createMany({
        data: notifications,
      });
    }

    revalidatePath(`/chat/${validatedData.conversationId}`);
    revalidatePath("/chat");
    revalidatePath("/notifications");

    return { success: true, data: message };
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de l'envoi du message" };
  }
}

/**
 * Modifier un message
 */
export async function editMessage(data: z.infer<typeof EditMessageSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = EditMessageSchema.parse(data);

    // Vérifier que le message appartient à l'utilisateur
    const message = await prisma.message.findUnique({
      where: { id: validatedData.messageId },
    });

    if (!message) {
      return { success: false, error: "Message non trouvé" };
    }

    if (message.userId !== session.user.id) {
      return { success: false, error: "Vous n'êtes pas autorisé à modifier ce message" };
    }

    const updatedMessage = await prisma.message.update({
      where: { id: validatedData.messageId },
      data: {
        content: validatedData.content,
        edited: true,
        editedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        ReplyTo: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        Reactions: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    revalidatePath(`/chat/${message.conversationId}`);

    return { success: true, data: updatedMessage };
  } catch (error) {
    console.error("Erreur lors de la modification du message:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la modification du message" };
  }
}

/**
 * Supprimer un message (soft delete)
 */
export async function deleteMessage(messageId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return { success: false, error: "Message non trouvé" };
    }

    if (message.userId !== session.user.id) {
      return { success: false, error: "Vous n'êtes pas autorisé à supprimer ce message" };
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        content: "Message supprimé",
      },
    });

    revalidatePath(`/chat/${message.conversationId}`);

    return { success: true, data: updatedMessage };
  } catch (error) {
    console.error("Erreur lors de la suppression du message:", error);
    return { success: false, error: "Erreur lors de la suppression du message" };
  }
}

/**
 * Ajouter une réaction à un message
 */
export async function addReaction(data: z.infer<typeof AddReactionSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = AddReactionSchema.parse(data);

    // Vérifier que l'utilisateur a accès au message
    const message = await prisma.message.findUnique({
      where: { id: validatedData.messageId },
      include: {
        Conversation: {
          include: {
            Participants: {
              where: {
                userId: session.user.id,
                leftAt: null,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return { success: false, error: "Message non trouvé" };
    }

    if (message.Conversation.Participants.length === 0) {
      return { success: false, error: "Vous n'êtes pas autorisé à réagir à ce message" };
    }

    // Vérifier si la réaction existe déjà
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_reaction: {
          messageId: validatedData.messageId,
          userId: session.user.id,
          reaction: validatedData.reaction,
        },
      },
    });

    if (existingReaction) {
      // Supprimer la réaction si elle existe déjà (toggle)
      await prisma.messageReaction.delete({
        where: {
          messageId_userId_reaction: {
            messageId: validatedData.messageId,
            userId: session.user.id,
            reaction: validatedData.reaction,
          },
        },
      });

      revalidatePath(`/chat/${message.conversationId}`);
      return { success: true, data: null, message: "Réaction supprimée" };
    }

    // Créer la réaction
    const reaction = await prisma.messageReaction.create({
      data: {
        messageId: validatedData.messageId,
        userId: session.user.id,
        reaction: validatedData.reaction,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    revalidatePath(`/chat/${message.conversationId}`);

    return { success: true, data: reaction };
  } catch (error) {
    console.error("Erreur lors de l'ajout de la réaction:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de l'ajout de la réaction" };
  }
}

/**
 * Quitter une conversation
 */
export async function leaveConversation(conversationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: session.user.id,
        leftAt: null,
      },
    });

    if (!participant) {
      return { success: false, error: "Vous n'êtes pas participant à cette conversation" };
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: {
        leftAt: new Date(),
      },
    });

    revalidatePath("/chat");
    revalidatePath(`/chat/${conversationId}`);

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la sortie de la conversation:", error);
    return { success: false, error: "Erreur lors de la sortie de la conversation" };
  }
}

/**
 * Récupérer la liste des utilisateurs pour créer une conversation
 */
export async function getUsersForConversation() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const users = await prisma.user.findMany({
      where: {
        status: "Actif",
        id: {
          not: session.user.id, // Exclure l'utilisateur actuel
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
    });

    return { success: true, data: users };
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return { success: false, error: "Erreur lors de la récupération des utilisateurs" };
  }
}

/**
 * Récupérer les événements disponibles pour créer une conversation
 */
export async function getEvenementsForConversation() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const evenements = await prisma.evenement.findMany({
      where: {
        statut: "Publie",
      },
      select: {
        id: true,
        titre: true,
        dateDebut: true,
        dateFin: true,
      },
      orderBy: {
        dateDebut: "desc",
      },
      take: 50, // Limiter à 50 événements récents
    });

    return { success: true, data: evenements };
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    return { success: false, error: "Erreur lors de la récupération des événements" };
  }
}

/**
 * Récupérer le nombre de notifications de chat non lues
 */
export async function getUnreadMessagesCount() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé", count: 0 };
    }

    const count = await prisma.notification.count({
      where: {
        userId: session.user.id,
        type: "Chat",
        lue: false,
      },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Erreur lors de la récupération du nombre de messages non lus:", error);
    return { success: false, error: "Erreur", count: 0 };
  }
}

/**
 * Marquer les notifications de chat comme lues pour une conversation spécifique
 */
export async function markChatNotificationsAsRead(conversationId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const whereClause: any = {
      userId: session.user.id,
      type: "Chat",
      lue: false,
    };

    // Si une conversation spécifique est fournie, ne marquer que ses notifications
    if (conversationId) {
      whereClause.lien = `/chat/${conversationId}`;
    }

    await prisma.notification.updateMany({
      where: whereClause,
      data: {
        lue: true,
      },
    });

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors du marquage des notifications:", error);
    return { success: false, error: "Erreur lors du marquage des notifications" };
  }
}

