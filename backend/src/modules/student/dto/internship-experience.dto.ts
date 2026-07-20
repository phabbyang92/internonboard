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

export class InternshipExperienceDto {
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
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
