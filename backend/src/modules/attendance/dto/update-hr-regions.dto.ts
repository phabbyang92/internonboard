import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { RegionCode } from '../enums/region-code.enum';

export class UpdateHrRegionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(RegionCode, { each: true })
  managedRegionCodes!: RegionCode[];
}
