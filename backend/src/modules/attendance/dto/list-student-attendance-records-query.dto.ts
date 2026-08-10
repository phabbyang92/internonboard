import { Matches } from 'class-validator';

export class ListStudentAttendanceRecordsQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '查询月份格式必须为 YYYY-MM',
  })
  month!: string;
}
