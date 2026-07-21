import { normalizeUploadedFileName } from './normalize-uploaded-file-name';

describe('normalizeUploadedFileName', () => {
  it('restores a UTF-8 Chinese filename decoded as Latin-1', () => {
    const original = '中文简历.docx';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');

    expect(normalizeUploadedFileName(mojibake)).toBe(original);
  });

  it('keeps ASCII filenames unchanged', () => {
    expect(normalizeUploadedFileName('resume-2026.pdf')).toBe(
      'resume-2026.pdf',
    );
  });

  it('keeps an already decoded Unicode filename unchanged', () => {
    expect(normalizeUploadedFileName('中文简历.docx')).toBe('中文简历.docx');
    expect(normalizeUploadedFileName('résumé.pdf')).toBe('résumé.pdf');
  });
});
