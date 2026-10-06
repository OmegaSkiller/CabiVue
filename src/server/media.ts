import sharp from 'sharp';
import { HttpError } from './errors.js';
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_FILE_BYTES = 6 * 1024 * 1024;
export async function normalizeImages(encoded: string[]): Promise<Buffer[]> {
  if (encoded.length < 1 || encoded.length > 3)
    throw new HttpError(400, 'Choose one to three images.');
  let total = 0;
  const images: Buffer[] = [];
  for (const text of encoded) {
    if (
      text.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(text) ||
      text.length % 4 !== 0
    )
      throw new HttpError(413, 'Each image must be at most 6 MB.');
    const bytes = Buffer.from(text, 'base64');
    if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, 'Each image must be at most 6 MB.');
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new HttpError(413, 'Images together must be at most 12 MB.');
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp)
      throw new HttpError(415, 'Use JPEG, PNG, or WebP photos. HEIC and PDF are not supported.');
    try {
      const image = sharp(bytes, {
        limitInputPixels: 24_000_000,
        failOn: 'warning',
        animated: false,
      });
      const meta = await image.metadata();
      if (
        !meta.width ||
        !meta.height ||
        meta.width < 40 ||
        meta.height < 40 ||
        (meta.pages || 1) > 1
      )
        throw new Error('Invalid dimensions');
      // Decode and re-encode, normalize orientation, remove EXIF/GPS metadata.
      images.push(
        await image
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer(),
      );
    } catch {
      throw new HttpError(
        400,
        'This photo cannot be decoded or exceeds 24 million pixels. Retake it or use manual entry.',
      );
    }
  }
  return images;
}
