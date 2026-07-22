import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HrLoginDto } from '../../modules/auth/dto/hr-login.dto';
import { StudentLoginDto } from '../../modules/auth/dto/student-login.dto';
import { ChangeStudentWorkLocationDto } from '../../modules/hr/dto/change-student-work-location.dto';
import { CreateStudentDto } from '../../modules/student/dto/create-student.dto';
import { ListStudentsQueryDto } from '../../modules/student/dto/list-students-query.dto';
import { UpdateStudentArrangementDto } from '../../modules/student/dto/update-student-arrangement.dto';
import { WorkLocation } from '../../modules/student/enums/student.enums';

describe('DTO validation and text normalization', () => {
  it('trims student identity fields before validation', async () => {
    const dto = plainToInstance(StudentLoginDto, {
      name: '  测试学生  ',
      email: '  student@example.com  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('测试学生');
    expect(dto.email).toBe('student@example.com');
  });

  it('rejects a name containing only whitespace', async () => {
    const dto = plainToInstance(CreateStudentDto, {
      name: '   ',
      email: 'student@example.com',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('requires the initial work location and start date together', async () => {
    const locationOnly = plainToInstance(CreateStudentDto, {
      name: '测试学生',
      email: 'student@example.com',
      workLocation: WorkLocation.ShanghaiOffice,
    });
    const completeArrangement = plainToInstance(CreateStudentDto, {
      name: '测试学生',
      email: 'student@example.com',
      workLocation: WorkLocation.ShanghaiOffice,
      onboardingStartAt: '2026-08-01T00:00:00+08:00',
    });

    const locationOnlyErrors = await validate(locationOnly);
    await expect(validate(completeArrangement)).resolves.toHaveLength(0);
    expect(
      locationOnlyErrors.some(
        (error) => error.property === 'onboardingStartAt',
      ),
    ).toBe(true);
  });

  it('trims HR email but does not modify the password', async () => {
    const dto = plainToInstance(HrLoginDto, {
      email: '  hr@example.com  ',
      password: ' Password123! ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('hr@example.com');
    expect(dto.password).toBe(' Password123! ');
  });

  it('allows an existing HR account to log in with a six-character password', async () => {
    const dto = plainToInstance(HrLoginDto, {
      email: 'hr1@example.com',
      password: '666666',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an unsupported work location', async () => {
    const dto = plainToInstance(UpdateStudentArrangementDto, {
      workLocation: '不存在的办公室',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'workLocation')).toBe(
      true,
    );
  });

  it('requires a valid location and date for a work-location change', async () => {
    const dto = plainToInstance(ChangeStudentWorkLocationDto, {
      workLocation: '不存在的办公室',
      effectiveFrom: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['workLocation', 'effectiveFrom']),
    );
  });

  it('rejects invalid pagination values', async () => {
    const dto = plainToInstance(ListStudentsQueryDto, {
      page: '0',
      limit: '101',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });

  it('rejects unsupported student-list filters', async () => {
    const dto = plainToInstance(ListStudentsQueryDto, {
      workLocation: '不存在的办公室',
      formStatus: 'unknown',
      onboardingStartMonth: '2026-13',
      sortBy: 'unknown',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'workLocation',
        'formStatus',
        'onboardingStartMonth',
        'sortBy',
      ]),
    );
  });
});
