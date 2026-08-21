import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canWrite } from "@/lib/dynamic-permissions";
import { RibPrintView } from "./RibPrintView";

export const dynamic = "force-dynamic";

/**
 * Vue imprimable RIB du compte (admin / print CSS).
 */
export default async function RibPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const allowed = await canWrite(session.user.id, "createPaiement");
  if (!allowed) notFound();

  const { id } = await searchParams;
  if (!id) notFound();

  const compte = await db.comptePaiementAssociation.findUnique({
    where: { id },
  });
  if (!compte) notFound();

  return <RibPrintView compte={compte} />;
}
