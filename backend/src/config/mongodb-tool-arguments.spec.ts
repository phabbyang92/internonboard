import { buildMongodumpArguments } from '../../scripts/backup-mongodb';
import { buildMongorestoreArguments } from '../../scripts/verify-mongodb-backup';

describe('MongoDB Database Tools arguments', () => {
  it('uses unambiguous option=value arguments for mongodump', () => {
    expect(
      buildMongodumpArguments(
        'mongodb://127.0.0.1:27017/intern_onboarding',
        '/tmp/backup.archive.gz',
      ),
    ).toEqual([
      '--uri=mongodb://127.0.0.1:27017/intern_onboarding',
      '--archive=/tmp/backup.archive.gz',
      '--gzip',
    ]);
  });

  it('keeps restore namespaces scoped to the verification database', () => {
    expect(
      buildMongorestoreArguments(
        'mongodb://127.0.0.1:27017/intern_onboarding_restore_verification',
        '/tmp/backup.archive.gz',
        'intern_onboarding',
        'intern_onboarding_restore_verification',
      ),
    ).toEqual([
      '--uri=mongodb://127.0.0.1:27017/',
      '--archive=/tmp/backup.archive.gz',
      '--gzip',
      '--drop',
      '--nsFrom=intern_onboarding.*',
      '--nsTo=intern_onboarding_restore_verification.*',
    ]);
  });
});
