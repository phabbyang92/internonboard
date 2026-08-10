import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeaveRegistrationDto } from './create-leave-registration.dto';

describe('CreateLeaveRegistrationDto', () => {
  it('accepts one or more unique YYYY-MM-DD dates', async () => {
    const dto = plainToInstance(CreateLeaveRegistrationDto, {
      dates: ['2026-08-06', '2026-08-07'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    [{ dates: [] }, 'dates'],
    [{ dates: ['2026/08/06'] }, 'dates'],
    [{ dates: ['2026-08-06', '2026-08-06'] }, 'dates'],
    [{ dates: '2026-08-06' }, 'dates'],
  ])('rejects malformed leave payload %#', async (payload, property) => {
    const dto = plainToInstance(CreateLeaveRegistrationDto, payload);
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(property);
  });

  it('rejects more than 15 requested dates', async () => {
    const dto = plainToInstance(CreateLeaveRegistrationDto, {
      dates: Array.from(
        { length: 16 },
        (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
      ),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('dates');
  });

  it('rejects fields the student is not allowed to control', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          dates: ['2026-08-06'],
          studentId: '6a574ec45bd0f7b2a8b65a02',
          status: 'leave',
          source: 'leave_registration',
        },
        {
          type: 'body',
          metatype: CreateLeaveRegistrationDto,
        },
      ),
    ).rejects.toThrow();
  });
});
