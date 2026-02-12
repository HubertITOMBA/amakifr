"use client";

import { useState, useEffect } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Calendar, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface InterviewSection {
  title: string;
  content: string;
}

export default function PresidentInterviewPage() {
  const [interviewContent, setInterviewContent] = useState<InterviewSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Charger le contenu de l'interview depuis l'API
    fetch("/api/president-interview")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.sections) {
          setInterviewContent(data.sections);
        } else {
          setError(data.error || "Erreur lors du chargement");
        }
      })
      .catch((err) => {
        console.error("Erreur:", err);
        setError("Impossible de charger l'interview");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section avec photo en arrière-plan */}
      <section className="relative py-16 sm:py-20 md:py-24 lg:py-32 overflow-hidden min-h-[60vh]">
        {/* Photo de fond avec overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/president_3st.png"
            alt="Simon Bavueza Tongi - Président AMAKI France"
            fill
            className="object-cover object-center"
            priority
            quality={90}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 to-transparent" />
        </div>
        
        {/* Contenu */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6">
            <Link href="/amicale">
              <Button variant="ghost" className="text-white hover:bg-white/20 mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à l&apos;amicale
              </Button>
            </Link>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-10 max-w-4xl mx-auto border border-white/20 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <User className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              Interview du Président
            </h1>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white/90 mb-3 drop-shadow-md">
              Monsieur Simon Bavueza Tongi
            </h2>
            <div className="flex items-center justify-center gap-2 text-white/80">
              <Calendar className="h-5 w-5" />
              <span className="text-lg sm:text-xl">Élu le 29 novembre 2025</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu de l'interview */}
      <section className="relative z-10 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-white via-purple-50/30 to-white dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Contenu principal */}
            <div className="flex-1 max-w-4xl">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <p className="text-sm text-muted-foreground mt-2">
                L&apos;interview sera bientôt disponible.
              </p>
            </Card>
          ) : interviewContent.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Le contenu de l&apos;interview est en cours de préparation.
              </p>
            </Card>
          ) : (
            <div className="space-y-10 sm:space-y-14 md:space-y-16">
              {interviewContent.map((section, index) => {
                // Les 5 rubriques à mettre clairement en valeur (style magazine)
                const featuredRubriques = [
                  "Parcours et motivations",
                  "Vision et projets",
                  "Gouvernance et engagement",
                  "Défis et perspectives",
                  "Message aux membres"
                ];
                const featuredIndex = featuredRubriques.findIndex(title =>
                  section.title.toLowerCase().includes(title.toLowerCase())
                );
                const isFeatured = featuredIndex >= 0;

                // Première section = intro : ne pas répéter le titre (déjà dans le Hero)
                const isIntro = section.title.toLowerCase().includes("interview avec le nouveau président");

                // Couleurs distinctes et vibrantes pour chaque rubrique vedette avec fonds colorés très visibles
                const featuredStyles = [
                  { 
                    gradient: "from-indigo-600 via-purple-600 to-indigo-700", 
                    bg: "from-indigo-200 via-purple-200 to-indigo-100 dark:from-indigo-900/80 dark:via-purple-900/70 dark:to-indigo-900/60", 
                    border: "border-indigo-400 dark:border-indigo-500",
                    shadow: "shadow-indigo-200 dark:shadow-indigo-900"
                  },
                  { 
                    gradient: "from-purple-600 via-pink-600 to-purple-700", 
                    bg: "from-purple-200 via-pink-200 to-purple-100 dark:from-purple-900/80 dark:via-pink-900/70 dark:to-purple-900/60", 
                    border: "border-purple-400 dark:border-purple-500",
                    shadow: "shadow-purple-200 dark:shadow-purple-900"
                  },
                  { 
                    gradient: "from-pink-600 via-rose-600 to-pink-700", 
                    bg: "from-pink-200 via-rose-200 to-pink-100 dark:from-pink-900/80 dark:via-rose-900/70 dark:to-pink-900/60", 
                    border: "border-pink-400 dark:border-pink-500",
                    shadow: "shadow-pink-200 dark:shadow-pink-900"
                  },
                  { 
                    gradient: "from-amber-500 via-orange-600 to-amber-600", 
                    bg: "from-amber-200 via-orange-200 to-amber-100 dark:from-amber-900/80 dark:via-orange-900/70 dark:to-amber-900/60", 
                    border: "border-amber-400 dark:border-amber-500",
                    shadow: "shadow-amber-200 dark:shadow-amber-900"
                  },
                  { 
                    gradient: "from-emerald-600 via-teal-600 to-emerald-700", 
                    bg: "from-emerald-200 via-teal-200 to-emerald-100 dark:from-emerald-900/80 dark:via-teal-900/70 dark:to-emerald-900/60", 
                    border: "border-emerald-400 dark:border-emerald-500",
                    shadow: "shadow-emerald-200 dark:shadow-emerald-900"
                  }
                ];
                const style = isFeatured ? featuredStyles[featuredIndex] : { gradient: "from-slate-600 to-slate-700", bg: "bg-white dark:bg-slate-900", border: "border-slate-200 dark:border-slate-700", shadow: "" };

                return (
                  <article key={index} className={isFeatured ? `rounded-2xl overflow-hidden border-2 ${style.border} shadow-2xl ${style.shadow}` : ""}>
                    {/* Titre : masqué pour l'intro (évite doublon avec le Hero) */}
                    {!isIntro && (
                      <div className={`bg-gradient-to-r ${style.gradient} px-4 sm:px-6 py-3 sm:py-4 ${isFeatured ? "py-4 sm:py-5 md:py-6" : "py-2.5 sm:py-3"}`}>
                        <h2 className={`font-bold text-white drop-shadow-md ${isFeatured ? "text-base sm:text-lg md:text-xl lg:text-2xl tracking-tight leading-tight" : "text-sm sm:text-base md:text-lg"}`}>
                          {section.title}
                        </h2>
                      </div>
                    )}
                    {/* Contenu */}
                    <div className={`p-6 sm:p-8 md:p-10 ${isFeatured ? `bg-gradient-to-br ${style.bg}` : "bg-white dark:bg-slate-900"}`}>
                      <div
                        className="interview-content prose prose-lg dark:prose-invert max-w-none
                          prose-h1:text-2xl sm:prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 prose-h1:mt-0
                          prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-5 prose-h2:mt-8 prose-h2:border-b prose-h2:border-gray-200 dark:prose-h2:border-gray-700 prose-h2:pb-2
                          prose-h3:text-lg sm:prose-h3:text-xl prose-h3:font-semibold prose-h3:mb-4 prose-h3:mt-6
                          prose-p:mb-0 prose-p:mt-0
                          prose-strong:font-bold
                          prose-ul:my-4 prose-li:mb-2"
                        dangerouslySetInnerHTML={{
                          __html: (() => {
                            let processed = section.content;
                            const markers = new Set<string>();
                            
                            // Liste étendue des questions spécifiques à détecter (même sans ?)
                            const specificQuestions = [
                              "Quelles sont les valeurs que vous souhaitez incarner",
                              "Quels sont les projets prioritaires que vous souhaitez mettre",
                              "Quelle est votre ambition pour l'association",
                              "Quelle est votre vision",
                              "Quels sont vos projets",
                              "Quelles sont vos motivations",
                              "Comment voyez-vous",
                              "Quel est votre message"
                            ];
                            
                            // Un seul cadre par question/réponse (une seule div, pas de p imbriqué)
                            const questionBlockClass = "mb-4 mt-6 first:mt-0 py-3 px-4 rounded-lg border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 text-sm sm:text-base font-semibold leading-snug";
                            const answerBlockClass = "mb-4 py-3 px-4 rounded-lg border-l-2 border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed";

                            // Détecter les paragraphes avec classe question-text (marqués par l'API)
                            processed = processed.replace(
                              /<p class="question-text">(.*?)<\/p>/gi,
                              (match, content) => {
                                const key = `Q_MARKED_${content}`;
                                if (markers.has(key)) return match;
                                markers.add(key);
                                return `<div class="${questionBlockClass}">${content}</div>`;
                              }
                            );

                            // Détecter les questions spécifiques (même sans ?)
                            specificQuestions.forEach((qPattern) => {
                              const escapedPattern = qPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const regex = new RegExp(`(<p[^>]*>.*?${escapedPattern}[^<]*?</p>)`, 'gi');
                              processed = processed.replace(regex, (match) => {
                                if (match.includes("question-block") || match.includes(questionBlockClass)) return match;
                                const contentMatch = match.match(/<p[^>]*>(.*?)<\/p>/i);
                                if (!contentMatch) return match;
                                const content = contentMatch[1];
                                const key = `Q_SPEC_${content}`;
                                if (markers.has(key)) return match;
                                markers.add(key);
                                return `<div class="${questionBlockClass}">${content}</div>`;
                              });
                            });

                            // Questions avec ?
                            processed = processed.replace(
                              /<p[^>]*>([^<]*\?[^<]*)<\/p>/gi,
                              (match, content) => {
                                if (match.includes(questionBlockClass)) return match;
                                const key = `Q_${content}`;
                                if (markers.has(key)) return match;
                                markers.add(key);
                                return `<div class="${questionBlockClass}">${content}</div>`;
                              }
                            );

                            // Questions dans strong/b
                            processed = processed.replace(
                              /<(strong|b)[^>]*>([^<]*Qu[^<]*\?[^<]*)<\/(strong|b)>/gi,
                              (match, tag, content) => {
                                const key = `Q_STRONG_${content}`;
                                if (markers.has(key)) return match;
                                markers.add(key);
                                return `<div class="${questionBlockClass}">${content}</div>`;
                              }
                            );

                            // Questions commençant par Pouvez-vous, Qu'est-ce, etc.
                            const questionStarters = ["Pouvez-vous", "Qu'est-ce", "Quelles", "Quels", "Quelle", "Comment", "Quel"];
                            questionStarters.forEach((starter) => {
                              const regex = new RegExp(`<p[^>]*>(${starter}[^<]*?)</p>`, 'gi');
                              processed = processed.replace(regex, (match, content) => {
                                if (match.includes(questionBlockClass)) return match;
                                const key = `Q_STARTER_${content}`;
                                if (markers.has(key)) return match;
                                markers.add(key);
                                return `<div class="${questionBlockClass}">${content}</div>`;
                              });
                            });

                            // Réponses : un seul div
                            processed = processed.replace(
                              /<p[^>]*>([^<]+?)<\/p>/gi,
                              (match, content) => {
                                if (match.includes(questionBlockClass) || match.includes(answerBlockClass)) return match;
                                if (!content.trim()) return match;
                                if (content.includes("?") || specificQuestions.some(q => content.toLowerCase().includes(q.toLowerCase()))) return match;
                                return `<div class="${answerBlockClass}">${content}</div>`;
                              }
                            );
                            
                            return processed;
                          })()
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
            </div>
            
            {/* Photo latérale droite */}
            <aside className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
              <div className="sticky top-24">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                  <div className="aspect-[3/4] relative">
                    <Image
                      src="/images/president_3st.png"
                      alt="Simon Bavueza Tongi - Président AMAKI France"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 0vw, 384px"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-xl font-bold mb-1">Simon Bavueza Tongi</h3>
                    <p className="text-sm text-white/90">Président d&apos;AMAKI France</p>
                    <p className="text-xs text-white/80 mt-1">Élu le 29 novembre 2025</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Bouton retour */}
      <section className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/amicale">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l&apos;amicale
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
