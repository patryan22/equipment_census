// Downscale camera photos (12MP+ from an iPhone) so they store small and upload fast.
export async function resizeImage(file, max = 1600, quality = 0.82) {
  let bmp;
  try {
    bmp = await createImageBitmap(file); // honors EXIF orientation in modern Safari
  } catch {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not read image'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image encode failed'))), 'image/jpeg', quality));
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
export async function blobToBase64(blob) { return (await blobToDataURL(blob)).split(',')[1]; }

export async function dataURLToBlob(url) { return (await fetch(url)).blob(); }
