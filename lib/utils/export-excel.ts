/**
 * Utilitaires pour l'export Excel/CSV
 * Utilise la bibliothèque xlsx (SheetJS)
 */

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  columns?: ExportColumn[];
  dateFormat?: string;
}

/**
 * Convertit des données en format Excel (XLSX)
 * Nécessite l'import dynamique de xlsx côté client
 */
export async function exportToExcel(
  data: any[],
  options: ExportOptions = {}
): Promise<{ success: boolean; blob?: Blob; error?: string }> {
  try {
    // Import dynamique de xlsx
    const XLSX = await import("xlsx");

    const { filename = "export", sheetName = "Données", columns, dateFormat = "dd/MM/yyyy" } = options;

    // Préparer les données
    let exportData: any[];

    if (columns && columns.length > 0) {
      // Utiliser les colonnes spécifiées
      exportData = data.map((row) => {
        const exportRow: any = {};
        columns.forEach((col) => {
          const value = row[col.key];
          exportRow[col.label] = col.format ? col.format(value) : value ?? "";
        });
        return exportRow;
      });
    } else {
      // Utiliser toutes les propriétés
      exportData = data;
    }

    // Créer le workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Générer le fichier
    const excelBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return { success: true, blob };
  } catch (error) {
    console.error("Erreur lors de l'export Excel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Convertit des données en format CSV
 */
export function exportToCSV(
  data: any[],
  options: ExportOptions = {}
): { success: boolean; csv?: string; error?: string } {
  try {
    const { columns, dateFormat = "dd/MM/yyyy" } = options;

    // Préparer les données
    let exportData: any[];

    if (columns && columns.length > 0) {
      exportData = data.map((row) => {
        const exportRow: any = {};
        columns.forEach((col) => {
          const value = row[col.key];
          exportRow[col.label] = col.format ? col.format(value) : value ?? "";
        });
        return exportRow;
      });
    } else {
      exportData = data;
    }

    if (exportData.length === 0) {
      return { success: false, error: "Aucune donnée à exporter" };
    }

    // Obtenir les en-têtes
    const headers = columns
      ? columns.map((col) => col.label)
      : Object.keys(exportData[0]);

    // Créer les lignes CSV
    const csvRows: string[] = [];

    // En-têtes
    csvRows.push(headers.map((h) => escapeCSVValue(h)).join(";"));

    // Données
    exportData.forEach((row) => {
      const values = headers.map((header) => {
        const key = columns
          ? columns.find((col) => col.label === header)?.key || header
          : header;
        const value = row[key];
        return escapeCSVValue(value ?? "");
      });
      csvRows.push(values.join(";"));
    });

    const csv = csvRows.join("\n");

    // Ajouter le BOM pour Excel (UTF-8)
    const csvWithBOM = "\uFEFF" + csv;

    return { success: true, csv: csvWithBOM };
  } catch (error) {
    console.error("Erreur lors de l'export CSV:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Échappe une valeur pour CSV
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Si la valeur contient un point-virgule, des guillemets ou un saut de ligne, l'entourer de guillemets
  if (stringValue.includes(";") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Télécharge un fichier
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Télécharge un fichier CSV
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadFile(blob, filename);
}

/**
 * Formate une date pour l'export
 */
export function formatDateForExport(date: Date | string | null | undefined, format: string = "dd/MM/yyyy"): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return format
    .replace("dd", day)
    .replace("MM", month)
    .replace("yyyy", String(year))
    .replace("HH", hours)
    .replace("mm", minutes);
}

/**
 * Formate un montant pour l'export
 */
export function formatAmountForExport(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

/**
 * Exporte des données en format PDF
 * Nécessite l'import dynamique de jsPDF côté client
 */
export async function exportToPDF(
  data: any[],
  options: ExportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data || data.length === 0) {
      return { success: false, error: "Aucune donnée à exporter" };
    }

    // Import dynamique de jsPDF et des helpers
    const { default: jsPDF } = await import("jspdf");
    const { addPDFHeader, addPDFFooter } = await import("@/lib/pdf-helpers-client");
    const { format } = await import("date-fns");
    const { fr } = await import("date-fns/locale");

    const { filename = "export", sheetName = "Données", columns } = options;

    // Créer le document PDF en format paysage pour plus d'espace
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const startY = 60; // Après l'en-tête
    let yPos = startY;

    // Ajouter l'en-tête
    await addPDFHeader(doc, sheetName);

    // Date de génération
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Généré le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}`,
      pageWidth - margin,
      yPos,
      { align: "right" }
    );
    yPos += 10;

    // Préparer les données
    let exportData: any[];
    let headers: string[];

    if (columns && columns.length > 0) {
      headers = columns.map((col) => col.label);
      exportData = data.map((row) => {
        const exportRow: any = {};
        columns.forEach((col) => {
          const value = row[col.key];
          exportRow[col.label] = col.format ? col.format(value) : value ?? "";
        });
        return exportRow;
      });
    } else {
      headers = Object.keys(data[0]);
      exportData = data;
    }

    // Calculer la largeur des colonnes
    const numColumns = headers.length;
    const availableWidth = pageWidth - 2 * margin;
    const columnWidth = availableWidth / numColumns;
    const maxColumnWidth = 50; // Largeur maximale par colonne
    const actualColumnWidth = Math.min(columnWidth, maxColumnWidth);

    // Fonction pour vérifier si on doit ajouter une nouvelle page
    const checkPageBreak = (requiredHeight: number = 10) => {
      if (yPos + requiredHeight > pageHeight - 30) {
        doc.addPage();
        yPos = margin + 10;
        return true;
      }
      return false;
    };

    // En-têtes du tableau
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(9, 61, 181); // Bleu AMAKI
    doc.setDrawColor(255, 255, 255);
    doc.setTextColor(255, 255, 255);

    checkPageBreak(8);
    let xPos = margin;
    headers.forEach((header, index) => {
      // Rectangle avec fond bleu
      doc.rect(xPos, yPos - 6, actualColumnWidth, 8, "F");
      // Texte de l'en-tête (tronqué si trop long)
      const headerText = header.length > 20 ? header.substring(0, 17) + "..." : header;
      doc.text(headerText, xPos + 2, yPos - 1, {
        maxWidth: actualColumnWidth - 4,
        align: "left",
      });
      xPos += actualColumnWidth;
    });
    yPos += 2;

    // Lignes de données
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);

    exportData.forEach((row, rowIndex) => {
      checkPageBreak(6);

      // Alternance de couleurs pour les lignes
      if (rowIndex % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, yPos - 5, availableWidth, 6, "F");
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, yPos - 5, availableWidth, 6, "F");
      }

      xPos = margin;
      headers.forEach((header) => {
        const key = columns
          ? columns.find((col) => col.label === header)?.key || header
          : header;
        const value = String(row[key] ?? "");
        // Tronquer le texte si trop long
        const displayValue = value.length > 25 ? value.substring(0, 22) + "..." : value;
        doc.text(displayValue, xPos + 2, yPos, {
          maxWidth: actualColumnWidth - 4,
          align: "left",
        });
        xPos += actualColumnWidth;
      });

      yPos += 6;

      // Ligne de séparation
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
    });

    // Ajouter le pied de page
    addPDFFooter(doc);

    // Télécharger le PDF
    const fileName = `${filename}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

