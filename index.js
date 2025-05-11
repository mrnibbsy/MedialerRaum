// Railway Cloud Function: PDF-Verarbeitung + QR-Code-Einbettung (deploy-ready)
// Umgebung: Node.js auf Railway mit Express-API

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import path from 'path';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

app.post('/process', upload.single('pdf'), async (req, res) => {
  try {
    const markerId = req.body.markerId || generateId();
    const inputBuffer = req.file.buffer;
    const outputPath = path.join(__dirname, 'output', markerId);
    fs.mkdirSync(outputPath, { recursive: true });

    // 1. QR-Code erzeugen
    const qrDataUrl = await QRCode.toDataURL(`https://yourapp.com/m/${markerId}`);
    const qrImage = Buffer.from(qrDataUrl.split(",")[1], 'base64');

    // 2. PDF laden & modifizieren
    const pdfDoc = await PDFDocument.load(inputBuffer);
    const page = pdfDoc.getPage(0);
    const pngImage = await pdfDoc.embedPng(qrImage);

    // 3. QR einbetten
    const { width, height } = page.getSize();
    const size = 100;
    page.drawImage(pngImage, {
      x: width - size - 20,
      y: 20,
      width: size,
      height: size,
    });

    // 4. Marker-ID als Text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(`Plan-ID: ${markerId}`, {
      x: 20,
      y: 20,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    // 5. PDF speichern
    const modifiedPdf = await pdfDoc.save();
    const pdfPath = path.join(outputPath, 'final.pdf');
    fs.writeFileSync(pdfPath, modifiedPdf);

    res.status(200).json({
      markerId,
      finalPdfPath: `/output/${markerId}/final.pdf`
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Fehler bei der Verarbeitung');
  }
});

function generateId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

app.listen(PORT, () => console.log(`PDF Marker API läuft auf Port ${PORT}`));
