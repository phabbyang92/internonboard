import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { AttendanceDeviceService } from './attendance-device.service';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import type { AttendanceRecordDocument } from './schemas/attendance-record.schema';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_HASH =
  'a3a9e1ed9732cab28868127be00f1ce921acaefdd5c3b23a6e9e0072bd9c1a34';
const ATTENDANCE_DATE = '2026-08-06';

function createService(existingRecord: Record<string, unknown> | null = null) {
  const exec = jest.fn().mockResolvedValue(existingRecord);
  const model = {
    exists: jest.fn().mockReturnValue({ exec }),
  };

  return {
    model,
    exec,
    service: new AttendanceDeviceService(
      model as unknown as Model<AttendanceRecordDocument>,
    ),
  };
}

describe('AttendanceDeviceService', () => {
  it('hashes a valid UUID v4 with SHA-256', () => {
    const { service } = createService();

    expect(service.hashDeviceId(DEVICE_ID)).toBe(DEVICE_HASH);
  });

  it('normalizes UUID casing before hashing', () => {
    const { service } = createService();

    expect(service.hashDeviceId(DEVICE_ID.toUpperCase())).toBe(DEVICE_HASH);
  });

  it('rejects an invalid UUID even when called outside the DTO pipeline', () => {
    const { service } = createService();

    expect(() => service.hashDeviceId('browser-one')).toThrow(
      BadRequestException,
    );
  });

  it('checks only active check-in records for the device and business date', async () => {
    const { service, model } = createService({ _id: 'record-id' });

    await expect(
      service.isDeviceUsedOnDate(DEVICE_HASH, ATTENDANCE_DATE),
    ).resolves.toBe(true);
    expect(model.exists).toHaveBeenCalledWith({
      deviceIdHash: DEVICE_HASH,
      attendanceDate: ATTENDANCE_DATE,
      source: AttendanceSource.CheckIn,
    });
  });

  it('reports an unused device when no matching record exists', async () => {
    const { service } = createService(null);

    await expect(
      service.isDeviceUsedOnDate(DEVICE_HASH, ATTENDANCE_DATE),
    ).resolves.toBe(false);
  });

  it('rejects a device that has already checked in on the same date', async () => {
    const { service } = createService({ _id: 'record-id' });

    await expect(
      service.assertDeviceAvailable(DEVICE_HASH, ATTENDANCE_DATE),
    ).rejects.toMatchObject({
      response: {
        code: AttendanceErrorCode.DeviceAlreadyUsed,
        message: '该设备今天已经用于其他出勤登记',
      },
    });
  });

  it('allows the same device hash when the selected date has no record', async () => {
    const { service } = createService(null);

    await expect(
      service.assertDeviceAvailable(DEVICE_HASH, ATTENDANCE_DATE),
    ).resolves.toBeUndefined();
  });

  it('converts the device unique-index race into a business conflict', () => {
    const { service } = createService();

    expect(() =>
      service.throwIfDeviceAlreadyUsed({
        code: 11000,
        keyPattern: { deviceIdHash: 1, attendanceDate: 1 },
      }),
    ).toThrow(ConflictException);
  });

  it('recognizes a device duplicate by index name when keyPattern is absent', () => {
    const { service } = createService();

    expect(() =>
      service.throwIfDeviceAlreadyUsed({
        code: 11000,
        message:
          'duplicate key error index: unique_check_in_device_attendance_date',
      }),
    ).toThrow(ConflictException);
  });

  it('does not consume unrelated database errors', () => {
    const { service } = createService();

    expect(() =>
      service.throwIfDeviceAlreadyUsed({
        code: 11000,
        keyPattern: { studentId: 1, attendanceDate: 1 },
      }),
    ).not.toThrow();
    expect(() =>
      service.throwIfDeviceAlreadyUsed(new Error('connection failed')),
    ).not.toThrow();
  });

  it.each([
    ['invalid hash', '2026-08-06'],
    [DEVICE_HASH, '2026-02-30'],
    [DEVICE_HASH, '2026/08/06'],
  ])(
    'rejects invalid internal device/date input: %s, %s',
    async (deviceHash, attendanceDate) => {
      const { service, model } = createService();

      await expect(
        service.isDeviceUsedOnDate(deviceHash, attendanceDate),
      ).rejects.toThrow(BadRequestException);
      expect(model.exists).not.toHaveBeenCalled();
    },
  );
});
