import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassThrough } from 'node:stream';
import { AttachmentType } from '../../student/enums/student.enums';
import {
  type OwnCloudClientFactory,
  OwnCloudFileStorageService,
} from './owncloud-file-storage.service';

describe('OwnCloudFileStorageService', () => {
  let client: {
    createDirectory: jest.Mock;
    putFileContents: jest.Mock;
    deleteFile: jest.Mock;
    exists: jest.Mock;
    createReadStream: jest.Mock;
  };
  let service: OwnCloudFileStorageService;

  beforeEach(() => {
    client = {
      createDirectory: jest.fn().mockResolvedValue(undefined),
      putFileContents: jest.fn().mockResolvedValue(true),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      createReadStream: jest.fn(),
    };

    const values: Record<string, string> = {
      WEBDAV_URL: 'http://localhost:8080/remote.php/dav/files/admin/',
      WEBDAV_USERNAME: 'admin',
      WEBDAV_PASSWORD: 'test-password',
      WEBDAV_REMOTE_PATH: '学生入职登记系统',
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (!value) {
          throw new Error(`Missing ${key}`);
        }
        return value;
      }),
    } as unknown as ConfigService;
    const clientFactory: OwnCloudClientFactory = jest
      .fn()
      .mockResolvedValue(client);

    service = new OwnCloudFileStorageService(configService, clientFactory);
  });

  it('uploads a file under the configured ownCloud directory', async () => {
    const storageKey = await service.save({
      studentId: 'student-id',
      type: AttachmentType.Resume,
      originalName: '张三_个人简历.pdf',
      buffer: Buffer.from('%PDF-1.7 ownCloud test'),
    });

    expect(storageKey).toMatch(
      /^students\/student-id\/resume\/[0-9a-f-]+\.pdf$/,
    );
    expect(client.createDirectory).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/学生入职登记系统\/students\/student-id\/resume$/,
      ),
      { recursive: true },
    );
    expect(client.putFileContents).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/学生入职登记系统\/students\/student-id\/resume\/[0-9a-f-]+\.pdf$/,
      ),
      expect.any(Buffer),
      { overwrite: false },
    );
  });

  it('returns a readable ownCloud stream for an existing file', async () => {
    const stream = new PassThrough();
    client.createReadStream.mockReturnValue(stream);

    await expect(
      service.createReadStream('students/student-id/resume/file.pdf'),
    ).resolves.toBe(stream);
    expect(client.exists).toHaveBeenCalledWith(
      '/学生入职登记系统/students/student-id/resume/file.pdf',
    );
  });

  it('returns a business 404 for a missing remote file', async () => {
    client.exists.mockResolvedValue(false);

    await expect(
      service.createReadStream('students/student-id/resume/missing.pdf'),
    ).rejects.toThrow(NotFoundException);
  });

  it('treats deleting an already missing remote file as successful', async () => {
    client.deleteFile.mockRejectedValue({ status: 404 });

    await expect(
      service.delete('students/student-id/resume/missing.pdf'),
    ).resolves.toBeUndefined();
  });

  it('rejects a storage key that escapes the remote directory', async () => {
    await expect(service.delete('../../outside.txt')).rejects.toThrow(
      BadRequestException,
    );
    expect(client.deleteFile).not.toHaveBeenCalled();
  });

  it('returns 503 when ownCloud cannot upload the file', async () => {
    client.putFileContents.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.save({
        studentId: 'student-id',
        type: AttachmentType.IdCardFront,
        originalName: 'identity.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
