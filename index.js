// Railway Cloud Function: PDF-Verarbeitung + QR-Code-Einbettung + Supabase Upload + CORS
// Umgebung: Node.js auf Railway mit Express-API

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 8080; // â† Port angepasst fÃ¼r Railway

// Supabase-Konfiguration
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Startseite fÃ¼r / Route
app.get('/', (req, res) => {
  res.send('<h1>PDF Marker API ist online</h1><p>Verwende <code>POST /process</code> zum Hochladen einer PDF-Datei.</p>');
});

app.post('/process', upload.single('pdf'), async (req, res) => {
  try {
    const markerId = req.body.markerId || generateId();
    const inputBuffer = req.file.buffer;
    const outputPath = path.join(__dirname, 'output', markerId);
    fs.mkdirSync(outputPath, { recursive: true });

    const qrDataUrl = await QRCode.toDataURL(`https://yourapp.com/m/${markerId}`);
    const qrImage = Buffer.from(qrDataUrl.split(",")[1], 'base64');

    const pdfDoc = await PDFDocument.load(inputBuffer);
    const page = pdfDoc.getPage(0);
    const pngImage = await pdfDoc.embedPng(qrImage);

    const { width, height } = page.getSize();
    const size = 100;
    page.drawImage(pngImage, {
      x: width - size - 20,
      y: 20,
      width: size,
      height: size,
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(`Plan-ID: ${markerId}`, {
      x: 20,
      y: 20,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const modifiedPdf = await pdfDoc.save();
    const pdfPath = path.join(outputPath, 'final.pdf');
    fs.writeFileSync(pdfPath, modifiedPdf);

    const fileData = fs.readFileSync(pdfPath);
    const { data, error } = await supabase.storage
      .from('pdfs')
      .upload(`plans/${markerId}.pdf`, fileData, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(`plans/${markerId}.pdf`);
    const publicUrl = urlData?.publicUrl || null;

    if (!publicUrl) {
      return res.status(500).json({ message: 'Supabase-URL konnte nicht erzeugt werden.' });
    }

    res.status(200).json({
      markerId,
      publicPdfUrl: publicUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Fehler bei der Verarbeitung');
  }
});

function generateId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

app.listen(PORT, () => console.log(`PDF Marker API lÃ¤uft auf Port ${PORT}`));
