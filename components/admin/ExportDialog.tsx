"use client";

import { useState } from "react";
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
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToCSV, downloadFile, downloadCSV } from "@/lib/utils/export-excel";

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
  const [format, setFormat] = useState<"excel" | "csv">("excel");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!data || data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      setLoading(true);

      if (format === "excel") {
        const result = await exportToExcel(data, {
          filename,
          sheetName,
          columns,
        });

        if (result.success && result.blob) {
          downloadFile(result.blob, `${filename}.xlsx`);
          toast.success("Export Excel généré avec succès");
          setOpen(false);
        } else {
          toast.error(result.error || "Erreur lors de l'export Excel");
        }
      } else {
        const result = exportToCSV(data, {
          filename,
          columns,
        });

        if (result.success && result.csv) {
          downloadCSV(result.csv, `${filename}.csv`);
          toast.success("Export CSV généré avec succès");
          setOpen(false);
        } else {
          toast.error(result.error || "Erreur lors de l'export CSV");
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      toast.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Exporter les données</DialogTitle>
          <DialogDescription>
            Choisissez le format d'export pour {data.length} élément(s)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="format">Format d'export</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as "excel" | "csv")}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel (.xlsx)</span>
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>CSV (.csv)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>
              <strong>Excel (.xlsx)</strong> : Format recommandé pour Excel, avec formatage et plusieurs feuilles
            </p>
            <p className="mt-2">
              <strong>CSV (.csv)</strong> : Format texte simple, compatible avec tous les tableurs
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

