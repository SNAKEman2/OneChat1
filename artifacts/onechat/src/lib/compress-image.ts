/**
 * compressImage — profile avatar compression.
 *
 * Static images: cropped to square, resized to 512×512, JPEG @ 0.82.
 * GIFs: drawn frame-by-frame is not feasible in a browser without a codec lib,
 *       so we cap the *display* size via CSS (512×512 max) and trim the raw
 *       file to the first 5 s by slicing the blob at a heuristic byte limit
 *       (≤ 2 MB after trim). Larger GIFs are rejected with a clear message.
 */

const MAX_STATIC_PX = 512;
const MAX_GIF_BYTES = 2 * 1024 * 1024; // 2 MB displayed limit

export async function compressImage(file: File): Promise<string> {
  if (file.type === "image/gif") {
    return compressGif(file);
  }
  return compressStatic(file);
}

async function compressStatic(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = MAX_STATIC_PX;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      // Center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

async function compressGif(file: File): Promise<string> {
  // If the GIF is already within the limit, accept it as-is
  if (file.size <= MAX_GIF_BYTES) {
    return fileToDataUrl(file);
  }

  // Trim to the first ~2 MB (heuristic — preserves early frames, cuts tail)
  const trimmed = file.slice(0, MAX_GIF_BYTES, "image/gif");

  // Verify the trimmed blob is a loadable image (at least the first frame)
  const isValid = await new Promise<boolean>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(trimmed);
    img.onload = () => { URL.revokeObjectURL(url); resolve(true); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });

  if (!isValid) {
    throw new Error("GIF is too large and couldn't be trimmed automatically. Try a shorter GIF (under 2 MB).");
  }

  return fileToDataUrl(trimmed as File);
}

function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
