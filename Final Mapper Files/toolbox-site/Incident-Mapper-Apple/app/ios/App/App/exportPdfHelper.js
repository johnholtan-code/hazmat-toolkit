// exportPdfHelper.js
// Helper for saving and sharing PDF blobs in a Capacitor app without using blob: URLs.

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Convert a Blob into a base64 string (without the data: prefix).
 * @param {Blob} blob
 * @returns {Promise<string>} base64 string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected reader result type'));
        return;
      }
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Invalid data URL format'));
        return;
      }
      const base64 = result.substring(comma + 1);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Save a PDF Blob to the app sandbox and present a share sheet.
 * Returns the file URI (capacitor://...) for further use if needed.
 * @param {Blob} pdfBlob - A Blob containing PDF data (e.g., from jsPDF output('blob')).
 * @param {string} [filename='report.pdf'] - The filename to save as.
 * @returns {Promise<string>} - The saved file URI.
 */
export async function saveAndSharePdfBlob(pdfBlob, filename = 'report.pdf') {
  if (!(pdfBlob instanceof Blob)) {
    throw new Error('saveAndSharePdfBlob: pdfBlob must be a Blob');
  }

  const base64Data = await blobToBase64(pdfBlob);

  // Write file to Documents (or change to Directory.Cache if preferred)
  const writeRes = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Documents,
    recursive: false,
  });

  // Share the saved file
  await Share.share({
    title: 'Export PDF Report',
    text: 'Here is the report.',
    url: writeRes.uri,
    dialogTitle: 'Share PDF',
  });

  return writeRes.uri;
}

/**
 * Example usage with jsPDF:
 *
 * import { jsPDF } from 'jspdf';
 * import { saveAndSharePdfBlob } from './exportPdfHelper';
 *
 * async function exportReport() {
 *   const doc = new jsPDF();
 *   doc.text('Hello PDF', 10, 10);
 *   const blob = doc.output('blob');
 *   await saveAndSharePdfBlob(blob, 'report.pdf');
 * }
 */
