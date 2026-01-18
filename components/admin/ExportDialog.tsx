"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText, File, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToCSV, exportToPDF, downloadFile, downloadCSV } from "@/lib/utils/export-excel";
import { logExport } from "@/lib/activity-logger";

interface ExportDialogProps {
  data: any[];
  filename: string;
  sheetName?: string;
  columns?: Array<{ key: string; label: string; format?: (value: any) => string }>;
  trigger?: React.ReactNode;
}

export function ExportDialog({
  data,
  filename,
  sheetName = "Données",
  columns,
  trigger,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"excel" | "csv" | "pdf">("excel");
  const [loading, setLoading] = useState(false);
  const [showColumnSelection, setShowColumnSelection] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  // Détecter les colonnes disponibles
  const availableColumns = useMemo(() => {
    if (columns && columns.length > 0) {
      return columns.map((col) => ({ key: col.key, label: col.label, format: col.format }));
    }
    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      return keys.map((key) => ({ key, label: key, format: undefined }));
    }
    return [];
  }, [data, columns]);

  // Initialiser toutes les colonnes comme sélectionnées par défaut
  useEffect(() => {
    if (availableColumns.length > 0 && selectedColumns.size === 0) {
      setSelectedColumns(new Set(availableColumns.map((col) => col.key)));
    }
  }, [availableColumns, selectedColumns.size]);

  // Toggle une colonne
  const toggleColumn = (columnKey: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(columnKey)) {
      newSelected.delete(columnKey);
    } else {
      newSelected.add(columnKey);
    }
    setSelectedColumns(newSelected);
  };

  // Sélectionner/désélectionner toutes les colonnes
  const toggleAllColumns = () => {
    if (selectedColumns.size === availableColumns.length) {
      setSelectedColumns(new Set());
    } else {
      setSelectedColumns(new Set(availableColumns.map((col) => col.key)));
    }
  };

  // Obtenir les colonnes filtrées pour l'export
  const getFilteredColumns = () => {
    if (selectedColumns.size === 0) {
      // Si aucune colonne sélectionnée, exporter toutes les colonnes
      return columns || availableColumns.map((col) => ({ key: col.key, label: col.label, format: col.format }));
    }
    return availableColumns
      .filter((col) => selectedColumns.has(col.key))
      .map((col) => ({ key: col.key, label: col.label, format: col.format }));
  };

  const handleExport = async () => {
    if (!data || data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      setLoading(true);

      const filteredColumns = getFilteredColumns();

      if (format === "excel") {
        const result = await exportToExcel(data, {
          filename,
          sheetName,
          columns: filteredColumns,
        });

        if (result.success && result.blob) {
          // Logger l'export
          try {
            await logExport(
              `Export Excel de ${sheetName} (${data.length} éléments)`,
              sheetName,
              {
                count: data.length,
                format: "xlsx",
                filename,
                columnsCount: filteredColumns.length,
              }
            );
          } catch (logError) {
            console.error("Erreur lors du logging de l'export:", logError);
            // Ne pas bloquer l'export si le logging échoue
          }

          downloadFile(result.blob, `${filename}.xlsx`);
          toast.success("Export Excel généré avec succès");
          setOpen(false);
          setShowColumnSelection(false);
        } else {
          toast.error(result.error || "Erreur lors de l'export Excel");
        }
      } else if (format === "csv") {
        const result = exportToCSV(data, {
          filename,
          columns: filteredColumns,
        });

        if (result.success && result.csv) {
          // Logger l'export
          try {
            await logExport(
              `Export CSV de ${sheetName} (${data.length} éléments)`,
              sheetName,
              {
                count: data.length,
                format: "csv",
                filename,
                columnsCount: filteredColumns.length,
              }
            );
          } catch (logError) {
            console.error("Erreur lors du logging de l'export:", logError);
            // Ne pas bloquer l'export si le logging échoue
          }

          downloadCSV(result.csv, `${filename}.csv`);
          toast.success("Export CSV généré avec succès");
          setOpen(false);
          setShowColumnSelection(false);
        } else {
          toast.error(result.error || "Erreur lors de l'export CSV");
        }
      } else if (format === "pdf") {
        toast.loading("Génération du PDF en cours...");
        const result = await exportToPDF(data, {
          filename,
          sheetName,
          columns: filteredColumns,
        });

        if (result.success) {
          // Logger l'export
          try {
            await logExport(
              `Export PDF de ${sheetName} (${data.length} éléments)`,
              sheetName,
              {
                count: data.length,
                format: "pdf",
                filename,
                columnsCount: filteredColumns.length,
              }
            );
          } catch (logError) {
            console.error("Erreur lors du logging de l'export:", logError);
            // Ne pas bloquer l'export si le logging échoue
          }

          toast.success("Export PDF généré avec succès");
          setOpen(false);
          setShowColumnSelection(false);
        } else {
          toast.error(result.error || "Erreur lors de l'export PDF");
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      toast.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser l'état quand le dialog se ferme
  useEffect(() => {
    if (!open) {
      setShowColumnSelection(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 overflow-x-hidden">
        <DialogHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <Download className="h-5 w-5 text-white" />
            Exporter les données
          </DialogTitle>
          <DialogDescription className="text-blue-50 dark:text-blue-100 text-sm mt-2">
            {showColumnSelection
              ? `Sélectionnez les colonnes à exporter (${selectedColumns.size}/${availableColumns.length} sélectionnées)`
              : `Choisissez le format d'export pour ${data.length} élément(s)`}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 bg-white dark:bg-gray-900">
          {!showColumnSelection ? (
            <>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="format" className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Format d'export
                  </Label>
                  <Select value={format} onValueChange={(value) => setFormat(value as "excel" | "csv" | "pdf")}>
                    <SelectTrigger id="format" className="border-blue-200 dark:border-blue-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excel">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          <span>Excel (.xlsx)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>CSV (.csv)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pdf">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-red-600" />
                          <span>PDF (.pdf)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong className="text-green-700 dark:text-green-400">Excel (.xlsx)</strong> : Format recommandé pour Excel, avec formatage et plusieurs feuilles
                  </p>
                  <p className="mt-2 text-blue-800 dark:text-blue-200">
                    <strong className="text-blue-700 dark:text-blue-400">CSV (.csv)</strong> : Format texte simple, compatible avec tous les tableurs
                  </p>
                  <p className="mt-2 text-blue-800 dark:text-blue-200">
                    <strong className="text-red-700 dark:text-red-400">PDF (.pdf)</strong> : Format document imprimable avec mise en page professionnelle
                  </p>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 sm:justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setOpen(false)} 
                  disabled={loading}
                  className="w-full sm:w-auto border-gray-300 dark:border-gray-600"
                >
                  Annuler
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowColumnSelection(true)}
                  disabled={loading}
                  className="w-full sm:w-auto border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Colonnes
                </Button>
                <Button 
                  onClick={handleExport} 
                  disabled={loading}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Colonnes disponibles
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllColumns}
                    className="text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  >
                    {selectedColumns.size === availableColumns.length ? (
                      <>
                        <Square className="h-3 w-3 mr-1" />
                        Tout désélectionner
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Tout sélectionner
                      </>
                    )}
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto border-2 border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2 bg-blue-50/30 dark:bg-blue-900/10">
                  {availableColumns.map((column) => {
                    const isSelected = selectedColumns.has(column.key);
                    return (
                      <div
                        key={column.key}
                        className={`flex items-center space-x-3 p-2 rounded transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                            : "hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent"
                        }`}
                        onClick={() => toggleColumn(column.key)}
                      >
                        <Checkbox
                          id={`column-${column.key}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleColumn(column.key)}
                          onClick={(e) => e.stopPropagation()}
                          className={isSelected ? "border-blue-600" : ""}
                        />
                        <Label
                          htmlFor={`column-${column.key}`}
                          className={`flex-1 cursor-pointer text-sm font-normal ${
                            isSelected ? "text-blue-900 dark:text-blue-100 font-medium" : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {column.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {selectedColumns.size === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      Aucune colonne sélectionnée. Toutes les colonnes seront exportées par défaut.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 sm:justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowColumnSelection(false)} 
                  disabled={loading}
                  className="w-full sm:w-auto border-gray-300 dark:border-gray-600"
                >
                  Retour
                </Button>
                <Button 
                  onClick={handleExport} 
                  disabled={loading}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Exporter ({selectedColumns.size > 0 ? selectedColumns.size : availableColumns.length})
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

