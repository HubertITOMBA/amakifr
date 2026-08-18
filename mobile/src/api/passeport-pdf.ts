import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { downloadMyPasseportPdf } from "@/api/passeport";
import { passeportLocalFilename } from "@/api/passeport-state";

export type OpenPasseportPdfResult =
  | { ok: true; shared: boolean }
  | { ok: false; reason: "sharing_unavailable" | "write_failed" | "fetch_failed" };

/**
 * Télécharge le PDF passeport authentifié, l'écrit en cache temporaire et ouvre le partage OS.
 */
export async function openMyPasseportPdf(
  numeroPasseport: string
): Promise<OpenPasseportPdfResult> {
  let buffer: ArrayBuffer;
  try {
    buffer = await downloadMyPasseportPdf();
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  const file = new File(Paths.cache, passeportLocalFilename(numeroPasseport));
  try {
    file.write(new Uint8Array(buffer));
  } catch {
    return { ok: false, reason: "write_failed" };
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return { ok: false, reason: "sharing_unavailable" };
  }

  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  } catch {
    return { ok: false, reason: "sharing_unavailable" };
  }

  return { ok: true, shared: true };
}
