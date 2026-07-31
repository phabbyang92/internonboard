import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import sharp from 'sharp';
import { AttachmentType } from '../../student/enums/student.enums';
import { MAX_ATTACHMENT_FILE_SIZE_BYTES } from '../validation/attachment-file.validator';

interface ProcessAttachmentInput {
  type: AttachmentType;
  originalName: string;
  studentName: string;
  buffer: Buffer;
}

const DEFAULT_WATERMARK_TEMPLATE =
  '仅限学生入职登记使用 · {studentName} · {date}';
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_OUTPUT_DIMENSION = 4_096;

@Injectable()
export class IdCardWatermarkService {
  private readonly watermarkTemplate: string;

  constructor(configService: ConfigService) {
    this.watermarkTemplate =
      configService.get<string>('ID_CARD_WATERMARK_TEXT')?.trim() ||
      DEFAULT_WATERMARK_TEMPLATE;
  }

  async process(input: ProcessAttachmentInput): Promise<Buffer> {
    if (!this.isIdentityDocument(input.type)) {
      return input.buffer;
    }

    const extension = extname(input.originalName).toLowerCase();

    if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
      throw new BadRequestException('身份证件只支持 JPG、JPEG 或 PNG 图片');
    }

    const watermarkText = this.resolveWatermarkText(input.studentName);

    try {
      const metadata = await sharp(input.buffer, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
      const outputSize = this.calculateOutputSize(
        metadata.autoOrient.width,
        metadata.autoOrient.height,
      );
      const watermarkOverlay = this.createWatermarkOverlay(
        watermarkText,
        outputSize.width,
        outputSize.height,
      );

      let pipeline = sharp(input.buffer, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: MAX_OUTPUT_DIMENSION,
          height: MAX_OUTPUT_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .composite([
          {
            input: watermarkOverlay,
            blend: 'over',
          },
        ]);

      // Re-encoding strips EXIF and ensures only the watermarked pixels persist.
      pipeline =
        extension === '.png'
          ? pipeline.png({ compressionLevel: 9 })
          : pipeline.jpeg({ quality: 90, mozjpeg: true });

      const watermarkedBuffer = await pipeline.toBuffer();

      if (watermarkedBuffer.length > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          '处理后的身份证图片超过 10 MB，请压缩后重新上传',
        );
      }

      return watermarkedBuffer;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        '身份证图片无法读取或处理，请重新选择有效图片',
      );
    }
  }

  private isIdentityDocument(type: AttachmentType): boolean {
    return (
      type === AttachmentType.IdCardFront || type === AttachmentType.IdCardBack
    );
  }

  private resolveWatermarkText(studentName: string): string {
    return this.watermarkTemplate
      .replaceAll('{studentName}', studentName.trim())
      .replaceAll('{date}', this.getChinaDate());
  }

  private getChinaDate(): string {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private calculateOutputSize(
    originalWidth: number,
    originalHeight: number,
  ): { width: number; height: number } {
    const scale = Math.min(
      1,
      MAX_OUTPUT_DIMENSION / originalWidth,
      MAX_OUTPUT_DIMENSION / originalHeight,
    );

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  private createWatermarkOverlay(
    text: string,
    width: number,
    height: number,
  ): Buffer {
    const escapedText = this.escapeXml(text);
    const elements: string[] = [];
    const columnGap = 620;
    const rowGap = 230;

    for (let row = -1, y = -40; y < height + rowGap; row += 1, y += rowGap) {
      const offset = row % 2 === 0 ? 0 : -columnGap / 2;

      for (let x = offset; x < width + columnGap; x += columnGap) {
        elements.push(`
          <text
            x="${x}"
            y="${y}"
            text-anchor="middle"
            dominant-baseline="middle"
            transform="rotate(-18 ${x} ${y})"
            font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif"
            font-size="22"
            font-weight="600"
            fill="rgba(24, 66, 104, 0.24)"
            textLength="500"
            lengthAdjust="spacingAndGlyphs"
          >${escapedText}</text>
        `);
      }
    }

    return Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${elements.join('')}
      </svg>
    `);
  }

  private escapeXml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }
}
