import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Cake, Gift, CalendarDays, Sparkles } from "lucide-react";
import { getAnniversairesData } from "@/lib/anniversaires";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSpotlightLabel(daysFromBirthday: number) {
  if (daysFromBirthday === -1) return "Anniversaire demain";
  if (daysFromBirthday === 0) return "C'est aujourd'hui";
  return "Anniversaire hier";
}

function initials(firstname: string, lastname: string) {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
}

export default async function AnniversairesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  const { spotlight, prochains } = await getAnniversairesData(20);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-pink-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />

      <section className="relative py-12 md:py-16 bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-500 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex rounded-full bg-white/20 p-4 mb-4">
            <Cake className="h-10 w-10" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Anniversaires AMAKI</h1>
          <p className="text-pink-100 text-base md:text-xl">
            Souhaitons ensemble un joyeux anniversaire a nos adherents
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-pink-600" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Adherent(s) a l'honneur</h2>
            </div>
            {spotlight.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-gray-600 dark:text-gray-300">
                  Aucun anniversaire dans la fenetre J-1 / J / J+1.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spotlight.map((member) => (
                  <Card key={member.id} className="border-pink-200 dark:border-pink-900">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={member.image ?? undefined} alt={`${member.firstname} ${member.lastname}`} />
                          <AvatarFallback>{initials(member.firstname, member.lastname)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {member.firstname} {member.lastname}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {format(member.dateNaissance, "d MMMM", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Badge className="bg-pink-600">
                          <Gift className="h-3.5 w-3.5 mr-1" />
                          {getSpotlightLabel(member.daysFromBirthday)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Prochains anniversaires</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {prochains.map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {member.firstname} {member.lastname}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {format(member.dateNaissance, "d MMMM", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {member.daysUntilBirthday === 0
                        ? "Aujourd'hui"
                        : `Dans ${member.daysUntilBirthday} jour${member.daysUntilBirthday > 1 ? "s" : ""}`}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
