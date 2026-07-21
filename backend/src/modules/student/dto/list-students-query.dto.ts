import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import {
  FormSubmissionStatus,
  OnboardingStatus,
  WorkLocation,
} from '../enums/student.enums';

export class ListStudentsQueryDto {
  // Query parameters arrive as strings, so convert them to numbers.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsEnum(OnboardingStatus)
  status?: OnboardingStatus;

  @IsOptional()
  @IsEnum(WorkLocation)
  workLocation?: WorkLocation;

  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  formStatus?: FormSubmissionStatus;
}
