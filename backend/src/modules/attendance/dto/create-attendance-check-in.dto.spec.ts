import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckInMode } from '../enums/check-in-mode.enum';
import { CreateAttendanceCheckInDto } from './create-attendance-check-in.dto';

describe('CreateAttendanceCheckInDto', () => {
  it.each([CheckInMode.Online, CheckInMode.Offline])(
    'accepts %s check-in with a UUID v4 device identifier',
    async (checkInMode) => {
      const dto = plainToInstance(CreateAttendanceCheckInDto, {
        checkInMode,
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects an unsupported check-in mode and malformed device identifier', async () => {
    const dto = plainToInstance(CreateAttendanceCheckInDto, {
      checkInMode: 'office',
      deviceId: 'browser-one',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['checkInMode', 'deviceId']),
    );
  });

  it('rejects request fields that the student is not allowed to control', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          checkInMode: CheckInMode.Online,
          deviceId: '550e8400-e29b-41d4-a716-446655440000',
          studentId: '6a574ec45bd0f7b2a8b65a02',
          attendanceDate: '2026-08-06',
          checkInAt: '2026-08-06T01:00:00.000Z',
          ipAddress: '203.0.113.1',
        },
        {
          type: 'body',
          metatype: CreateAttendanceCheckInDto,
        },
      ),
    ).rejects.toThrow();
  });
});
