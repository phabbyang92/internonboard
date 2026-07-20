import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SoftDeleteStudentDto {
  // 删除原因可选；填写时不能是空字符串，最长 500 个字符。
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
