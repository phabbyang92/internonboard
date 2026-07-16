import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { UpdateStudentArrangementDto } from './update-student-arrangement.dto';

// Reuse workLocation and onboardingStartAt validation from the single DTO.
export class BatchUpdateStudentArrangementDto extends UpdateStudentArrangementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds!: string[];
}
