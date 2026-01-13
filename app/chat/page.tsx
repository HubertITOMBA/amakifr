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
  Loader2,
  CheckCircle
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
  const [conversationType, setConversationType] = useState<"Privee" | "Groupe" | "Evenement">("Groupe"); // Groupe par défaut pour plus de flexibilité
  const [conversationTitle, setConversationTitle] = useState("");
  const [selectedEvenement, setSelectedEvenement] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [participantSearch, setParticipantSearch] = useState(""); // Recherche de participants

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
    setConversationType("Groupe"); // Groupe par défaut
    setConversationTitle("");
    setSelectedEvenement("");
    setParticipantSearch(""); // Réinitialiser la recherche de participants
  };

  const handleToggleUser = (userId: string) => {
    if (conversationType === "Privee" && selectedUsers.length >= 1 && !selectedUsers.includes(userId)) {
      toast.error("Une conversation privée est limitée à 2 personnes (vous + 1 participant). Choisissez 'Conversation de groupe' pour inviter plusieurs personnes.", {
        duration: 5000,
      });
      return;
    }
    
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = () => {
    // Ne fonctionne que pour les conversations de groupe
    if (conversationType === "Privee") {
      toast.warning("Cette action n'est disponible que pour les conversations de groupe");
      return;
    }

    // Filtrer les utilisateurs selon la recherche actuelle
    const filteredUsers = users.filter((user) => {
      if (!participantSearch.trim()) return true;
      const searchLower = participantSearch.toLowerCase();
      const displayName = user.name ||
        `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
        user.email ||
        "";
      return (
        displayName.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.role?.toLowerCase().includes(searchLower)
      );
    });

    const filteredUserIds = filteredUsers.map(u => u.id);
    
    // Si tous les utilisateurs filtrés sont déjà sélectionnés, les désélectionner tous
    const allFilteredSelected = filteredUserIds.every(id => selectedUsers.includes(id));
    
    if (allFilteredSelected) {
      // Désélectionner tous les utilisateurs filtrés
      setSelectedUsers(prev => prev.filter(id => !filteredUserIds.includes(id)));
      toast.info(`${filteredUserIds.length} participant${filteredUserIds.length > 1 ? "s" : ""} désélectionné${filteredUserIds.length > 1 ? "s" : ""}`);
    } else {
      // Sélectionner tous les utilisateurs filtrés (en gardant les déjà sélectionnés)
      setSelectedUsers(prev => {
        const newSelection = [...prev];
        filteredUserIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
      toast.success(`${filteredUserIds.length} participant${filteredUserIds.length > 1 ? "s" : ""} sélectionné${filteredUserIds.length > 1 ? "s" : ""}`);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Veuillez sélectionner au moins un participant");
      return;
    }

    if (conversationType === "Groupe" && selectedUsers.length === 1 && !conversationTitle.trim()) {
      // Si un seul participant, générer un titre automatique
      const participant = users.find(u => u.id === selectedUsers[0]);
      const participantName = participant?.name || 
        `${participant?.adherent?.firstname || ''} ${participant?.adherent?.lastname || ''}`.trim() || 
        participant?.email || 
        'Utilisateur';
      setConversationTitle(`Discussion avec ${participantName}`);
    } else if (conversationType === "Groupe" && selectedUsers.length > 1 && !conversationTitle.trim()) {
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <Card className="max-w-md shadow-2xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 opacity-20 blur-3xl rounded-full"></div>
              <MessageSquare className="relative h-16 w-16 mx-auto text-blue-500 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Messagerie
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Veuillez vous connecter pour accéder à la messagerie et échanger avec les membres de l'association.
            </p>
            <Button 
              onClick={() => window.location.href = "/auth/login"} 
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
            >
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="flex gap-4 sm:gap-6 h-[calc(100vh-8rem)]">
          {/* Liste des conversations */}
          <Card className="w-80 flex-shrink-0 shadow-xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messages
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleNewConversation}
                  className="h-8 w-8 p-0 bg-white/20 hover:bg-white/30 border-white/30"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 mb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/70" />
                  <Input
                    placeholder="    Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-0 pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/70 focus:bg-white/30"
                  />
                </div>
              </div>
            </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-muted-foreground">Chargement de vos conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "Aucune conversation trouvée" : "Aucune conversation"}
                  </p>
                  {!searchQuery && (
                    <Button
                      size="sm"
                      onClick={handleNewConversation}
                      className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Démarrer une conversation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
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
        <Card className="flex-1 flex items-center justify-center shadow-xl border-0 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
          <CardContent className="text-center p-8 pb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 opacity-20 blur-3xl rounded-full"></div>
              <MessageSquare className="relative h-20 w-20 mx-auto mb-6 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Bienvenue sur la messagerie ! 👋
            </h3>
            <p className="text-muted-foreground mb-6">
              Sélectionnez une conversation ou créez-en une nouvelle pour commencer à échanger
            </p>
            <Button
              onClick={handleNewConversation}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle conversation
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Modal de création de conversation */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col border-0 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              Nouvelle conversation
            </DialogTitle>
            <DialogDescription className="text-base">
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
                  <SelectItem value="Privee">💬 Conversation privée (1 à 1)</SelectItem>
                  <SelectItem value="Groupe">👥 Conversation de groupe (plusieurs participants)</SelectItem>
                  <SelectItem value="Evenement">📅 Conversation d'événement</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {conversationType === "Privee" && "💬 Pour discuter avec une seule personne"}
                {conversationType === "Groupe" && "👥 Pour discuter avec plusieurs personnes"}
                {conversationType === "Evenement" && "📅 Pour discuter autour d'un événement"}
              </p>
            </div>

            {/* Titre pour les conversations de groupe */}
            {conversationType === "Groupe" && (
              <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label htmlFor="title" className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                  <Users className="h-4 w-4" />
                  Titre de la conversation *
                </Label>
                <Input
                  id="title"
                  value={conversationTitle}
                  onChange={(e) => setConversationTitle(e.target.value)}
                  placeholder="Ex: Équipe de coordination"
                  className="border-blue-300 dark:border-blue-700 focus:border-blue-500"
                />
              </div>
            )}

            {/* Sélection d'événement */}
            {conversationType === "Evenement" && (
              <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Label className="flex items-center gap-2 text-purple-900 dark:text-purple-300">
                  <Calendar className="h-4 w-4" />
                  Événement *
                </Label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <Select value={selectedEvenement} onValueChange={setSelectedEvenement}>
                    <SelectTrigger className="border-purple-300 dark:border-purple-700 focus:border-purple-500">
                      <SelectValue placeholder="Sélectionnez un événement" />
                    </SelectTrigger>
                    <SelectContent>
                      {evenements.map((evenement) => (
                        <SelectItem key={evenement.id} value={evenement.id}>
                          📅 {evenement.titre}
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
                Participants {conversationType === "Privee" ? "(1 seul participant)" : "(plusieurs participants possibles)"}
              </Label>
              {conversationType === "Privee" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <span>ℹ️</span>
                  <span>Une conversation privée est limitée à 2 personnes. Pour inviter plusieurs personnes, choisissez "Conversation de groupe".</span>
                </p>
              )}
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Champ de recherche des participants */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      placeholder="Rechercher un participant..."
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      className="pl-11 pr-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    />
                    {participantSearch && (
                      <button
                        onClick={() => setParticipantSearch("")}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Effacer la recherche"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Indicateur et actions de sélection */}
                  <div className="flex items-center justify-between">
                    {participantSearch && (
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const filteredCount = users.filter((user) => {
                            const searchLower = participantSearch.toLowerCase();
                            const displayName = user.name ||
                              `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
                              user.email ||
                              "";
                            return (
                              displayName.toLowerCase().includes(searchLower) ||
                              user.email?.toLowerCase().includes(searchLower) ||
                              user.role?.toLowerCase().includes(searchLower)
                            );
                          }).length;
                          return `${filteredCount} participant${filteredCount > 1 ? "s" : ""} trouvé${filteredCount > 1 ? "s" : ""}`;
                        })()}
                      </p>
                    )}
                    
                    {conversationType !== "Privee" && users.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        {(() => {
                          const filteredUsers = users.filter((user) => {
                            if (!participantSearch.trim()) return true;
                            const searchLower = participantSearch.toLowerCase();
                            const displayName = user.name ||
                              `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
                              user.email ||
                              "";
                            return (
                              displayName.toLowerCase().includes(searchLower) ||
                              user.email?.toLowerCase().includes(searchLower) ||
                              user.role?.toLowerCase().includes(searchLower)
                            );
                          });
                          const allSelected = filteredUsers.every(u => selectedUsers.includes(u.id));
                          return allSelected ? "Tout désélectionner" : "Tout sélectionner";
                        })()}
                      </Button>
                    )}
                  </div>
                  
                  <ScrollArea className="h-[300px] border rounded-md p-4">
                    <div className="space-y-2">
                      {users.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucun utilisateur disponible
                        </p>
                      ) : (() => {
                        // Filtrer les utilisateurs selon la recherche
                        const filteredUsers = users.filter((user) => {
                          if (!participantSearch.trim()) return true;
                          const searchLower = participantSearch.toLowerCase();
                          const displayName = user.name ||
                            `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
                            user.email ||
                            "";
                          return (
                            displayName.toLowerCase().includes(searchLower) ||
                            user.email?.toLowerCase().includes(searchLower) ||
                            user.role?.toLowerCase().includes(searchLower)
                          );
                        });

                        if (filteredUsers.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Aucun participant trouvé pour "{participantSearch}"
                            </p>
                          );
                        }

                        return filteredUsers.map((user) => {
                          const displayName =
                            user.name ||
                            `${user.adherent?.firstname || ""} ${user.adherent?.lastname || ""}`.trim() ||
                            user.email ||
                            "Utilisateur sans nom";
                          
                          return (
                            <div
                              key={user.id}
                              className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
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
                        });
                      })()}
                    </div>
                  </ScrollArea>
                </>
              )}
              {selectedUsers.length > 0 && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {selectedUsers.length} participant{selectedUsers.length > 1 ? "s" : ""} sélectionné{selectedUsers.length > 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseNewConversation}
              disabled={creating}
              className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={creating || selectedUsers.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer la conversation
                </>
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
      className="p-4 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 cursor-pointer transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12 border-2 border-white dark:border-gray-700 shadow-sm group-hover:shadow-md transition-shadow">
            {otherParticipants.length === 1 && otherParticipants[0]?.User?.image ? (
              <AvatarImage src={otherParticipants[0].User.image} />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                <Users className="h-5 w-5" />
              </AvatarFallback>
            )}
          </Avatar>
          {lastMessage && (
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold truncate text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {displayName}
            </p>
            {lastMessage && (
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                {formatDistanceToNow(new Date(lastMessage.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            )}
          </div>
          {lastMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              <span className="font-medium text-gray-700 dark:text-gray-300">{lastMessage.User?.name}: </span>
              {lastMessage.content}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {conversation.type === "Groupe" && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
                <Users className="h-3 w-3 mr-1" />
                {(conversation as any).Participants?.length || 0}
              </Badge>
            )}
            {conversation.type === "Evenement" && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-0">
                <Calendar className="h-3 w-3 mr-1" />
                Événement
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

