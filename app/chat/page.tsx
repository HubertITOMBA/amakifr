"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Send, 
  Users, 
  Plus, 
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Smile,
  Reply,
  X,
  Calendar,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  getUserConversations,
  createConversation,
  getUsersForConversation,
  getEvenementsForConversation,
  type ConversationData,
  type MessageData,
} from "@/actions/chat";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function ChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [evenements, setEvenements] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [conversationType, setConversationType] = useState<"Privee" | "Groupe" | "Evenement">("Privee");
  const [conversationTitle, setConversationTitle] = useState("");
  const [selectedEvenement, setSelectedEvenement] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session?.user) {
      loadConversations();
    }
  }, [session]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const result = await getUserConversations();
      if (result.success && result.data) {
        setConversations(result.data as unknown as ConversationData[]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des conversations:", error);
      toast.error("Erreur lors du chargement des conversations");
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.titre?.toLowerCase().includes(query) ||
      (conv as any).Participants?.some((p: any) => 
        p.User.name?.toLowerCase().includes(query) ||
        p.User.email?.toLowerCase().includes(query)
      )
    );
  });

  const handleNewConversation = async () => {
    setShowNewConversation(true);
    setLoadingUsers(true);
    try {
      const [usersResult, evenementsResult] = await Promise.all([
        getUsersForConversation(),
        getEvenementsForConversation(),
      ]);
      
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data);
      }
      
      if (evenementsResult.success && evenementsResult.data) {
        setEvenements(evenementsResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCloseNewConversation = () => {
    setShowNewConversation(false);
    setSelectedUsers([]);
    setConversationType("Privee");
    setConversationTitle("");
    setSelectedEvenement("");
  };

  const handleToggleUser = (userId: string) => {
    if (conversationType === "Privee" && selectedUsers.length >= 1 && !selectedUsers.includes(userId)) {
      toast.error("Une conversation privée ne peut avoir qu'un seul participant");
      return;
    }
    
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Veuillez sélectionner au moins un participant");
      return;
    }

    if (conversationType === "Groupe" && !conversationTitle.trim()) {
      toast.error("Veuillez entrer un titre pour la conversation de groupe");
      return;
    }

    if (conversationType === "Evenement" && !selectedEvenement) {
      toast.error("Veuillez sélectionner un événement");
      return;
    }

    setCreating(true);
    try {
      const result = await createConversation({
        titre: conversationType === "Groupe" ? conversationTitle : undefined,
        type: conversationType,
        evenementId: conversationType === "Evenement" ? selectedEvenement : undefined,
        participantIds: selectedUsers,
      });

      if (result.success && result.data) {
        toast.success("Conversation créée avec succès");
        handleCloseNewConversation();
        loadConversations();
        router.push(`/chat/${(result.data as any).id}`);
      } else {
        toast.error(result.error || "Erreur lors de la création de la conversation");
      }
    } catch (error) {
      console.error("Erreur lors de la création de la conversation:", error);
      toast.error("Erreur lors de la création de la conversation");
    } finally {
      setCreating(false);
    }
  };

  if (!session?.user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Veuillez vous connecter pour accéder au chat.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Liste des conversations */}
        <Card className="w-80 flex-shrink-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
              <Button
                size="sm"
                onClick={handleNewConversation}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Chargement...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? "Aucune conversation trouvée" : "Aucune conversation"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      currentUserId={session.user?.id || ""}
                      onClick={() => router.push(`/chat/${conversation.id}`)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Zone principale - Sélectionnez une conversation */}
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center text-muted-foreground">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Sélectionnez une conversation pour commencer</p>
          </CardContent>
        </Card>
      </div>

      {/* Modal de création de conversation */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
            <DialogDescription>
              Créez une nouvelle conversation privée, de groupe ou liée à un événement
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            {/* Type de conversation */}
            <div className="space-y-2">
              <Label>Type de conversation</Label>
              <Select
                value={conversationType}
                onValueChange={(value: "Privee" | "Groupe" | "Evenement") => {
                  setConversationType(value);
                  setSelectedUsers([]);
                  setConversationTitle("");
                  setSelectedEvenement("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Privee">Conversation privée</SelectItem>
                  <SelectItem value="Groupe">Conversation de groupe</SelectItem>
                  <SelectItem value="Evenement">Conversation d'événement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Titre pour les conversations de groupe */}
            {conversationType === "Groupe" && (
              <div className="space-y-2">
                <Label htmlFor="title">Titre de la conversation *</Label>
                <Input
                  id="title"
                  value={conversationTitle}
                  onChange={(e) => setConversationTitle(e.target.value)}
                  placeholder="Ex: Équipe de coordination"
                />
              </div>
            )}

            {/* Sélection d'événement */}
            {conversationType === "Evenement" && (
              <div className="space-y-2">
                <Label>Événement *</Label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <Select value={selectedEvenement} onValueChange={setSelectedEvenement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un événement" />
                    </SelectTrigger>
                    <SelectContent>
                      {evenements.map((evenement) => (
                        <SelectItem key={evenement.id} value={evenement.id}>
                          {evenement.titre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Liste des utilisateurs */}
            <div className="space-y-2">
              <Label>
                Participants {conversationType === "Privee" ? "(1 max)" : "*"}
              </Label>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-md p-4">
                  <div className="space-y-2">
                    {users.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun utilisateur disponible
                      </p>
                    ) : (
                      users.map((user) => {
                        const displayName =
                          user.name ||
                          `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
                          user.email ||
                          "Utilisateur sans nom";
                        
                        return (
                          <div
                            key={user.id}
                            className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => handleToggleUser(user.id)}
                          >
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => handleToggleUser(user.id)}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image || undefined} />
                              <AvatarFallback>
                                {displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{displayName}</p>
                              {user.email && (
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {user.role}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              )}
              {selectedUsers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedUsers.length} participant{selectedUsers.length > 1 ? "s" : ""} sélectionné{selectedUsers.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseNewConversation}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={creating || selectedUsers.length === 0}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer la conversation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ConversationItemProps {
  conversation: ConversationData;
  currentUserId: string;
  onClick: () => void;
}

function ConversationItem({ conversation, currentUserId, onClick }: ConversationItemProps) {
  const otherParticipants = (conversation as any).Participants?.filter(
    (p: any) => p.User.id !== currentUserId
  ) || [];
  
  const displayName = conversation.titre || 
    otherParticipants.map((p: any) => p.User.name || p.User.email).join(", ") ||
    "Conversation sans titre";

  const lastMessage = (conversation as any).lastMessage || (conversation as any).Messages?.[0];

  return (
    <div
      onClick={onClick}
      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          {otherParticipants.length === 1 && otherParticipants[0]?.User?.image ? (
            <AvatarImage src={otherParticipants[0].User.image} />
          ) : (
            <AvatarFallback>
              <Users className="h-5 w-5" />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium truncate">{displayName}</p>
            {lastMessage && (
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                {formatDistanceToNow(new Date(lastMessage.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            )}
          </div>
          {lastMessage && (
            <p className="text-sm text-muted-foreground truncate">
              <span className="font-medium">{lastMessage.User?.name}: </span>
              {lastMessage.content}
            </p>
          )}
          {conversation.type === "Groupe" && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {(conversation as any).Participants?.length || 0} participants
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

