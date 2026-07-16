import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateStudentArrangementDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: '工作地点不能为空' })
  @MaxLength(200)
  workLocation!: string;

  // Require a complete ISO 8601 date-time with timezone information.
  @IsISO8601({ strict: true })
  onboardingStartAt!: string;
}
