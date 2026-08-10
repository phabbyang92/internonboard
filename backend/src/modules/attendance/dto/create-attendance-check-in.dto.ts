import { IsEnum, IsUUID } from 'class-validator';
import { CheckInMode } from '../enums/check-in-mode.enum';

export class CreateAttendanceCheckInDto {
  // 学生只选择实际签到方式；安排地点由后端按当天排班读取。
  @IsEnum(CheckInMode)
  checkInMode!: CheckInMode;

  // 前端使用 crypto.randomUUID() 生成；它只用于每日设备次数限制。
  @IsUUID('4')
  deviceId!: string;
}
