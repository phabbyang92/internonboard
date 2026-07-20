import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class EducationExperienceDto {
  // @Type 把前端可能传来的年份字符串转换成数字。
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  startYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  endYear!: number;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  school!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  major!: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  advisor?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
