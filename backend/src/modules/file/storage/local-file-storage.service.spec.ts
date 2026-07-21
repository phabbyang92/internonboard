import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AttachmentType } from '../../student/enums/student.enums';
import { LocalFileStorageService } from './local-file-storage.service';

describe('LocalFileStorageService', () => {
  let uploadRoot: string;
  let service: LocalFileStorageService;

  beforeEach(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'intern-onboard-storage-'));
    const configService = {
      get: jest.fn().mockReturnValue(uploadRoot),
    } as unknown as ConfigService;
    service = new LocalFileStorageService(configService);
  });

  afterEach(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('saves a file under its student and attachment directories', async () => {
    const content = Buffer.from('%PDF-1.7 local storage test');

    const storageKey = await service.save({
      studentId: 'student-id',
      type: AttachmentType.Resume,
      originalName: 'resume.pdf',
      buffer: content,
    });

    expect(storageKey).toMatch(
      /^students\/student-id\/resume\/[0-9a-f-]+\.pdf$/,
    );
    await expect(readFile(join(uploadRoot, storageKey))).resolves.toEqual(
      content,
    );
  });

  it('creates a readable stream for an existing file', async () => {
    const storageKey = await service.save({
      studentId: 'student-id',
      type: AttachmentType.IdCardFront,
      originalName: 'identity.png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    expect(storageKey).toContain('/id-card-front/');

    const stream = await service.createReadStream(storageKey);

    expect(stream.readable).toBe(true);
    stream.destroy();
  });

  it('treats deleting an already missing file as successful', async () => {
    await expect(
      service.delete('students/student-id/resume/missing.pdf'),
    ).resolves.toBeUndefined();
  });

  it('rejects path traversal outside the upload root', async () => {
    await expect(service.delete('../../outside.txt')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns a business 404 for a missing download', async () => {
    await expect(
      service.createReadStream('students/student-id/resume/missing.pdf'),
    ).rejects.toThrow(NotFoundException);
  });
});
