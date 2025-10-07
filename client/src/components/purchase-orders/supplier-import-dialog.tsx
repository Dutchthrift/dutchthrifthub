import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export function SupplierImportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/suppliers/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Leveranciers geïmporteerd",
        description: data.message || "Leveranciers zijn succesvol geïmporteerd",
      });
      setIsOpen(false);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Import mislukt",
        description: error.message || "Er is een fout opgetreden tijdens het importeren",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: "Ongeldig bestand",
          description: "Upload alleen Excel bestanden (.xlsx of .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-import-suppliers">
          <Upload className="h-4 w-4 mr-2" />
          Importeer Leveranciers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excel Import</DialogTitle>
          <DialogDescription>
            Importeer leveranciers vanuit een Excel bestand
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            {!selectedFile ? (
              <div className="space-y-2">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <label htmlFor="excel-upload" className="cursor-pointer">
                    <div className="text-sm font-medium">Klik om bestand te selecteren</div>
                    <div className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls)</div>
                  </label>
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-excel-file"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted p-3 rounded-md text-xs">
            <div className="font-medium mb-1">Verwachte kolommen:</div>
            <div className="text-muted-foreground">
              Relatiecode, Naam, Contactpersoon, Email, Telefoon, Adres, IBAN, BTW nummer, etc.
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSelectedFile(null);
                setIsOpen(false);
              }}
              data-testid="button-cancel-import"
            >
              Annuleer
            </Button>
            <Button
              className="flex-1"
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importMutation.isPending ? "Importeren..." : "Importeer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
