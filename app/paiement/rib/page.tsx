import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveAssociationPaymentAccount } from "@/lib/services/payment-accounts/get-active-payment-account";
import { MemberRibPrintView } from "./MemberRibPrintView";

export const dynamic = "force-dynamic";

/**
 * RIB imprimable du compte actif (adhérent authentifié).
 */
export default async function MemberRibPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=/paiement/rib");
  }

  const account = await getActiveAssociationPaymentAccount({
    userId: session.user.id,
    role: (session.user as { role?: string }).role ?? "MEMBRE",
    status: "Actif",
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
  });

  if (!account) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Aucun compte de paiement actif.
      </div>
    );
  }

  return <MemberRibPrintView account={account} />;
}
