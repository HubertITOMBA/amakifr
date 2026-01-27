"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/admin/MetricCard";
import { TrendChart } from "@/components/admin/TrendChart";
import { AlertCard } from "@/components/admin/AlertCard";
import {
  Users,
  Calendar,
  Euro,
  TrendingUp,
  FileText,
  Lightbulb,
  Vote,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Download,
  Printer,
} from "lucide-react";
import { getAnalyticsDashboard } from "@/actions/analytics";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { isAuthorizationError } from "@/lib/utils";

type Period = "week" | "month" | "quarter" | "year";

export default function AnalyticsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAnalyticsDashboard(period);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        // Ne pas afficher de toast pour les erreurs d'autorisation (l'utilisateur n'a simplement pas accès à cette fonctionnalité)
        if (result.error && !isAuthorizationError(result.error)) {
          toast.error(result.error || "Erreur lors du chargement des données");
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      // Ne pas afficher de toast pour les erreurs d'autorisation
      const errorMessage = error instanceof Error ? error.message : "Erreur lors du chargement des données";
      if (!isAuthorizationError(errorMessage)) {
        toast.error("Erreur lors du chargement des données");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600 dark:text-gray-300">Aucune donnée disponible</p>
            <Button onClick={loadData} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Préparer les alertes
  const alertes = [
    ...data.alertes.adherentsRetard.map((a: any) => ({
      id: a.id,
      type: "adherent" as const,
      title: a.nom,
      description: "Cotisation en retard depuis plus de 3 mois",
      link: `/admin/users/${a.id}/consultation`,
    })),
    ...data.alertes.evenementsPeuInscriptions.map((e: any) => ({
      id: e.id,
      type: "evenement" as const,
      title: e.titre,
      description: "Peu d'inscriptions",
      count: e.inscriptions,
      link: `/admin/evenements/${e.id}/consultation`,
    })),
    ...data.alertes.electionsLimite.map((e: any) => ({
      id: e.id,
      type: "election" as const,
      title: e.titre,
      description: "Date limite de candidature approchant",
                      date: e.dateLimite ? new Date(e.dateLimite) : undefined,
      link: `/admin/elections/${e.id}/consultation`,
    })),
  ];

  // Préparer les données pour les graphiques
  const evolutionAdherents = data.evolutions.adherents.map((item: any) => ({
    mois: item.mois,
    total: item.total,
  }));

  const evolutionEvenements = data.evolutions.evenements.map((item: any) => ({
    mois: item.mois,
    total: item.total,
  }));

  const evolutionFinances = data.evolutions.finances.map((item: any) => ({
    mois: item.mois,
    revenus: Number(item.revenus.toFixed(2)),
    depenses: Number(item.depenses.toFixed(2)),
  }));

  const evolutionCotisations = data.evolutions.cotisations.map((item: any) => ({
    mois: item.mois,
    montant: Number(item.montant.toFixed(2)),
  }));

  const periodLabels: Record<Period, string> = {
    week: "7 derniers jours",
    month: "Ce mois",
    quarter: "Ce trimestre",
    year: "Cette année",
  };

  const handleExportPDF = async () => {
    if (!data) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      toast.loading("Génération du PDF en cours...");
      const { default: jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;
      const { addPDFHeader, addPDFFooter } = await import("@/lib/pdf-helpers-client");

      const doc = new jsPDF("l", "mm", "a4"); // Format paysage
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // En-tête
      await addPDFHeader(doc, "Dashboard Analytique - AMAKI France");
      let yPos = 50;

      // Date de génération
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Généré le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })} - Période: ${periodLabels[period]}`,
        pageWidth - 20,
        yPos,
        { align: "right" }
      );
      yPos += 15;

      // Fonction helper pour ajouter du texte
      const addTextSection = (title: string, texts: string[]) => {
        if (yPos > pageHeight - 40) {
          doc.addPage("l"); // Nouvelle page en paysage
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.text(title, 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        texts.forEach((text) => {
          if (yPos > pageHeight - 30) {
            doc.addPage("l"); // Nouvelle page en paysage
            yPos = 20;
          }
          // Découper le texte si trop long
          const maxWidth = pageWidth - 40;
          const lines = doc.splitTextToSize(text, maxWidth);
          lines.forEach((line: string) => {
            if (yPos > pageHeight - 30) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 7;
          });
        });
        yPos += 5;
        return yPos;
      };

      // Fonction helper pour capturer et ajouter une section
      const captureAndAddSection = async (selector: string, title: string, fallbackText: string[]) => {
        const element = document.querySelector(selector) as HTMLElement;
        
        // Si l'élément n'existe pas, utiliser le fallback texte
        if (!element) {
          return addTextSection(title, fallbackText);
        }

        try {
          // Scroller vers l'élément pour s'assurer qu'il est visible
          element.scrollIntoView({ behavior: "instant", block: "start" });
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Pour les graphiques, forcer le rendu et attendre plus longtemps
          if (selector.includes('charts')) {
            // Forcer le rendu des graphiques en déclenchant un resize
            const charts = element.querySelectorAll('.recharts-wrapper, [class*="recharts"]');
            charts.forEach((chart: any) => {
              if (chart && typeof window !== 'undefined') {
                // Déclencher un événement resize pour forcer le rendu
                window.dispatchEvent(new Event('resize'));
              }
            });
            
            // Attendre que les graphiques soient complètement rendus
            await new Promise((resolve) => setTimeout(resolve, 2000));
            
            // Vérifier que les SVG sont bien rendus
            const svgs = element.querySelectorAll('svg');
            if (svgs.length > 0) {
              // Attendre encore un peu pour les animations
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Vérifier que les graphiques sont bien rendus avant capture
          if (selector.includes('charts')) {
            const svgs = element.querySelectorAll('svg');
            const rechartsWrappers = element.querySelectorAll('.recharts-wrapper');
            
            // Vérifier que les SVG ont du contenu
            let allRendered = true;
            svgs.forEach((svg: any) => {
              const rect = svg.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) {
                allRendered = false;
              }
              // Vérifier qu'il y a des éléments enfants (lignes, barres, etc.)
              const hasContent = svg.querySelector('path, line, rect, circle') !== null;
              if (!hasContent) {
                allRendered = false;
              }
            });
            
            if (!allRendered) {
              console.warn('Les graphiques ne sont pas complètement rendus, attente supplémentaire...');
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          const canvas = await html2canvas(element, {
            backgroundColor: "#ffffff",
            scale: 2, // Scale augmenté pour meilleure qualité
            logging: false, // Désactiver les logs en production
            useCORS: true,
            allowTaint: false,
            removeContainer: false,
            foreignObjectRendering: true, // Important pour SVG
            imageTimeout: 15000, // Timeout augmenté pour les images
            onclone: (clonedDoc, clonedElement) => {
              // S'assurer que tous les éléments SVG sont visibles et bien positionnés
              const svgs = clonedDoc.querySelectorAll('svg');
              svgs.forEach((svg: any) => {
                svg.style.visibility = 'visible';
                svg.style.display = 'block';
                svg.style.opacity = '1';
                svg.style.position = 'relative';
                svg.style.width = 'auto';
                svg.style.height = 'auto';
                
                // Forcer la largeur et hauteur si nécessaire
                const rect = svg.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  if (!svg.getAttribute('width') || svg.getAttribute('width') === '0') {
                    svg.setAttribute('width', rect.width.toString());
                  }
                  if (!svg.getAttribute('height') || svg.getAttribute('height') === '0') {
                    svg.setAttribute('height', rect.height.toString());
                  }
                }
                
                // S'assurer que le viewBox est défini
                if (!svg.getAttribute('viewBox') && rect.width > 0 && rect.height > 0) {
                  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
                }
              });
              
              // S'assurer que les canvas sont visibles
              const canvases = clonedDoc.querySelectorAll('canvas');
              canvases.forEach((canvas: any) => {
                canvas.style.visibility = 'visible';
                canvas.style.display = 'block';
                canvas.style.opacity = '1';
              });
              
              // S'assurer que les conteneurs Recharts sont visibles
              const rechartsWrappers = clonedDoc.querySelectorAll('.recharts-wrapper, [class*="recharts"]');
              rechartsWrappers.forEach((wrapper: any) => {
                wrapper.style.visibility = 'visible';
                wrapper.style.display = 'block';
                wrapper.style.opacity = '1';
                wrapper.style.width = '100%';
                wrapper.style.height = 'auto';
              });
              
              // S'assurer que ResponsiveContainer est visible
              const responsiveContainers = clonedDoc.querySelectorAll('[class*="ResponsiveContainer"]');
              responsiveContainers.forEach((container: any) => {
                container.style.visibility = 'visible';
                container.style.display = 'block';
                container.style.opacity = '1';
              });
            },
          });

          if (canvas.width === 0 || canvas.height === 0) {
            throw new Error("Canvas vide");
          }

          const imgData = canvas.toDataURL("image/png", 1.0); // PNG pour meilleure qualité des graphiques
          const imgWidth = pageWidth - 40;
          const imgHeight = Math.min((canvas.height * imgWidth) / canvas.width, pageHeight - 50); // Limiter la hauteur

          // Ajouter le titre
          if (yPos > pageHeight - 40) {
            doc.addPage("l"); // Nouvelle page en paysage
            yPos = 20;
          }
          doc.setFontSize(14);
          doc.setTextColor(37, 99, 235);
          doc.setFont("helvetica", "bold");
          doc.text(title, 20, yPos);
          yPos += 10;

          // Vérifier si on a besoin d'une nouvelle page
          if (yPos + imgHeight > pageHeight - 30) {
            doc.addPage("l"); // Nouvelle page en paysage
            yPos = 20;
          }

          doc.addImage(imgData, "PNG", 20, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (error) {
          console.error(`Erreur lors de la capture de ${selector}:`, error);
          // Fallback sur le texte si la capture échoue
          return addTextSection(title, fallbackText);
        }

        return yPos;
      };

      // Statistiques textuelles comme fallback
      const statsText = [
        `Adhérents: Total ${data.adherents.totalActifs + data.adherents.totalInactifs} (Actifs: ${data.adherents.totalActifs}, Inactifs: ${data.adherents.totalInactifs})`,
        `Événements: Total ${data.evenements.total} (Publiés: ${data.evenements.publies}, Inscriptions: ${data.evenements.totalInscriptions})`,
        `Cotisations: Taux ${data.cotisations.tauxCotisation}% (En retard: ${data.cotisations.adherentsEnRetard}, Dettes: ${data.cotisations.totalDettes.toFixed(2)} €)`,
        `Finances: Revenus ${data.finances.totalRevenus.toFixed(2)} € | Dépenses ${data.finances.totalDepenses.toFixed(2)} € | Solde ${data.finances.solde.toFixed(2)} €`,
        `Idées: Total ${data.idees.total} (Cette période: ${data.idees.ideesPeriode})`,
        `Documents: Total ${data.documents.total} (Cette période: ${data.documents.documentsPeriode})`,
        `Élections: Total ${data.elections.total} (Ouvertes: ${data.elections.ouvertes})`,
      ];

      // Capturer les métriques principales
      yPos = await captureAndAddSection(
        '[data-metrics-container]',
        "Métriques Principales",
        statsText.slice(0, 4)
      );

      // Capturer les métriques secondaires
      yPos = await captureAndAddSection(
        '[data-metrics-secondary-container]',
        "Métriques Secondaires",
        statsText.slice(4)
      );

      // Capturer les graphiques (pas de fallback texte pour les graphiques)
      yPos = await captureAndAddSection(
        '[data-charts-container]',
        "Évolutions et Tendances",
        ["Graphiques d'évolution disponibles dans l'interface web"]
      );

      // Capturer Top Événements et Alertes
      const topEventsText = data.topEvenements.length > 0
        ? data.topEvenements.map((e: any, i: number) => 
            `${i + 1}. ${e.titre} - ${e.inscriptions} inscription(s)`
          )
        : ["Aucun événement pour le moment"];
      
      const alertsText = alertes.length > 0
        ? alertes.slice(0, 5).map((a: any) => `${a.title}: ${a.description}`)
        : ["Aucune alerte"];

      yPos = await captureAndAddSection(
        '[data-top-events-container]',
        "Top Événements et Alertes",
        [...topEventsText, ...alertsText]
      );

      // Capturer le résumé financier
      const financialText = [
        `Revenus Totaux: ${data.finances.totalRevenus.toFixed(2)} € (${data.finances.evolutionRevenus >= 0 ? "+" : ""}${data.finances.evolutionRevenus.toFixed(1)}%)`,
        `Dépenses Totales: ${data.finances.totalDepenses.toFixed(2)} € (${data.finances.evolutionDepenses >= 0 ? "+" : ""}${data.finances.evolutionDepenses.toFixed(1)}%)`,
        `Solde Période: ${data.finances.solde >= 0 ? "+" : ""}${data.finances.solde.toFixed(2)} €`,
      ];

      yPos = await captureAndAddSection(
        '[data-financial-container]',
        "Résumé Financier",
        financialText
      );

      // Footer
      addPDFFooter(doc);

      // Sauvegarder
      doc.save(`dashboard-analytics-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF généré avec succès");
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
          .print-avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-blue-600" />
                Dashboard Analytique
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
                Vue d'ensemble complète de l'activité de l'association
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">7 derniers jours</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="quarter">Ce trimestre</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadData} variant="outline" size="sm" className="no-print">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                size="sm"
                className="bg-white dark:bg-gray-800 no-print"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={handlePrint}
                size="sm"
                className="bg-white dark:bg-gray-800 no-print"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            </div>
          </div>
        </div>

        {/* Métriques principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8" data-metrics-container>
          <MetricCard
            title="Adhérents Actifs"
            value={data.adherents.totalActifs}
            change={data.adherents.evolution}
            changeLabel={`vs ${periodLabels[period]}`}
            icon={Users}
            color="blue"
            description={`${data.adherents.totalInactifs} inactifs`}
          />
          <MetricCard
            title="Taux de Cotisation"
            value={`${data.cotisations.tauxCotisation}%`}
            change={data.cotisations.evolution}
            changeLabel={`vs ${periodLabels[period]}`}
            icon={Euro}
            color="green"
            description={`${data.cotisations.adherentsEnRetard} en retard`}
          />
          <MetricCard
            title="Participation Événements"
            value={`${data.evenements.tauxParticipation}%`}
            change={data.evenements.evolution}
            changeLabel={`vs ${periodLabels[period]}`}
            icon={Calendar}
            color="purple"
            description={`${data.evenements.totalInscriptions} inscriptions`}
          />
          <MetricCard
            title="Engagement Global"
            value={data.engagement.totalActions}
            icon={TrendingUp}
            color="indigo"
            description={`${data.engagement.documentsUploades} docs, ${data.engagement.votesEffectues} votes`}
          />
        </div>

        {/* Métriques secondaires */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8" data-metrics-secondary-container>
          <MetricCard
            title="Événements"
            value={data.evenements.total}
            change={data.evenements.evolution}
            icon={Calendar}
            color="purple"
            description={`${data.evenements.publies} publiés`}
          />
          <MetricCard
            title="Idées Soumises"
            value={data.idees.total}
            change={data.idees.evolution}
            icon={Lightbulb}
            color="amber"
            description={`${data.idees.ideesPeriode} cette période`}
          />
          <MetricCard
            title="Documents"
            value={data.documents.total}
            change={data.documents.evolution}
            icon={FileText}
            color="indigo"
            description={`${data.documents.documentsPeriode} cette période`}
          />
          <MetricCard
            title="Élections"
            value={data.elections.total}
            change={data.elections.evolution}
            icon={Vote}
            color="blue"
            description={`${data.elections.ouvertes} ouvertes`}
          />
        </div>

        {/* Graphiques de tendances */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" data-charts-container>
          <TrendChart
            title="Évolution des Adhérents (12 mois)"
            data={evolutionAdherents}
            type="line"
            dataKeys={[
              { key: "total", name: "Total adhérents", color: "#3b82f6" },
            ]}
            icon={Users}
            color="blue"
          />
          <TrendChart
            title="Évolution des Événements (12 mois)"
            data={evolutionEvenements}
            type="bar"
            dataKeys={[
              { key: "total", name: "Événements", color: "#a855f7" },
            ]}
            icon={Calendar}
            color="purple"
          />
          <TrendChart
            title="Évolution Financière (12 mois)"
            data={evolutionFinances}
            type="line"
            dataKeys={[
              { key: "revenus", name: "Revenus", color: "#10b981" },
              { key: "depenses", name: "Dépenses", color: "#ef4444" },
            ]}
            icon={Euro}
            color="green"
          />
          <TrendChart
            title="Évolution des Cotisations (12 mois)"
            data={evolutionCotisations}
            type="bar"
            dataKeys={[
              { key: "montant", name: "Montant (€)", color: "#10b981" },
            ]}
            icon={Euro}
            color="green"
          />
        </div>

        {/* Alertes et Top Événements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" data-top-events-container>
          <div data-alerts-container>
            <AlertCard
              alerts={alertes}
              title="Alertes Automatiques"
              icon={AlertTriangle}
              color="red"
            />
          </div>
          <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 dark:text-indigo-400" />
                <span>Top 5 Événements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3">
                {data.topEvenements.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Aucun événement pour le moment
                  </p>
                ) : (
                  data.topEvenements.map((event: any, index: number) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {event.titre}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(event.dateDebut), "dd MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {event.inscriptions}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          inscrits
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Résumé financier */}
        <Card className="!py-0 border-2 border-green-200 dark:border-green-800/50 bg-white dark:bg-gray-900" data-financial-container>
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
              <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400" />
              <span>Résumé Financier</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Revenus Totaux</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.finances.totalRevenus.toFixed(2)} €
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.finances.evolutionRevenus >= 0 ? "+" : ""}
                  {data.finances.evolutionRevenus.toFixed(1)}% vs {periodLabels[period]}
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Dépenses Totales</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.finances.totalDepenses.toFixed(2)} €
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.finances.evolutionDepenses >= 0 ? "+" : ""}
                  {data.finances.evolutionDepenses.toFixed(1)}% vs {periodLabels[period]}
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Solde Période</p>
                <p
                  className={`text-2xl font-bold ${
                    data.finances.solde >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {data.finances.solde >= 0 ? "+" : ""}
                  {data.finances.solde.toFixed(2)} €
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {periodLabels[period]}
                </p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Dettes Totales</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {data.cotisations.totalDettes.toFixed(2)} €
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.cotisations.adherentsEnRetard} adhérents en retard
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}

