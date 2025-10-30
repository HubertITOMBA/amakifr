"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Edit,
  Trash2,
  MoreVertical,
  Smile,
  Reply,
  X,
  ArrowLeft,
  Users,
  Calendar,
  Search,
  ChevronUp,
  Loader2,
  History,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getConversationById,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  leaveConversation,
  type ConversationData,
  type MessageData,
} from "@/actions/chat";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const conversationId = params?.id as string;

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageData | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    if (!searchMode && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, searchMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversation = async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const result = await getConversationById(
        conversationId,
        page,
        50,
        searchQuery || undefined
      );

      if (result.success && result.data) {
        const conv = result.data as any;
        const newMessages = conv.Messages || [];
        
        if (!conversation) {
          setConversation(conv);
        }
        
        if (append) {
          // Ajouter les anciens messages au début
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          // Remplacer tous les messages (nouveau chargement ou recherche)
          setMessages(newMessages);
          if (!searchMode) {
            setTimeout(() => scrollToBottom(), 100);
          }
        }

        setCurrentPage(page);
        setHasMore(conv.pagination?.hasMore || false);
        setTotalMessages(conv.pagination?.total || 0);
      } else {
        if (!append) {
          toast.error(result.error || "Conversation non trouvée");
          router.push("/chat");
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la conversation:", error);
      if (!append) {
        toast.error("Erreur lors du chargement de la conversation");
        router.push("/chat");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore) return;
    await loadConversation(currentPage + 1, true);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchMode(false);
      setSearchQuery("");
      await loadConversation(1, false);
      return;
    }

    setSearchMode(true);
    await loadConversation(1, false);
  };

  const handleClearSearch = async () => {
    setSearchQuery("");
    setSearchMode(false);
    await loadConversation(1, false);
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() && !replyingTo) return;

    try {
      const result = await sendMessage({
        conversationId,
        content: messageContent.trim(),
        type: "Texte",
        replyToId: replyingTo?.id,
      });

      if (result.success && result.data) {
        setMessageContent("");
        setReplyingTo(null);
        loadConversation(); // Recharger pour avoir l'historique complet
      } else {
        toast.error(result.error || "Erreur lors de l'envoi du message");
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      toast.error("Erreur lors de l'envoi du message");
    }
  };

  const handleEditMessage = async (message: MessageData) => {
    if (!messageContent.trim()) return;

    try {
      const result = await editMessage({
        messageId: message.id,
        content: messageContent.trim(),
      });

      if (result.success) {
        setEditingMessage(null);
        setMessageContent("");
        loadConversation();
      } else {
        toast.error(result.error || "Erreur lors de la modification");
      }
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ?")) return;

    try {
      const result = await deleteMessage(messageId);
      if (result.success) {
        loadConversation();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAddReaction = async (messageId: string, reaction: string) => {
    try {
      const result = await addReaction({ messageId, reaction });
      if (result.success) {
        loadConversation();
      } else {
        toast.error(result.error || "Erreur lors de l'ajout de la réaction");
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout de la réaction:", error);
      toast.error("Erreur lors de l'ajout de la réaction");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        handleEditMessage(editingMessage);
      } else {
        handleSendMessage();
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Chargement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  const otherParticipants = (conversation as any).Participants?.filter(
    (p: any) => p.User.id !== session?.user?.id
  ) || [];
  
  const displayName = conversation.titre ||
    otherParticipants.map((p: any) => p.User.name || p.User.email).join(", ") ||
    "Conversation sans titre";

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* En-tête */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/chat">
                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {otherParticipants.length === 1 && otherParticipants[0].User.image ? (
                      <AvatarImage src={otherParticipants[0].User.image} />
                    ) : (
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{displayName}</CardTitle>
                    {conversation.type === "Groupe" && (
                      <p className="text-sm text-muted-foreground">
                        {(conversation as any).Participants?.length || 0} participants
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {(conversation as any).Evenement && (
                <Badge variant="secondary">
                  <Calendar className="h-3 w-3 mr-1" />
                  {(conversation as any).Evenement.titre}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Zone des messages */}
        <Card className="flex-1 flex flex-col">
          {/* Barre de recherche */}
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans l'historique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="pl-8"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {searchMode && (
              <Badge variant="secondary" className="text-xs">
                <History className="h-3 w-3 mr-1" />
                {totalMessages} résultat{totalMessages > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <CardContent className="flex-1 p-0 flex flex-col relative">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              {/* Bouton charger plus */}
              {hasMore && !searchMode && (
                <div className="flex justify-center mb-4" ref={messagesTopRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Charger les messages précédents
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Aucun message pour le moment</p>
                    <p className="text-sm mt-2">Commencez la conversation !</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isCurrentUser = message.User.id === session?.user?.id;
                    const showAvatar = index === 0 || messages[index - 1].User.id !== message.User.id;
                    
                    // Afficher le timestamp si c'est le dernier message ou si l'écart avec le suivant est > 5 minutes
                    const showTimestamp =
                      index === messages.length - 1 ||
                      new Date(message.createdAt).getTime() -
                        new Date(messages[index + 1].createdAt).getTime() >
                        5 * 60 * 1000;

                    // Afficher une séparation de date si on change de jour
                    const messageDate = new Date(message.createdAt);
                    const prevMessageDate = index > 0 ? new Date(messages[index - 1].createdAt) : null;
                    const showDateSeparator = 
                      !prevMessageDate ||
                      messageDate.toDateString() !== prevMessageDate.toDateString();

                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full">
                              <Calendar className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                {format(messageDate, "EEEE d MMMM yyyy", { locale: fr })}
                              </span>
                            </div>
                          </div>
                        )}
                        <MessageBubble
                          message={message}
                        isCurrentUser={isCurrentUser}
                        showAvatar={showAvatar}
                        showTimestamp={showTimestamp}
                        onReply={() => setReplyingTo(message)}
                        onEdit={() => {
                          setEditingMessage(message);
                          setMessageContent(message.content);
                          inputRef.current?.focus();
                        }}
                        onDelete={() => handleDeleteMessage(message.id)}
                        onAddReaction={(reaction) => handleAddReaction(message.id, reaction)}
                      />
                      </div>
                    );
                  })
                )}
                {!hasMore && !searchMode && messages.length > 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    {totalMessages > 0 && (
                      <p>Vous avez vu tous les messages ({totalMessages} message{totalMessages > 1 ? "s" : ""})</p>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Zone de réponse */}
            {replyingTo && (
              <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Réponse à <span className="font-medium">{replyingTo.User.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-xs">
                    {replyingTo.content}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {editingMessage && (
              <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Modification du message</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingMessage(null);
                    setMessageContent("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Zone de saisie */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={editingMessage ? "Modifier le message..." : "Tapez votre message..."}
                  className="min-h-[60px] resize-none"
                  rows={1}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={editingMessage ? () => handleEditMessage(editingMessage) : handleSendMessage}
                    disabled={!messageContent.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: MessageData;
  isCurrentUser: boolean;
  showAvatar: boolean;
  showTimestamp: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddReaction: (reaction: string) => void;
}

function MessageBubble({
  message,
  isCurrentUser,
  showAvatar,
  showTimestamp,
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);

  const commonReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  return (
    <div
      className={`flex gap-2 group ${isCurrentUser ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isCurrentUser && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.User.image || undefined} />
          <AvatarFallback>
            {message.User.name?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      {!isCurrentUser && !showAvatar && <div className="w-8" />}

      <div className={`flex flex-col max-w-[70%] ${isCurrentUser ? "items-end" : "items-start"}`}>
        {showAvatar && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{message.User.name}</span>
            {message.edited && (
              <span className="text-xs text-muted-foreground">(modifié)</span>
            )}
          </div>
        )}

        {message.ReplyTo && (
          <div className="text-xs text-muted-foreground mb-1 px-2 py-1 bg-muted rounded border-l-2 border-primary">
            Réponse à {message.ReplyTo.User.name}: {message.ReplyTo.content}
          </div>
        )}

        <div
          className={`rounded-lg px-4 py-2 ${
            isCurrentUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {message.Reactions && message.Reactions.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(
              message.Reactions.reduce((acc: Record<string, string[]>, reaction) => {
                if (!acc[reaction.reaction]) {
                  acc[reaction.reaction] = [];
                }
                acc[reaction.reaction].push(reaction.User.name || "");
                return acc;
              }, {})
            ).map(([reaction, users]) => (
              <Badge
                key={reaction}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-muted-foreground/20"
                onClick={() => onAddReaction(reaction)}
              >
                {reaction} {users.length}
              </Badge>
            ))}
          </div>
        )}

        {showTimestamp && (
          <span className="text-xs text-muted-foreground mt-1">
            {format(new Date(message.createdAt), "HH:mm", { locale: fr })}
          </span>
        )}

        {showActions && (
          <div className="flex gap-1 mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReply}
              className="h-6 px-2 text-xs"
            >
              <Reply className="h-3 w-3 mr-1" />
              Répondre
            </Button>
            {isCurrentUser && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-6 px-2 text-xs"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="h-6 px-2 text-xs text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Supprimer
                </Button>
              </>
            )}
            <div className="flex gap-1">
              {commonReactions.map((reaction) => (
                <Button
                  key={reaction}
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddReaction(reaction)}
                  className="h-6 w-6 p-0"
                >
                  {reaction}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isCurrentUser && !showAvatar && <div className="w-8" />}
      {isCurrentUser && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.User.image || undefined} />
          <AvatarFallback>
            {message.User.name?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

