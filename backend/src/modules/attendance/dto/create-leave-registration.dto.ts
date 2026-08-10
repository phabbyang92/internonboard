import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';
import {
  ATTENDANCE_DATE_PATTERN,
  LEAVE_REQUEST_MAX_DATES,
} from '../attendance.constants';

export class CreateLeaveRegistrationDto {
  // 只接收业务日期；学生 ID、状态和登记时间全部由后端确定。
  @IsArray()
  @ArrayMinSize(1, { message: '请至少选择一个请假日期' })
  @ArrayMaxSize(LEAVE_REQUEST_MAX_DATES, {
    message: '请假日期超出允许数量',
  })
  @ArrayUnique({ message: '请假日期不能重复' })
  @IsString({ each: true })
  @Matches(ATTENDANCE_DATE_PATTERN, {
    each: true,
    message: '请假日期格式必须为 YYYY-MM-DD',
  })
  dates!: string[];
}
