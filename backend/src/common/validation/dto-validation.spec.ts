import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HrLoginDto } from '../../modules/auth/dto/hr-login.dto';
import { StudentLoginDto } from '../../modules/auth/dto/student-login.dto';
import { CreateStudentDto } from '../../modules/student/dto/create-student.dto';
import { ListStudentsQueryDto } from '../../modules/student/dto/list-students-query.dto';
import { UpdateStudentArrangementDto } from '../../modules/student/dto/update-student-arrangement.dto';

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

  it('trims HR email but does not modify the password', async () => {
    const dto = plainToInstance(HrLoginDto, {
      email: '  hr@example.com  ',
      password: ' Password123! ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('hr@example.com');
    expect(dto.password).toBe(' Password123! ');
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
});
