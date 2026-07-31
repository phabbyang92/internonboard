import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { AttachmentType } from '../../student/enums/student.enums';
import { IdCardWatermarkService } from './id-card-watermark.service';

describe('IdCardWatermarkService', () => {
  function createService(template?: string) {
    const configService = {
      get: jest.fn().mockReturnValue(template),
    };

    return new IdCardWatermarkService(
      configService as unknown as ConfigService,
    );
  }

  it('returns resume bytes unchanged', async () => {
    const service = createService();
    const buffer = Buffer.from('%PDF-1.7 resume');

    const result = await service.process({
      type: AttachmentType.Resume,
      originalName: 'resume.pdf',
      studentName: '测试学生',
      buffer,
    });

    expect(result).toBe(buffer);
  });

  it('adds a visible watermark and keeps PNG output valid', async () => {
    const service = createService('仅限登记使用 · {studentName} · {date}');
    const input = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();

    const result = await service.process({
      type: AttachmentType.IdCardFront,
      originalName: '身份证正面.png',
      studentName: '张三',
      buffer: input,
    });

    expect(result.equals(input)).toBe(false);

    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(800);

    const { data } = await sharp(result)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const darkestChannel = data.reduce(
      (minimum, channel) => Math.min(minimum, channel),
      255,
    );
    expect(darkestChannel).toBeLessThan(240);
  });

  it('preserves JPEG output format after watermarking', async () => {
    const service = createService();
    const input = await sharp({
      create: {
        width: 640,
        height: 400,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.process({
      type: AttachmentType.IdCardBack,
      originalName: 'passport.jpeg',
      studentName: 'Test Student',
      buffer: input,
    });

    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(result.equals(input)).toBe(false);
  });

  it('rejects unreadable identity images before storage', async () => {
    const service = createService();

    await expect(
      service.process({
        type: AttachmentType.IdCardFront,
        originalName: 'identity.png',
        studentName: '测试学生',
        buffer: Buffer.from('not an image'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
