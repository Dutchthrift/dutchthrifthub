import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Printer, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface PickingListModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface PickingItem {
    artikelCode: string;
    sku: string;
    description: string;
    quantity: number;
    customer: string;
}

export function PickingListModal({ open, onOpenChange }: PickingListModalProps) {
    const [dragActive, setDragActive] = useState(false);
    const [items, setItems] = useState<PickingItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const parseMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/picking/parse', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Kon bestand niet verwerken');
            return res.json() as Promise<{ items: PickingItem[] }>;
        },
        onSuccess: (data) => {
            setItems(data.items);
            toast({ title: "Succes", description: `${data.items.length} regels ingeladen.` });
        },
        onError: () => {
            toast({ title: "Fout", description: "Kon bestand niet lezen. Check of het een geldig Excel bestand is.", variant: "destructive" });
        }
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            parseMutation.mutate(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            parseMutation.mutate(e.target.files[0]);
        }
    };

    const handlePrint = () => {
        // Create a new window with just the picking list
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            toast({ title: "Fout", description: "Kon printvenster niet openen. Controleer popup-blocker.", variant: "destructive" });
            return;
        }

        const tableRows = items.map(item => `
            <tr>
                <td style="font-weight: bold; font-family: monospace;">${item.sku}</td>
                <td style="font-family: monospace; font-size: 9pt; color: #444;">${item.artikelCode}</td>
                <td style="font-weight: bold; font-size: 14pt; text-align: center; border: 2px solid #000 !important;">${item.quantity}</td>
                <td style="font-weight: bold;">${item.description}</td>
                <td>${item.customer}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Picklijst - ${new Date().toLocaleDateString('nl-NL')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        color: black;
                        background: white;
                    }
                    h1 {
                        font-size: 24pt;
                        margin-bottom: 5px;
                        border-bottom: 3px solid #000;
                        padding-bottom: 10px;
                    }
                    .meta {
                        font-size: 10pt;
                        color: #666;
                        margin-bottom: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    th {
                        background-color: #f0f0f0;
                        border: 1px solid #000;
                        padding: 4px 6px;
                        font-size: 9pt;
                        text-align: left;
                    }
                    td {
                        border: 1px solid #ccc;
                        padding: 3px 5px;
                        font-size: 9pt;
                        word-wrap: break-word;
                        line-height: 1.2;
                    }
                    th:nth-child(1), td:nth-child(1) { width: 10%; }
                    th:nth-child(2), td:nth-child(2) { width: 8%; }
                    th:nth-child(3), td:nth-child(3) { width: 6%; }
                    th:nth-child(4), td:nth-child(4) { width: auto; }
                    th:nth-child(5), td:nth-child(5) { width: 18%; }
                    @media print {
                        body { margin: 0; }
                        @page { margin: 0.5cm; }
                    }
                </style>
            </head>
            <body>
                <h1>Picklijst</h1>
                <p class="meta">Gegenereerd op ${new Date().toLocaleString('nl-NL')} - ${items.length} regels</p>
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Art. Code</th>
                            <th>Aantal</th>
                            <th>Artikelomschrijving</th>
                            <th>Klant</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <div className="p-6 pb-2 no-print">
                    <DialogHeader className="flex flex-row items-center justify-between pr-8">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <FileSpreadsheet className="h-6 w-6 text-green-600" />
                            Order Picken
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            {items.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setItems([])}>
                                    <X className="mr-1 h-4 w-4" /> Reset
                                </Button>
                            )}
                            {items.length > 0 && (
                                <Button onClick={handlePrint} size="sm" className="gap-1">
                                    <Printer className="h-4 w-4" /> Print
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    {items.length === 0 ? (
                        <div
                            className={`
                                border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer transition-colors
                                ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                            `}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleChange}
                            />
                            {parseMutation.isPending ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground font-medium">Bestand verwerken...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <div className="p-4 bg-primary/10 rounded-full">
                                        <Upload className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Klik om te uploaden</p>
                                        <p className="text-sm text-muted-foreground">of sleep je Excel bestand hierheen</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">Ondersteunt .xlsx, .xls</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="print-container">
                            <div className="hidden print:block mb-6">
                                <h1 className="text-2xl font-bold mb-2">Picklijst</h1>
                                <p className="text-sm text-gray-500">Gegenereerd op {new Date().toLocaleString('nl-NL')}</p>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[100px] font-bold">SKU</TableHead>
                                        <TableHead className="w-[100px]">Art. Code</TableHead>
                                        <TableHead className="w-[80px] text-center font-bold">Aantal</TableHead>
                                        <TableHead className="font-bold">Artikelomschrijving</TableHead>
                                        <TableHead className="w-[200px]">Klant</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, idx) => (
                                        <TableRow key={idx} className="group hover:bg-muted/50">
                                            <TableCell className="font-mono font-bold">{item.sku}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{item.artikelCode}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{item.quantity}</TableCell>
                                            <TableCell className="font-medium leading-tight">{item.description}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground truncate">{item.customer}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                <style>{`
                    /* SCREEN VIEW: Hide the print-only container */
                    .print-only {
                        display: none;
                    }

                    @media print {
                        /* PRINT VIEW: Hide EVERYTHING but the picking list */
                        body > *:not(.picking-list-print-root) {
                            display: none !important;
                        }

                        /* Ensure the root of our print content is visible and fills the page */
                        .picking-list-print-root {
                            display: block !important;
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            visibility: visible !important;
                        }

                        /* Reset page background */
                        html, body {
                            background: white !important;
                            overflow: visible !important;
                            height: auto !important;
                        }

                        /* Professional Table Layout */
                        .print-only {
                            display: block !important;
                        }
                        
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            table-layout: fixed !important;
                            margin-top: 10px;
                        }

                        th {
                            background-color: #f3f3f3 !important;
                            border: 1px solid #000 !important;
                            padding: 6px !important;
                            font-size: 10pt;
                            text-align: left;
                            -webkit-print-color-adjust: exact;
                        }

                        td {
                            border: 1px solid #ddd !important;
                            padding: 6px !important;
                            font-size: 10pt;
                            word-wrap: break-word;
                        }

                        /* Specific Column Widths for A4 */
                        .col-sku { width: 15%; font-weight: bold; font-family: monospace; }
                        .col-art { width: 12%; font-family: monospace; font-size: 8pt; color: #444; }
                        .col-qty { width: 10%; font-weight: bold; font-size: 14pt; text-align: center; border: 2px solid #000 !important; }
                        .col-desc { width: auto; font-weight: bold; }
                        .col-klant { width: 22%; }

                        h1 { font-size: 22pt; margin: 0 0 10px 0; border-bottom: 2px solid #000; }
                        
                        @page {
                            margin: 0.5cm;
                            size: portrait;
                        }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}
