/**
 * Multer/Busboy may decode multipart filenames as Latin-1 even though browsers
 * send UTF-8 bytes. Convert that mojibake back to UTF-8, while preserving names
 * that were already decoded correctly.
 */
export function normalizeUploadedFileName(fileName: string): string {
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');

  // A replacement character means the input was not Latin-1-decoded UTF-8.
  return decoded.includes('\uFFFD') ? fileName : decoded;
}
