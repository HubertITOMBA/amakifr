import jsPDF from "jspdf";
import {
  generateNumeroPasseport,
  generatePasseportPDF,
} from "@/lib/passeport-helpers";
import type { MyPasseportRecord } from "@/lib/services/passeport/load-my-passeport-record";

/**
 * Génère le buffer PDF passeport pour un enregistrement adhérent.
 */
export async function buildPasseportPdfBuffer(
  record: MyPasseportRecord
): Promise<Buffer> {
  const numeroPasseport =
    record.numeroPasseport ??
    generateNumeroPasseport(
      record.adherentId,
      record.userCreatedAt ?? new Date()
    );

  const doc = new jsPDF();
  await generatePasseportPDF(
    doc,
    {
      id: record.adherentId,
      civility: record.civility,
      firstname: record.firstname ?? "",
      lastname: record.lastname ?? "",
      dateNaissance: record.dateNaissance,
      profession: record.profession,
      numeroPasseport,
      dateGenerationPasseport: record.dateGenerationPasseport ?? new Date(),
      User: {
        email: record.userEmail,
        createdAt: record.userCreatedAt,
      },
    },
    record.adresse
  );

  return Buffer.from(doc.output("arraybuffer"));
}
