"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import ElectionDetails from "@/components/admin/ElectionDetails";

export default function ConsultationElectionPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  if (!id) return null;

  return (
    <Modal title="Détails de l'élection" confirmOnClose={false}>
      <ElectionDetails electionId={id} />
    </Modal>
  );
}
