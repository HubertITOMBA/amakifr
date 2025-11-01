"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";

export default function GestionUsersPage() {
  const router = useRouter();

  return (
    <Modal 
      title="Créer un utilisateur" 
      confirmOnClose={false}
      showFooter={false}
      onCancel={() => router.back()}
    >
      <div className="text-center py-8 text-gray-500">
        La création d'utilisateur sera implémentée prochainement.
        <br />
        Pour l'instant, les utilisateurs s'inscrivent via le formulaire d'inscription.
      </div>
    </Modal>
  );
}

