import { detectImageMimeType } from './image-file';

describe('detectImageMimeType', () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [Buffer.from('GIF89a', 'ascii'), 'image/gif'],
    [Buffer.from('RIFF0000WEBP', 'ascii'), 'image/webp'],
  ])('detects supported image signatures', (buffer, expectedMimeType) => {
    expect(detectImageMimeType(buffer)).toBe(expectedMimeType);
  });

  it('rejects SVG, executable, and truncated content', () => {
    expect(detectImageMimeType(Buffer.from('<svg><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageMimeType(Buffer.from('MZ executable content'))).toBeNull();
    expect(detectImageMimeType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});
