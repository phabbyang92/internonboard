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

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  school!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  major!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  advisor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
