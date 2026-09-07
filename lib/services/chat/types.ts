/**
 * DTOs messagerie self-service (mobile / API v1).
 * Pas d'email ni téléphone — identité minimale.
 */

export type MyChatContactDto = {
  id: string;
  displayName: string;
  image: string | null;
};

export type MyChatConversationListItemDto = {
  id: string;
  type: string;
  titre: string | null;
  /** Libellé affichable (titre groupe / nom correspondant / événement). */
  displayTitle: string;
  image: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  participantCount: number;
};

export type MyChatConversationsListDto = {
  items: MyChatConversationListItemDto[];
  total: number;
  limit: number;
  offset: number;
};

export type MyChatParticipantDto = {
  userId: string;
  displayName: string;
  image: string | null;
  role: string;
};

export type MyChatMessageDto = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  isMine: boolean;
  edited: boolean;
  deleted: boolean;
  author: {
    displayName: string;
    image: string | null;
  };
  replyTo: {
    id: string;
    content: string;
    authorDisplayName: string;
  } | null;
};

export type MyChatConversationDetailDto = {
  id: string;
  type: string;
  titre: string | null;
  displayTitle: string;
  evenementTitre: string | null;
  participants: MyChatParticipantDto[];
  messages: MyChatMessageDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export type MyChatUnreadCountDto = {
  count: number;
};

export type SendMyMessageResultDto = {
  message: MyChatMessageDto;
};

export type CreateMyConversationResultDto = {
  id: string;
};
