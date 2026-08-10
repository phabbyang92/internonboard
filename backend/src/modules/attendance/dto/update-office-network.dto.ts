import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateOfficeNetworkDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  cidrs!: string[];

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;
}
