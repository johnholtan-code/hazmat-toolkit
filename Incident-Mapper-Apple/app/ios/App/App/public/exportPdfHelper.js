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

  function blobToFile(blob, filename) {
    const safeName = (filename || "export.bin").trim() || "export.bin";
    try {
      return new File([blob], safeName, {
        type: blob.type || "application/octet-stream",
        lastModified: Date.now()
      });
    } catch (_error) {
      return null;
    }
  }

  async function shareViaWebApi(blob, filename, options) {
    const nav = globalScope.navigator;
    if (!nav?.share) {
      throw new Error("Web Share API unavailable");
    }
    const file = blobToFile(blob, filename);
    const payload = {
      title: options?.title || "Export File",
      text: options?.text || "Here is the exported file."
    };
    if (file && nav.canShare?.({ files: [file] })) {
      payload.files = [file];
    }
    await nav.share(payload);
    return {
      uri: null,
      shared: true,
      transport: "web-share"
    };
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
      return shareViaWebApi(blob, safeName, options);
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
    let shared = false;
    if (share?.share) {
      try {
        await share.share({
          title: shareTitle,
          text: shareText,
          url: writeRes.uri,
          dialogTitle
        });
        shared = true;
      } catch (error) {
        if (options?.requireSharePrompt) {
          throw error;
        }
        console.warn("Capacitor share failed after file write; file remains saved", error);
      }
    } else if (options?.requireSharePrompt) {
      throw new Error("Capacitor Share plugin unavailable");
    }

    return {
      uri: writeRes.uri,
      shared
    };
  }

  async function saveAndSharePdfBlob(pdfBlob, filename) {
    return saveAndShareBlob(pdfBlob, filename || "report.pdf", {
      title: "Export PDF Report",
      text: "Here is the report.",
      dialogTitle: "Share PDF",
      requireSharePrompt: true
    });
  }

  globalScope.exportPdfHelper = {
    blobToBase64,
    blobToFile,
    saveAndShareBlob,
    saveAndSharePdfBlob
  };
})(window);
