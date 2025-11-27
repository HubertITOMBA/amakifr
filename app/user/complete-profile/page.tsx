"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { Loader2, User, MapPin, Briefcase, Calendar, Save, ArrowRight } from "lucide-react";
import { getUserData } from "@/actions/user";
import { completeProfile } from "@/actions/user/complete-profile";

const CompleteProfileSchema = z.object({
    anneePromotion: z.string().optional(),
    pays: z.string().optional(),
    ville: z.string().optional(),
    profession: z.string().optional(),
    centresInteret: z.string().optional(),
});

type CompleteProfileForm = z.infer<typeof CompleteProfileSchema>;

export default function CompleteProfilePage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [adherent, setAdherent] = useState<any>(null);

    const form = useForm<CompleteProfileForm>({
        resolver: zodResolver(CompleteProfileSchema),
        defaultValues: {
            anneePromotion: "",
            pays: "",
            ville: "",
            profession: "",
            centresInteret: "",
        },
    });

    useEffect(() => {
        const loadProfile = async () => {
            if (!session?.user?.id) {
                router.push("/auth/sign-in");
                return;
            }

            try {
                const result = await getUserData();
                if (result.success && result.user && result.user.adherent) {
                    setAdherent(result.user.adherent);
                    form.reset({
                        anneePromotion: result.user.adherent.anneePromotion || "",
                        profession: result.user.adherent.profession || "",
                        centresInteret: result.user.adherent.centresInteret || "",
                    });

                    // Extraire pays et ville de centresInteret si JSON
                    if (result.user.adherent.centresInteret) {
                        try {
                            const info = JSON.parse(result.user.adherent.centresInteret);
                            if (info.pays) form.setValue("pays", info.pays);
                            if (info.ville) form.setValue("ville", info.ville);
                        } catch (e) {
                            // Pas du JSON, ignorer
                        }
                    }
                }
            } catch (error) {
                console.error("Erreur lors du chargement du profil:", error);
                toast.error("Erreur lors du chargement du profil");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [session, router, form]);

    const onSubmit = async (data: CompleteProfileForm) => {
        if (!session?.user?.id) {
            toast.error("Session invalide");
            return;
        }

        setSaving(true);
        try {
            const result = await completeProfile(data);
            
            if (result.success) {
                toast.success(result.message || "Profil complété avec succès !");
                setTimeout(() => {
                    router.push("/user/profile");
                }, 1500);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde du profil");
            }
        } catch (error) {
            console.error("Erreur lors de la sauvegarde:", error);
            toast.error("Erreur lors de la sauvegarde du profil");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <Card className="shadow-xl border-blue-200 dark:border-blue-800">
                    <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <User className="h-6 w-6" />
                            Compléter mon profil
                        </CardTitle>
                        <CardDescription className="text-blue-100">
                            Ajoutez des informations pour mieux vous connaître et faciliter les connexions
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Année de promotion */}
                            <div className="space-y-2">
                                <Label htmlFor="anneePromotion" className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                    Année de promotion
                                </Label>
                                <Input
                                    id="anneePromotion"
                                    {...form.register("anneePromotion")}
                                    placeholder="2010 ou 'Je ne suis pas ancien élève'"
                                />
                                <p className="text-xs text-gray-500">
                                    Si vous êtes ancien élève de Kipaku, indiquez votre année de promotion
                                </p>
                            </div>

                            {/* Localisation */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pays" className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-600" />
                                        Pays
                                    </Label>
                                    <Input
                                        id="pays"
                                        {...form.register("pays")}
                                        placeholder="France"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ville" className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-600" />
                                        Ville
                                    </Label>
                                    <Input
                                        id="ville"
                                        {...form.register("ville")}
                                        placeholder="Paris"
                                    />
                                </div>
                            </div>

                            {/* Profession */}
                            <div className="space-y-2">
                                <Label htmlFor="profession" className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-blue-600" />
                                    Profession
                                </Label>
                                <Input
                                    id="profession"
                                    {...form.register("profession")}
                                    placeholder="Développeur, Enseignant, etc."
                                />
                            </div>

                            {/* Centres d'intérêt */}
                            <div className="space-y-2">
                                <Label htmlFor="centresInteret">Centres d'intérêt</Label>
                                <Textarea
                                    id="centresInteret"
                                    {...form.register("centresInteret")}
                                    placeholder="Décrivez vos centres d'intérêt, passions, etc."
                                    rows={4}
                                />
                            </div>

                            {/* Boutons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Enregistrement...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Enregistrer et continuer
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push("/user/profile")}
                                    className="flex-1"
                                >
                                    Passer cette étape
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

