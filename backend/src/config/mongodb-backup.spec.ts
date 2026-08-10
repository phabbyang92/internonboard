import {
  createMongoBackupFileName,
  parseMongoBackupMetadata,
} from './mongodb-backup';

describe('MongoDB backup helpers', () => {
  it('creates a filesystem-safe archive name', () => {
    expect(
      createMongoBackupFileName(
        'intern_onboarding',
        new Date('2026-08-07T12:34:56.789Z'),
      ),
    ).toBe('intern_onboarding-2026-08-07T12-34-56-789Z.archive.gz');
  });

  it('validates backup metadata', () => {
    expect(
      parseMongoBackupMetadata({
        version: 1,
        databaseName: 'intern_onboarding',
        createdAt: '2026-08-07T12:34:56.789Z',
        archiveFile: 'backup.archive.gz',
        sha256: 'a'.repeat(64),
        collectionCounts: { students: 10 },
      }),
    ).toMatchObject({ databaseName: 'intern_onboarding' });
  });

  it('rejects invalid checksums', () => {
    expect(() =>
      parseMongoBackupMetadata({
        version: 1,
        databaseName: 'intern_onboarding',
        createdAt: '2026-08-07T12:34:56.789Z',
        archiveFile: 'backup.archive.gz',
        sha256: 'invalid',
        collectionCounts: {},
      }),
    ).toThrow('字段不完整');
  });
});
