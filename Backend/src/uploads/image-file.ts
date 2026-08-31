export type AllowedImageMimeType = 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImageMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer.length >= 6) {
    const gifSignature = buffer.toString('ascii', 0, 6);
    if (gifSignature === 'GIF87a' || gifSignature === 'GIF89a') {
      return 'image/gif';
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
