"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User,
  Minimize2,
  Maximize2,
  HelpCircle
} from "lucide-react";
import { generateBotResponse, welcomeMessages, quickHelpMessages, chatbotGuides, quickQuestions, type ChatMessage, type ChatAction } from "@/lib/chatbot-guides";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Composant ChatBot pour guider les adhérents
 * Affiche un bouton flottant qui ouvre une interface de chat
 */
export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Charger l'historique depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedHistory = localStorage.getItem('amaki-chat-history');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          // Convertir les timestamps en Date
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
      }
    }
  }, []);

  // Sauvegarder l'historique dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        // Ne pas sauvegarder le message de bienvenue seul
        if (messages.length > 1 || (messages.length === 1 && messages[0].id !== 'welcome')) {
          localStorage.setItem('amaki-chat-history', JSON.stringify(messages));
        }
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', error);
      }
    }
  }, [messages]);

  // Message de bienvenue au premier chargement (seulement si pas d'historique)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'bot',
        content: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)] + '\n\n' + 
                 quickHelpMessages[0] + '\n\n' +
                 chatbotGuides.slice(0, 5).map(g => `• ${g.title}`).join('\n') +
                 '\n\nN\'hésitez pas à me poser une question, je suis là pour vous aider !',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  // Scroll automatique vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (scrollAreaRef.current && messages.length > 0) {
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
      requestAnimationFrame(() => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
    }
  }, [messages]);

  // Focus sur l'input quand le chat s'ouvre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = (questionText?: string) => {
    const question = questionText || inputValue.trim();
    if (!question) return;
    
    // Ajouter le message de l'utilisateur
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!questionText) {
      setInputValue("");
    }
    setIsTyping(true);

    // Simuler un délai de réponse du bot
    setTimeout(() => {
      try {
        const response = generateBotResponse(question);
        
        if (!response || !response.message) {
          throw new Error('Réponse invalide du bot');
        }
        
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.message,
          timestamp: new Date(),
          actions: response.guide?.actions
        };
        
        setMessages(prev => [...prev, botMessage]);
      } catch (error) {
        console.error('Erreur lors de la génération de la réponse:', error);
        const errorMessage: ChatMessage = {
          id: `bot-error-${Date.now()}`,
          type: 'bot',
          content: 'Désolé, une erreur est survenue. Pouvez-vous reformuler votre question ?\n\nJe suis Amaki et je peux vous aider avec :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    }, 800);
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.href) {
      router.push(action.href);
      setIsOpen(false);
      setIsMinimized(false);
    } else if (action.onClick) {
      action.onClick();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
          title="Ouvrir Amaki - Votre assistant"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
      isMinimized ? 'w-80' : 'w-full max-w-md'
    }`}>
      <Card className={`shadow-2xl border-blue-200 dark:border-blue-800 ${
        isMinimized ? 'h-auto' : 'h-[600px]'
      } flex flex-col !py-0`}>
        <CardHeader className="!py-0 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white pb-3 pt-3 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base font-semibold text-white">
              Amaki - Votre Assistant
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsMinimized(!isMinimized);
              }}
              className="h-7 w-7 p-0 text-white hover:bg-white/20"
              title={isMinimized ? "Agrandir" : "Réduire"}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Optionnel : effacer l'historique en fermant
                // localStorage.removeItem('amaki-chat-history');
                setIsOpen(false);
                setIsMinimized(false);
              }}
              className="h-7 w-7 p-0 text-white hover:bg-white/20"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
              <ScrollArea className="flex-1 px-4 py-3 min-h-0" ref={scrollAreaRef}>
                <div className="space-y-4 pb-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.type === 'bot' && (
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div className={`flex flex-col max-w-[80%] ${
                        message.type === 'user' ? 'items-end' : 'items-start'
                      }`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.actions && message.actions.length > 0 && (
                          <div className="mt-3 flex flex-col gap-2 w-full">
                            {message.actions.map((action, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handleActionClick(action)}
                                className="text-xs font-medium bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {format(message.timestamp, "HH:mm", { locale: fr })}
                        </span>
                      </div>
                      {message.type === 'user' && (
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                {/* Suggestions de questions rapides */}
                {messages.length <= 1 && (
                  <div className="mb-3 p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-semibold flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      Questions rapides :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {quickQuestions.slice(0, 4).map((question, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleSendMessage(question);
                          }}
                          className="text-xs h-8 px-3 font-medium bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Posez votre question..."
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isTyping}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Exemples : "Comment modifier mon mot de passe ?", "Comment payer ma cotisation ?"
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-center font-medium">
                  💬 Amaki est là pour vous aider !
                </p>
              </div>
            </CardContent>
          </>
        )}
        
        {isMinimized && (
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <HelpCircle className="h-4 w-4" />
              <span>Cliquez pour agrandir et poser une question</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
