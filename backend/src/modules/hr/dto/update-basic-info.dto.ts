import { PartialType } from '@nestjs/mapped-types';
import { BasicInfoDto } from '../../student/dto/basic-info.dto';

// 学生首次提交时 BasicInfoDto 中有必填字段。
// HR 修改时可以只传需要更正的字段，因此使用 PartialType 将它们变成可选字段。
export class UpdateBasicInfoDto extends PartialType(BasicInfoDto) {}
