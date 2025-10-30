"use client";
import ElectionForm from "@/components/admin/ElectionForm";
import { Modal } from "@/components/Modal";
import { useState } from "react";

export default function GestionElectionsPage() {
  const [isDirty, setIsDirty] = useState(false);
  return (
    <Modal 
      title="Créer une élection" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
    >
      <ElectionForm hideActions onDirtyChange={setIsDirty} />
    </Modal>
  );
}
