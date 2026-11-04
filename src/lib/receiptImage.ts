/** Shrink a receipt photo to a JPEG the database can store. Returns raw base64, without the data-URL prefix. */
export function compressReceipt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Upload a photo of the receipt (JPG or PNG)"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const smaller = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] || "";
      const tiny = smaller.length > 1400000 ? canvas.toDataURL("image/jpeg", 0.5).split(",")[1] || "" : smaller;
      if (!tiny || tiny.length > 1400000) reject(new Error("That photo is too large. Crop it to the receipt."));
      else resolve(tiny);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo. Use a JPG or PNG screenshot."));
    };
    img.src = url;
  });
}

export function proofSetupMessage(message: string) {
  if (/payment_proofs|submit_payment_proof|schema cache/i.test(message)) {
    return "Run supabase/payment_proof.sql once in the Supabase SQL editor, then try again.";
  }
  return message;
}
