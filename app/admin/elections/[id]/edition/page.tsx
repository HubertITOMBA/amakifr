"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import ElectionForm from "@/components/admin/ElectionForm";
import { useState } from "react";

export default function EditionElectionPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  if (!id) return null;

  return (
    <Modal 
      title="Modifier une élection" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
    >
      <ElectionForm electionId={id} hideActions onDirtyChange={setIsDirty} />
    </Modal>
  );
}
