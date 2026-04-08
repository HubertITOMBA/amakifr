"use client";

import { useEffect, useState } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Loader2, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface InterviewSection {
  title: string;
  content: string;
}

export default function PresidentMastorInterviewPage() {
  const [interviewContent, setInterviewContent] = useState<InterviewSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/president-mastor-interview")
      .then(async (res) => {
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          throw new Error(`Erreur HTTP ${res.status}`);
        }
        if (!contentType.includes("application/json")) {
          // Typiquement une page HTML (redirect vers /auth/sign-in ou page d'erreur Next)
          throw new Error("Réponse inattendue (non JSON). Vérifiez l'accès public à l'API.");
        }
        const raw = await res.text();
        try {
          return JSON.parse(raw);
        } catch {
          // Évite le crash "Unexpected token '<'" et affiche un message exploitable
          const start = raw.slice(0, 80).replace(/\s+/g, " ").trim();
          throw new Error(`Réponse JSON invalide. Début de réponse: "${start}"`);
        }
      })
      .then((data) => {
        if (data?.success && data?.sections) {
          setInterviewContent(data.sections);
        } else {
          setError(data?.error || "Erreur lors du chargement");
        }
      })
      .catch((err) => {
        console.error("Erreur:", err);
        setError(err?.message || "Impossible de charger l'interview");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />

      {/* Hero Section avec photo en arrière-plan */}
      <section className="relative py-16 sm:py-20 md:py-24 lg:py-32 overflow-hidden min-h-[60vh]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/Mastor_bebe.jpeg"
            alt="Albert Bébé Lukombo (Mastor) - Premier président AMAKI France"
            fill
            className="object-cover object-center brightness-110 contrast-105 saturate-110"
            priority
            quality={90}
            sizes="100vw"
          />
          {/* Photo sombre -> overlays plus “doux” + lisibilité texte */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/75" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/35 via-slate-900/10 to-transparent" />
          <div className="absolute inset-0 bg-white/5" />
        </div>

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
              Entretien avec le Président sortant
            </h1>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white/90 mb-3 drop-shadow-md">
              Monsieur Albert Bébé Lukombo (Mastor)
            </h2>
            <div className="flex items-center justify-center gap-2 text-white/80">
              <Calendar className="h-5 w-5" />
              <span className="text-lg sm:text-xl">Premier président, membre fondateur d&apos;AMAKI France</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu de l'interview */}
      <section className="relative z-10 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-white via-slate-50/60 to-white dark:from-slate-900 dark:via-slate-950/20 dark:to-slate-900 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="flex-1 max-w-4xl">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-200" />
                </div>
              ) : error ? (
                <Card className="p-8 text-center">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                  <p className="text-sm text-muted-foreground mt-2">L&apos;interview sera bientôt disponible.</p>
                </Card>
              ) : interviewContent.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Le contenu de l&apos;interview est en cours de préparation.</p>
                </Card>
              ) : (
                <div className="space-y-10 sm:space-y-14 md:space-y-16">
                  {interviewContent.map((section, index) => {
                    const featuredRubriques = [
                      "Un parcours guidé par le sens du collectif",
                      "Structurer et bâtir",
                      "Une association en pleine évolution",
                      "Des réalisations concrètes",
                      "Des défis formateurs",
                      "Une aventure humaine",
                      "Passer le relais",
                      "Regard vers l’avenir",
                    ];
                    const featuredIndex = featuredRubriques.findIndex((t) =>
                      section.title.toLowerCase().includes(t.toLowerCase())
                    );
                    const isFeatured = featuredIndex >= 0;

                    const isIntro = section.title.toLowerCase().includes("entretien avec le président sortant");

                    const featuredStyles = [
                      {
                        gradient: "from-blue-600 via-indigo-600 to-blue-700",
                        bg: "from-blue-200 via-indigo-200 to-blue-100 dark:from-blue-900/80 dark:via-indigo-900/70 dark:to-blue-900/60",
                        border: "border-blue-400 dark:border-blue-500",
                        shadow: "shadow-blue-200 dark:shadow-blue-900",
                      },
                      {
                        gradient: "from-indigo-600 via-purple-600 to-indigo-700",
                        bg: "from-indigo-200 via-purple-200 to-indigo-100 dark:from-indigo-900/80 dark:via-purple-900/70 dark:to-indigo-900/60",
                        border: "border-indigo-400 dark:border-indigo-500",
                        shadow: "shadow-indigo-200 dark:shadow-indigo-900",
                      },
                      {
                        gradient: "from-emerald-600 via-teal-600 to-emerald-700",
                        bg: "from-emerald-200 via-teal-200 to-emerald-100 dark:from-emerald-900/80 dark:via-teal-900/70 dark:to-emerald-900/60",
                        border: "border-emerald-400 dark:border-emerald-500",
                        shadow: "shadow-emerald-200 dark:shadow-emerald-900",
                      },
                      {
                        gradient: "from-amber-500 via-orange-600 to-amber-600",
                        bg: "from-amber-200 via-orange-200 to-amber-100 dark:from-amber-900/80 dark:via-orange-900/70 dark:to-amber-900/60",
                        border: "border-amber-400 dark:border-amber-500",
                        shadow: "shadow-amber-200 dark:shadow-amber-900",
                      },
                      {
                        gradient: "from-rose-600 via-pink-600 to-rose-700",
                        bg: "from-rose-200 via-pink-200 to-rose-100 dark:from-rose-900/80 dark:via-pink-900/70 dark:to-rose-900/60",
                        border: "border-rose-400 dark:border-rose-500",
                        shadow: "shadow-rose-200 dark:shadow-rose-900",
                      },
                      {
                        gradient: "from-slate-700 via-slate-800 to-slate-900",
                        bg: "from-slate-200 via-slate-100 to-white dark:from-slate-800/80 dark:via-slate-900/70 dark:to-slate-900/60",
                        border: "border-slate-300 dark:border-slate-600",
                        shadow: "shadow-slate-200 dark:shadow-slate-900",
                      },
                      {
                        gradient: "from-purple-600 via-fuchsia-600 to-purple-700",
                        bg: "from-purple-200 via-fuchsia-200 to-purple-100 dark:from-purple-900/80 dark:via-fuchsia-900/70 dark:to-purple-900/60",
                        border: "border-purple-400 dark:border-purple-500",
                        shadow: "shadow-purple-200 dark:shadow-purple-900",
                      },
                      {
                        gradient: "from-teal-600 via-cyan-600 to-teal-700",
                        bg: "from-teal-200 via-cyan-200 to-teal-100 dark:from-teal-900/80 dark:via-cyan-900/70 dark:to-teal-900/60",
                        border: "border-teal-400 dark:border-teal-500",
                        shadow: "shadow-teal-200 dark:shadow-teal-900",
                      },
                    ];

                    const style = isFeatured
                      ? featuredStyles[Math.min(featuredIndex, featuredStyles.length - 1)]
                      : {
                          gradient: "from-slate-600 to-slate-700",
                          bg: "bg-white dark:bg-slate-900",
                          border: "border-slate-200 dark:border-slate-700",
                          shadow: "",
                        };

                    return (
                      <article
                        key={index}
                        className={isFeatured ? `rounded-2xl overflow-hidden border-2 ${style.border} shadow-2xl ${style.shadow}` : ""}
                      >
                        {!isIntro && (
                          <div className={`bg-gradient-to-r ${style.gradient} px-4 sm:px-6 py-3 sm:py-4 ${isFeatured ? "py-4 sm:py-5 md:py-6" : ""}`}>
                            <h2
                              className={`font-bold text-white drop-shadow-md ${
                                isFeatured
                                  ? "text-base sm:text-lg md:text-xl lg:text-2xl tracking-tight leading-tight"
                                  : "text-sm sm:text-base md:text-lg"
                              }`}
                            >
                              {section.title}
                            </h2>
                          </div>
                        )}

                        <div
                          className={`p-6 sm:p-8 md:p-10 ${
                            isIntro
                              ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
                              : isFeatured
                                ? `bg-gradient-to-br ${style.bg}`
                                : "bg-white dark:bg-slate-900"
                          }`}
                        >
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

                                const specificQuestions = [
                                  "Quelles sont les valeurs que vous souhaitez incarner",
                                  "Quels sont les projets prioritaires que vous souhaitez mettre",
                                  "Quelle est votre ambition pour l'association",
                                  "Quelle est votre vision",
                                  "Quels sont vos projets",
                                  "Quelles sont vos motivations",
                                  "Comment voyez-vous",
                                  "Quel est votre message",
                                ];

                                const questionBlockClass =
                                  "mb-4 mt-6 first:mt-0 py-3 px-4 rounded-lg border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 text-sm sm:text-base font-semibold leading-snug";
                                const answerBlockClass =
                                  "mb-4 py-3 px-4 rounded-lg border-l-2 border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed";

                                processed = processed.replace(/<p class="question-text">(.*?)<\/p>/gi, (match, content) => {
                                  const key = `Q_MARKED_${content}`;
                                  if (markers.has(key)) return match;
                                  markers.add(key);
                                  return `<div class="${questionBlockClass}">${content}</div>`;
                                });

                                specificQuestions.forEach((qPattern) => {
                                  const escapedPattern = qPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                  const regex = new RegExp(`(<p[^>]*>.*?${escapedPattern}[^<]*?</p>)`, "gi");
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

                                processed = processed.replace(/<p[^>]*>([^<]*\?[^<]*)<\/p>/gi, (match, content) => {
                                  if (match.includes(questionBlockClass)) return match;
                                  const key = `Q_${content}`;
                                  if (markers.has(key)) return match;
                                  markers.add(key);
                                  return `<div class="${questionBlockClass}">${content}</div>`;
                                });

                                processed = processed.replace(/<(strong|b)[^>]*>([^<]*Qu[^<]*\?[^<]*)<\/(strong|b)>/gi, (match, tag, content) => {
                                  const key = `Q_STRONG_${content}`;
                                  if (markers.has(key)) return match;
                                  markers.add(key);
                                  return `<div class="${questionBlockClass}">${content}</div>`;
                                });

                                const questionStarters = ["Pouvez-vous", "Qu'est-ce", "Quelles", "Quels", "Quelle", "Comment", "Quel"];
                                questionStarters.forEach((starter) => {
                                  const regex = new RegExp(`<p[^>]*>(${starter}[^<]*?)</p>`, "gi");
                                  processed = processed.replace(regex, (match, content) => {
                                    if (match.includes(questionBlockClass)) return match;
                                    const key = `Q_STARTER_${content}`;
                                    if (markers.has(key)) return match;
                                    markers.add(key);
                                    return `<div class="${questionBlockClass}">${content}</div>`;
                                  });
                                });

                                processed = processed.replace(/<p[^>]*>([^<]+?)<\/p>/gi, (match, content) => {
                                  if (match.includes(questionBlockClass) || match.includes(answerBlockClass)) return match;
                                  if (!content.trim()) return match;
                                  if (content.includes("?") || specificQuestions.some((q) => content.toLowerCase().includes(q.toLowerCase())))
                                    return match;
                                  return `<div class="${answerBlockClass}">${content}</div>`;
                                });

                                return processed;
                              })(),
                            }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
              <div className="sticky top-24">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                  <div className="aspect-[3/4] relative">
                    <Image
                      src="/images/Mastor_bebe.jpeg"
                      alt="Albert Bébé Lukombo (Mastor) - Premier président AMAKI France"
                      fill
                      className="object-cover brightness-105 contrast-105 saturate-110"
                      sizes="(max-width: 1024px) 0vw, 384px"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-xl font-bold mb-1">Albert Bébé Lukombo</h3>
                    <p className="text-sm text-white/90">Premier président, membre fondateur d&apos;AMAKI France</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/amicale">
            <Button size="lg" className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white">
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

