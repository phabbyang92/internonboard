import { IsEnum, IsISO8601 } from 'class-validator';
import { WorkLocation } from '../../student/enums/student.enums';

export class UpdateWorkLocationAssignmentDto {
  @IsEnum(WorkLocation, { message: '请选择有效的工作地点' })
  workLocation!: WorkLocation;

  @IsISO8601({ strict: true }, { message: '地点生效日期格式错误' })
  effectiveFrom!: string;
}
