"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  MapPin, 
  Clock,
  Users,
  Euro,
  Mail,
  Phone,
  Tag,
  ArrowLeft,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Copy,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Edit,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Download,
  FileText,
  QrCode,
  CalendarPlus,
  Map as MapIcon,
  User,
  MessageSquare,
  X,
  Plus,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { 
  getEvenementById, 
  inscrireEvenement,
  inscrireVisiteurEvenement,
  getPublicEvenements,
  getAdherentsForEvent,
  addParticipantToEvent,
  removeParticipantFromEvent,
  type EvenementData 
} from "@/actions/evenements";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Composant carte chargé dynamiquement (pas de SSR)
const MapComponent = dynamic(
  () => import("@/components/evenements/map-component") as any,
  { ssr: false }
);

// Composant QR Code chargé dynamiquement
const QRCodeComponent = dynamic(
  () => import("@/components/evenements/qr-code-component") as any,
  { ssr: false }
);

interface InscriptionFormData {
  nombrePersonnes: number;
  commentaires: string;
}

interface InscriptionVisiteurFormData {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  nombrePersonnes: number;
  commentaires: string;
}

export default function EvenementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const evenementId = params?.id as string;

  const [evenement, setEvenement] = useState<EvenementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInscriptionModal, setShowInscriptionModal] = useState(false);
  const [inscriptionLoading, setInscriptionLoading] = useState(false);
  const [inscriptionData, setInscriptionData] = useState<InscriptionFormData>({
    nombrePersonnes: 1,
    commentaires: "",
  });
  const [inscriptionVisiteurData, setInscriptionVisiteurData] = useState<InscriptionVisiteurFormData>({
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    nombrePersonnes: 1,
    commentaires: "",
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [adherents, setAdherents] = useState<any[]>([]);
  const [loadingAdherents, setLoadingAdherents] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<string>("");
  const [nombrePersonnes, setNombrePersonnes] = useState(1);
  const [commentairesParticipant, setCommentairesParticipant] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<EvenementData[]>([]);

  const categories = [
    { value: "General", label: "Général", color: "bg-blue-100 text-blue-800" },
    { value: "Formation", label: "Formation", color: "bg-purple-100 text-purple-800" },
    { value: "Social", label: "Social", color: "bg-green-100 text-green-800" },
    { value: "Sportif", label: "Sportif", color: "bg-orange-100 text-orange-800" },
    { value: "Culturel", label: "Culturel", color: "bg-pink-100 text-pink-800" },
  ];

  useEffect(() => {
    if (evenementId) {
      loadEvenement();
    }
  }, [evenementId]);

  useEffect(() => {
    if (evenement) {
      loadSimilarEvents();
    }
  }, [evenement]);

  const loadEvenement = async () => {
    try {
      setLoading(true);
      const result = await getEvenementById(evenementId);
      if (result.success && result.data) {
        setEvenement(result.data as EvenementData);
      } else {
        toast.error(result.error || "Événement non trouvé");
        router.push("/evenements");
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'événement:", error);
      toast.error("Erreur lors du chargement de l'événement");
      router.push("/evenements");
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedAdherent) {
      toast.error("Veuillez sélectionner un adhérent");
      return;
    }

    if (nombrePersonnes < 1) {
      toast.error("Le nombre de personnes doit être au moins 1");
      return;
    }

    setAddingParticipant(true);
    try {
      const result = await addParticipantToEvent(
        evenementId,
        selectedAdherent,
        nombrePersonnes,
        commentairesParticipant || undefined
      );

      if (result.success) {
        toast.success("Participant ajouté avec succès");
        setShowAddParticipantModal(false);
        setSelectedAdherent("");
        setNombrePersonnes(1);
        setCommentairesParticipant("");
        loadEvenement();
      } else {
        toast.error(result.error || "Erreur lors de l'ajout du participant");
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du participant:", error);
      toast.error("Erreur lors de l'ajout du participant");
    } finally {
      setAddingParticipant(false);
    }
  };

  const loadSimilarEvents = async () => {
    if (!evenement) return;
    
    try {
      const result = await getPublicEvenements();
      if (result.success && result.data) {
        // Filtrer les événements similaires (même catégorie, exclure l'événement actuel)
        const similar = (result.data as EvenementData[])
          .filter(e => e.id !== evenement.id && e.categorie === evenement.categorie)
          .slice(0, 3);
        setSimilarEvents(similar);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des événements similaires:", error);
    }
  };

  const handleInscription = async () => {
    if (!evenement) return;

    // Si l'utilisateur est connecté, utiliser la fonction d'inscription normale
    if (session) {
      if (inscriptionData.nombrePersonnes < 1) {
        toast.error("Le nombre de personnes doit être au moins 1");
        return;
      }

      // Vérifier les places disponibles
      if (evenement.placesDisponibles) {
        const placesRestantes = evenement.placesDisponibles - evenement.placesReservees;
        if (inscriptionData.nombrePersonnes > placesRestantes) {
          toast.error(`Il ne reste que ${placesRestantes} place(s) disponible(s)`);
          return;
        }
      }

      try {
        setInscriptionLoading(true);
        const result = await inscrireEvenement({
          evenementId: evenement.id,
          nombrePersonnes: inscriptionData.nombrePersonnes,
          commentaires: inscriptionData.commentaires,
        });

        if (result.success) {
          toast.success("Inscription réussie !");
          setShowInscriptionModal(false);
          setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
          loadEvenement(); // Recharger pour mettre à jour les places
        } else {
          toast.error(result.error || "Erreur lors de l'inscription");
        }
      } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        toast.error("Erreur lors de l'inscription");
      } finally {
        setInscriptionLoading(false);
      }
    } else {
      // Si l'utilisateur n'est pas connecté, utiliser la fonction d'inscription visiteur
      if (!inscriptionVisiteurData.nom.trim()) {
        toast.error("Le nom est requis");
        return;
      }
      if (!inscriptionVisiteurData.email.trim()) {
        toast.error("L'email est requis");
        return;
      }
      if (!inscriptionVisiteurData.telephone.trim()) {
        toast.error("Le téléphone est requis");
        return;
      }
      if (!inscriptionVisiteurData.adresse.trim()) {
        toast.error("L'adresse est requise");
        return;
      }
      if (inscriptionVisiteurData.nombrePersonnes < 1) {
        toast.error("Le nombre de personnes doit être au moins 1");
        return;
      }

      // Vérifier les places disponibles
      if (evenement.placesDisponibles) {
        const placesRestantes = evenement.placesDisponibles - evenement.placesReservees;
        if (inscriptionVisiteurData.nombrePersonnes > placesRestantes) {
          toast.error(`Il ne reste que ${placesRestantes} place(s) disponible(s)`);
          return;
        }
      }

      try {
        setInscriptionLoading(true);
        const result = await inscrireVisiteurEvenement({
          evenementId: evenement.id,
          nom: inscriptionVisiteurData.nom,
          email: inscriptionVisiteurData.email,
          telephone: inscriptionVisiteurData.telephone,
          adresse: inscriptionVisiteurData.adresse,
          nombrePersonnes: inscriptionVisiteurData.nombrePersonnes,
          commentaires: inscriptionVisiteurData.commentaires,
        });

        if (result.success) {
          toast.success(result.message || "Votre inscription a été enregistrée avec succès !");
          setShowInscriptionModal(false);
          setInscriptionVisiteurData({
            nom: "",
            email: "",
            telephone: "",
            adresse: "",
            nombrePersonnes: 1,
            commentaires: "",
          });
          loadEvenement(); // Recharger pour mettre à jour les places
        } else {
          toast.error(result.error || "Erreur lors de l'inscription");
        }
      } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        toast.error("Erreur lors de l'inscription");
      } finally {
        setInscriptionLoading(false);
      }
    }
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = evenement?.titre || "";
    const text = evenement?.description || "";

    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast.success("Lien copié dans le presse-papiers !");
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      window.open(shareUrls[platform as keyof typeof shareUrls], "_blank", "width=600,height=400");
    }
  };

  const handleAddToCalendar = () => {
    if (!evenement) return;

    const startDate = new Date(evenement.dateDebut).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = evenement.dateFin 
      ? new Date(evenement.dateFin).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      : new Date(new Date(evenement.dateDebut).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const location = evenement.adresse 
      ? `${evenement.lieu || ''}, ${evenement.adresse}`.trim()
      : evenement.lieu || '';

    const description = `${evenement.description}\n\n${evenement.contenu || ''}\n\n${window.location.href}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AMAKI France//Event Calendar//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${evenement.id}@amaki.fr`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${evenement.titre}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      location ? `LOCATION:${location}` : '',
      `URL:${window.location.href}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${evenement.titre.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Ajouté à votre calendrier !");
  };

  const handleExportPDF = async () => {
    if (!evenement) return;

    try {
      // Import dynamique de jsPDF et des helpers
      const { default: jsPDF } = await import('jspdf');
      const { addPDFHeader, addPDFFooter } = await import('@/lib/pdf-helpers-client');
      const doc = new jsPDF();
      
      // Ajouter l'en-tête avec logo sur la première page uniquement
      await addPDFHeader(doc, evenement.titre);
      
      let yPos = 60; // Commencer après l'en-tête
      
      // Catégorie et statut
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Catégorie: ${categorieInfo?.label || evenement.categorie}`, 20, yPos);
      yPos += 8;
      
      // Description
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      const descriptionLines = doc.splitTextToSize(evenement.description, 170);
      doc.text(descriptionLines, 20, yPos);
      yPos += descriptionLines.length * 7 + 5;
      
      // Dates
      doc.setFontSize(12);
      doc.text(`Date de début: ${new Date(evenement.dateDebut).toLocaleString('fr-FR')}`, 20, yPos);
      yPos += 8;
      if (evenement.dateFin) {
        doc.text(`Date de fin: ${new Date(evenement.dateFin).toLocaleString('fr-FR')}`, 20, yPos);
        yPos += 8;
      }
      
      // Lieu
      if (evenement.lieu) {
        doc.text(`Lieu: ${evenement.lieu}`, 20, yPos);
        yPos += 8;
      }
      if (evenement.adresse) {
        doc.text(`Adresse: ${evenement.adresse}`, 20, yPos);
        yPos += 8;
      }
      
      // Prix
      if (evenement.prix && evenement.prix > 0) {
        doc.text(`Prix: ${evenement.prix.toFixed(2)} €`, 20, yPos);
        yPos += 8;
      }
      
      // Contenu détaillé
      if (evenement.contenu) {
        yPos += 5;
        doc.setFontSize(14);
        doc.text('Contenu détaillé:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        const contentLines = doc.splitTextToSize(evenement.contenu, 170);
        doc.text(contentLines, 20, yPos);
        yPos += contentLines.length * 6;
      }
      
      // URL
      yPos += 10;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink(`Plus d'informations: ${window.location.href}`, 20, yPos, { url: window.location.href });
      
      // Ajouter le pied de page sur toutes les pages
      addPDFFooter(doc);
      
      doc.save(`${evenement.titre.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success("PDF téléchargé avec succès !");
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    }
  };


  if (!evenement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Événement non trouvé</h2>
            <p className="text-gray-600 mb-4">L'événement que vous recherchez n'existe pas ou a été supprimé.</p>
            <Button onClick={() => router.push("/evenements")}>
              Retour aux événements
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const images = evenement.images && Array.isArray(evenement.images) 
    ? evenement.images 
    : evenement.images 
      ? JSON.parse(evenement.images as string) 
      : [];
  
  const allImages = evenement.imagePrincipale 
    ? [evenement.imagePrincipale, ...images] 
    : images;

  const categorieInfo = categories.find(c => c.value === evenement.categorie);
  const isInscriptionOpen = evenement.inscriptionRequis && 
    (!evenement.dateLimiteInscription || new Date(evenement.dateLimiteInscription) > new Date());
  const placesRestantes = evenement.placesDisponibles 
    ? evenement.placesDisponibles - evenement.placesReservees 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bouton retour */}
        <Link href="/evenements">
          <Button
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux événements
          </Button>
        </Link>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        ) : !evenement ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Événement non trouvé</h2>
              <p className="text-gray-600 mb-4">L'événement que vous recherchez n'existe pas ou a été supprimé.</p>
              <Button onClick={() => router.push("/evenements")}>
                Retour aux événements
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Galerie d'images */}
            {allImages.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="relative aspect-video w-full bg-gray-200 dark:bg-gray-800 rounded-t-lg overflow-hidden">
                    <Image
                      src={allImages[currentImageIndex]}
                      alt={evenement.titre}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority
                      unoptimized={allImages[currentImageIndex]?.startsWith('/')}
                      onError={(e) => {
                        console.error('Erreur de chargement d\'image:', allImages[currentImageIndex]);
                      }}
                    />
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => 
                            prev === 0 ? allImages.length - 1 : prev - 1
                          )}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => 
                            prev === allImages.length - 1 ? 0 : prev + 1
                          )}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        >
                          <ArrowLeft className="h-5 w-5 rotate-180" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {allImages.map((_: string, index: number) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentImageIndex 
                                  ? "bg-white" 
                                  : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {allImages.length > 1 && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="flex gap-2 overflow-x-auto">
                        {allImages.map((img: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`relative w-20 h-20 flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                              index === currentImageIndex 
                                ? "border-blue-500" 
                                : "border-transparent opacity-60 hover:opacity-100"
                            }`}
                          >
                            <Image
                              src={img}
                              alt={`Image ${index + 1}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                              unoptimized={img.startsWith('/')}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Informations principales */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      {categorieInfo && (
                        <Badge className={categorieInfo.color}>
                          {categorieInfo.label}
                        </Badge>
                      )}
                      <Badge variant={evenement.statut === "Publie" ? "default" : "outline"}>
                        {evenement.statut === "Publie" ? "Publié" : evenement.statut}
                      </Badge>
                    </div>
                    <CardTitle className="text-3xl font-bold mb-2">
                      {evenement.titre}
                    </CardTitle>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                      {evenement.description}
                    </p>
                  </div>
                  
                  {/* Boutons de partage */}
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare("copy")}
                      className="relative"
                    >
                      {linkCopied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Copié
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copier
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare("facebook")}
                    >
                      <Facebook className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare("twitter")}
                    >
                      <Twitter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare("linkedin")}
                    >
                      <Linkedin className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQRCode(!showQRCode)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddToCalendar}
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contenu détaillé */}
                {evenement.contenu && (
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {evenement.contenu}
                    </div>
                  </div>
                )}

                {/* Informations détaillées */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t">
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Date de début</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {new Date(evenement.dateDebut).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {evenement.dateFin && (
                    <div className="flex items-start space-x-3">
                      <Clock className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Date de fin</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(evenement.dateFin).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {evenement.lieu && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Lieu</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {evenement.lieu}
                        </p>
                        {evenement.adresse && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {evenement.adresse}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {evenement.prix && evenement.prix > 0 && (
                    <div className="flex items-start space-x-3">
                      <Euro className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Prix</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {evenement.prix.toFixed(2).replace('.', ',')} €
                        </p>
                      </div>
                    </div>
                  )}

                  {evenement.inscriptionRequis && (
                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Inscription</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {evenement.placesDisponibles 
                            ? `${evenement.placesReservees}/${evenement.placesDisponibles} places réservées`
                            : `${evenement.placesReservees} inscription(s)`
                          }
                          {placesRestantes !== null && placesRestantes > 0 && (
                            <span className="text-green-600 ml-2">
                              ({placesRestantes} place{placesRestantes > 1 ? 's' : ''} disponible{placesRestantes > 1 ? 's' : ''})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {evenement.tags && Array.isArray(evenement.tags) && evenement.tags.length > 0 && (
                  <div className="pt-6 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-4 w-4 text-gray-400" />
                      {evenement.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Carte interactive */}
            {evenement.lieu && evenement.adresse && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapIcon className="h-5 w-5" />
                    Localisation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MapComponent 
                    address={evenement.adresse}
                    location={evenement.lieu}
                  />
                </CardContent>
              </Card>
            )}

            {/* Événements similaires */}
            {similarEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Événements similaires</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {similarEvents.map((event) => (
                      <Link 
                        key={event.id} 
                        href={`/evenements/${event.id}`}
                        className="block p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {event.imagePrincipale && (
                            <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden">
                              <Image
                                src={event.imagePrincipale}
                                alt={event.titre}
                                fill
                                className="object-cover"
                                sizes="80px"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                              {event.titre}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                              {event.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(event.dateDebut).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            {/* Bouton d'inscription */}
            {evenement.inscriptionRequis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Inscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isInscriptionOpen && evenement.dateLimiteInscription && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-sm text-orange-800 dark:text-orange-200 font-semibold">
                        ⚠️ La date limite d'inscription est dépassée
                      </p>
                    </div>
                  )}
                  
                  {placesRestantes !== null && placesRestantes === 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                        Complet - Plus de places disponibles
                      </p>
                    </div>
                  )}
                  
                  {evenement.placesDisponibles && placesRestantes !== null && placesRestantes > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>{placesRestantes}</strong> place{placesRestantes > 1 ? 's' : ''} disponible{placesRestantes > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {evenement.dateLimiteInscription && isInscriptionOpen && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Date limite:</strong> {new Date(evenement.dateLimiteInscription).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {(!isInscriptionOpen && evenement.dateLimiteInscription) ? (
                    <Button
                      disabled
                      className="w-full"
                      title="La date limite d'inscription est dépassée"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Inscription fermée
                    </Button>
                  ) : placesRestantes === null || placesRestantes > 0 ? (
                    <Button
                      onClick={() => setShowInscriptionModal(true)}
                      className="w-full"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {session ? "S'inscrire" : "S'inscrire en tant que visiteur"}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full"
                    >
                      Complet
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Informations de contact */}
            {(evenement.contactEmail || evenement.contactTelephone) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {evenement.contactEmail && (
                    <div className="flex items-center space-x-3">
                      <MailIcon className="h-5 w-5 text-blue-600" />
                      <a 
                        href={`mailto:${evenement.contactEmail}`}
                        className="text-blue-600 hover:underline"
                      >
                        {evenement.contactEmail}
                      </a>
                    </div>
                  )}
                  {evenement.contactTelephone && (
                    <div className="flex items-center space-x-3">
                      <PhoneIcon className="h-5 w-5 text-blue-600" />
                      <a 
                        href={`tel:${evenement.contactTelephone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {evenement.contactTelephone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions admin */}
            {session?.user?.role === "Admin" && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions Admin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/admin/evenements/${evenement.id}/edition`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier l'événement
                  </Button>
                  
                  {evenement.inscriptionRequis && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowParticipants(!showParticipants)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {showParticipants ? "Masquer" : "Voir"} les participants ({evenement.placesReservees || 0})
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* QR Code */}
            {showQRCode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <QRCodeComponent url={window.location.href} />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                    Scannez ce code pour partager rapidement l'événement
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Liste des participants (Admin) */}
            {showParticipants && session?.user?.role === "Admin" && evenement.inscriptionRequis && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Participants ({evenement.placesReservees || 0})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setShowAddParticipantModal(true);
                        setLoadingAdherents(true);
                        try {
                          const result = await getAdherentsForEvent();
                          if (result.success && result.data) {
                            // Exclure les adhérents déjà inscrits
                            const inscriptionsExistantes = ((evenement as any).Inscriptions || []).map((i: any) => i.adherentId);
                            const adherentsDisponibles = result.data.filter((a: any) => !inscriptionsExistantes.includes(a.id));
                            setAdherents(adherentsDisponibles);
                          }
                        } catch (error) {
                          console.error("Erreur lors du chargement des adhérents:", error);
                          toast.error("Erreur lors du chargement des adhérents");
                        } finally {
                          setLoadingAdherents(false);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un participant
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(evenement as any).Inscriptions && (evenement as any).Inscriptions.length > 0 ? (
                    <div className="space-y-3">
                      {((evenement as any).Inscriptions as any[]).map((inscription: any) => {
                        // Déterminer le nom à afficher : adhérent ou visiteur
                        const nomAffiche = inscription.Adherent
                          ? `${inscription.Adherent.civility ? `${inscription.Adherent.civility} ` : ''}${inscription.Adherent.firstname} ${inscription.Adherent.lastname}`
                          : inscription.visiteurNom || 'Visiteur';
                        
                        return (
                        <div 
                          key={inscription.id}
                          className="p-3 border rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {nomAffiche}
                              </p>
                              {!inscription.Adherent && (
                                <Badge variant="outline" className="text-xs">
                                  Visiteur
                                </Badge>
                              )}
                            </div>
                            {inscription.visiteurEmail && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {inscription.visiteurEmail}
                              </p>
                            )}
                            {inscription.visiteurTelephone && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {inscription.visiteurTelephone}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                              <span>{inscription.nombrePersonnes} personne{inscription.nombrePersonnes > 1 ? 's' : ''}</span>
                              <span>
                                {new Date(inscription.dateInscription).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            {inscription.commentaires && (
                              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 italic">
                                "{inscription.commentaires}"
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={inscription.statut === "Confirme" ? "default" : "outline"}>
                              {inscription.statut}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!confirm("Êtes-vous sûr de vouloir retirer ce participant ?")) return;
                                try {
                                  const result = await removeParticipantFromEvent(inscription.id);
                                  if (result.success) {
                                    toast.success("Participant retiré avec succès");
                                    loadEvenement();
                                  } else {
                                    toast.error(result.error || "Erreur lors de la suppression");
                                  }
                                } catch (error) {
                                  console.error("Erreur lors de la suppression:", error);
                                  toast.error("Erreur lors de la suppression");
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                      Aucun participant pour le moment
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Modal d'inscription */}
      {showInscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Inscription à l'événement</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowInscriptionModal(false);
                    setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
                    setInscriptionVisiteurData({
                      nom: "",
                      email: "",
                      telephone: "",
                      adresse: "",
                      nombrePersonnes: 1,
                      commentaires: "",
                    });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Vous n'êtes pas connecté. Veuillez remplir vos informations ci-dessous. Vous recevrez une confirmation par email une fois votre inscription validée.
                  </p>
                </div>
              )}

              {!session && (
                <>
                  <div>
                    <Label htmlFor="nom">Nom complet *</Label>
                    <Input
                      id="nom"
                      type="text"
                      value={inscriptionVisiteurData.nom}
                      onChange={(e) => setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        nom: e.target.value
                      })}
                      placeholder="Votre nom complet"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inscriptionVisiteurData.email}
                      onChange={(e) => setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        email: e.target.value
                      })}
                      placeholder="votre@email.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="telephone">Téléphone *</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      value={inscriptionVisiteurData.telephone}
                      onChange={(e) => setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        telephone: e.target.value
                      })}
                      placeholder="01 23 45 67 89"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="adresse">Adresse *</Label>
                    <Textarea
                      id="adresse"
                      rows={3}
                      value={inscriptionVisiteurData.adresse}
                      onChange={(e) => setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        adresse: e.target.value
                      })}
                      placeholder="Rue, Code postal, Ville, Pays"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="nombrePersonnes">Nombre de personnes *</Label>
                <Input
                  id="nombrePersonnes"
                  type="number"
                  min="1"
                  max={placesRestantes || undefined}
                  value={session ? inscriptionData.nombrePersonnes : inscriptionVisiteurData.nombrePersonnes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    if (session) {
                      setInscriptionData({
                        ...inscriptionData,
                        nombrePersonnes: value
                      });
                    } else {
                      setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        nombrePersonnes: value
                      });
                    }
                  }}
                />
                {placesRestantes !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {placesRestantes} place{placesRestantes > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="commentaires">Commentaires (optionnel)</Label>
                <Textarea
                  id="commentaires"
                  rows={4}
                  value={session ? inscriptionData.commentaires : inscriptionVisiteurData.commentaires}
                  onChange={(e) => {
                    if (session) {
                      setInscriptionData({
                        ...inscriptionData,
                        commentaires: e.target.value
                      });
                    } else {
                      setInscriptionVisiteurData({
                        ...inscriptionVisiteurData,
                        commentaires: e.target.value
                      });
                    }
                  }}
                  placeholder="Ajoutez des commentaires ou des informations supplémentaires..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInscriptionModal(false);
                    setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
                    setInscriptionVisiteurData({
                      nom: "",
                      email: "",
                      telephone: "",
                      adresse: "",
                      nombrePersonnes: 1,
                      commentaires: "",
                    });
                  }}
                  className="flex-1"
                  disabled={inscriptionLoading}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleInscription}
                  disabled={inscriptionLoading}
                  className="flex-1"
                >
                  {inscriptionLoading ? "Envoi..." : "Confirmer l'inscription"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal pour ajouter un participant (Admin) */}
      {showAddParticipantModal && session?.user?.role === "Admin" && (
        <Dialog open={showAddParticipantModal} onOpenChange={setShowAddParticipantModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Ajouter un participant</DialogTitle>
              <DialogDescription>
                Sélectionnez un adhérent pour l'inscrire à cet événement
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto space-y-4">
              {/* Sélection de l'adhérent */}
              <div className="space-y-2">
                <Label htmlFor="adherent">Adhérent *</Label>
                {loadingAdherents ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <Select value={selectedAdherent} onValueChange={setSelectedAdherent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un adhérent" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {adherents.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Aucun adhérent disponible (tous sont déjà inscrits)
                          </div>
                        ) : (
                          adherents.map((adherent) => {
                            const displayName = `${adherent.civility || ""} ${adherent.firstname} ${adherent.lastname}`.trim() ||
                              adherent.User?.name ||
                              adherent.User?.email ||
                              "Adhérent sans nom";
                            
                            const displayText = adherent.User?.email 
                              ? `${displayName} (${adherent.User.email})`
                              : displayName;
                            
                            return (
                              <SelectItem key={adherent.id} value={adherent.id}>
                                {displayText}
                              </SelectItem>
                            );
                          })
                        )}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Nombre de personnes */}
              <div className="space-y-2">
                <Label htmlFor="nombrePersonnesParticipant">Nombre de personnes *</Label>
                <Input
                  id="nombrePersonnesParticipant"
                  type="number"
                  min="1"
                  max={
                    evenement?.placesDisponibles
                      ? evenement.placesDisponibles - (evenement.placesReservees || 0)
                      : undefined
                  }
                  value={nombrePersonnes}
                  onChange={(e) => setNombrePersonnes(parseInt(e.target.value) || 1)}
                />
                {evenement?.placesDisponibles && (
                  <p className="text-xs text-muted-foreground">
                    Places disponibles : {evenement.placesDisponibles - (evenement.placesReservees || 0)}
                  </p>
                )}
              </div>

              {/* Commentaires */}
              <div className="space-y-2">
                <Label htmlFor="commentairesParticipant">Commentaires (optionnel)</Label>
                <Textarea
                  id="commentairesParticipant"
                  rows={3}
                  value={commentairesParticipant}
                  onChange={(e) => setCommentairesParticipant(e.target.value)}
                  placeholder="Ajoutez des commentaires ou des informations supplémentaires..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddParticipantModal(false);
                  setSelectedAdherent("");
                  setNombrePersonnes(1);
                  setCommentairesParticipant("");
                }}
                disabled={addingParticipant}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddParticipant}
                disabled={addingParticipant || !selectedAdherent}
              >
                {addingParticipant ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Ajouter le participant
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </div>
  );
}

