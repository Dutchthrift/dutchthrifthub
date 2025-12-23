import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer();

// Parse Picking List
router.post('/parse', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with array of arrays to handle headers manually if needed, 
        // or just let XLSX parse it. To be safe with weird headers, let's use 'header: "A"' 
        // to get column letters, or just parse as raw rows.
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Assume row 1 (index 0) is header, data starts from row 2 (index 1) which is typical,
        // OR based on screenshot, header is row 1.

        const parsedItems: any[] = [];

        // Skip header row
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];

            // Map based on assumed screenshot columns (0-indexed):
            // A=0, B=1, C=2 (Artikelcode), D=3 (SKU), E=4 (Omschrijving), F=5 (Aantal), G=6 (Order), H=7 (Klant)

            const sku = row[3]?.toString();

            // Skip empty SKU or "Free shipping" lines if they don't have a real SKU (screenshot shows some have SKU "505")
            // User wants A-Z sort.
            if (!sku) continue;

            const item = {
                artikelCode: row[2]?.toString() || '',
                sku: sku,
                description: row[4]?.toString() || '',
                quantity: row[5] ? Number(row[5]) : 0,
                customer: row[7]?.toString() || ''
            };

            parsedItems.push(item);
        }

        // Sort by SKU A-Z
        parsedItems.sort((a, b) => a.sku.localeCompare(b.sku));

        res.json({ items: parsedItems });
    } catch (error: any) {
        console.error('Error parsing picking list:', error);
        res.status(500).json({ message: error.message || 'Failed to parse file' });
    }
});

export default router;
