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

