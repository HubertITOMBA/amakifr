"use client";
import ElectionForm from "@/components/admin/ElectionForm";
import { Modal } from "@/components/Modal";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GestionElectionsPage() {
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    // Fermer le dialog et retourner à la liste des élections
    router.push("/admin/elections");
  };

  return (
    <Modal 
      title="Créer une élection" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
    >
      <ElectionForm hideActions onDirtyChange={setIsDirty} onSuccess={handleSuccess} />
    </Modal>
  );
}
