// Helper for saving and sharing blobs in a Capacitor app without blob: URLs.
(function attachExportPdfHelper(globalScope) {
  "use strict";

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read blob as data URL"));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Unexpected reader result type"));
          return;
        }
        const comma = result.indexOf(",");
        if (comma === -1) {
          reject(new Error("Invalid data URL format"));
          return;
        }
        resolve(result.substring(comma + 1));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function saveAndShareBlob(blob, filename, options) {
    const safeName = (filename || "export.bin").trim() || "export.bin";
    if (!(blob instanceof Blob)) {
      throw new Error("saveAndShareBlob: blob must be a Blob");
    }
    const capacitor = globalScope.Capacitor;
    const plugins = capacitor?.Plugins || {};
    const filesystem = plugins.Filesystem;
    const share = plugins.Share;
    if (!filesystem?.writeFile) {
      throw new Error("Capacitor Filesystem plugin unavailable");
    }

    const base64Data = await blobToBase64(blob);
    const writeRes = await filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: "DOCUMENTS",
      recursive: false
    });

    const shareTitle = options?.title || "Export File";
    const shareText = options?.text || "Here is the exported file.";
    const dialogTitle = options?.dialogTitle || "Share File";
    if (share?.share) {
      try {
        await share.share({
          title: shareTitle,
          text: shareText,
          url: writeRes.uri,
          dialogTitle
        });
      } catch (error) {
        console.warn("Capacitor share failed after file write; file remains saved", error);
      }
    }

    return writeRes.uri;
  }

  async function saveAndSharePdfBlob(pdfBlob, filename) {
    return saveAndShareBlob(pdfBlob, filename || "report.pdf", {
      title: "Export PDF Report",
      text: "Here is the report.",
      dialogTitle: "Share PDF"
    });
  }

  globalScope.exportPdfHelper = {
    blobToBase64,
    saveAndShareBlob,
    saveAndSharePdfBlob
  };
})(window);
