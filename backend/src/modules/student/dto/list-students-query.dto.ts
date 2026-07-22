import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';
import {
  FormSubmissionStatus,
  OnboardingStatus,
  StudentListSort,
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

  @IsOptional()
  @TrimString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  onboardingStartMonth?: string;

  @IsOptional()
  @IsMongoId()
  ownerHrId?: string;

  @IsOptional()
  @IsEnum(StudentListSort)
  sortBy: StudentListSort = StudentListSort.CreatedAtDesc;
}
