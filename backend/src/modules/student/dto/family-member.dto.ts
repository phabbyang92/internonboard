import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FamilyMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  relation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  employer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
