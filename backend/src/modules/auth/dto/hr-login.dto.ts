import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/transforms/trim-string.transform';

export class HrLoginDto {
  @TrimString()
  @IsEmail()
  email!: string;

  @IsString()
  // 登录应兼容已有账号的密码长度，密码强度规则只应在创建账号时执行。
  @IsNotEmpty({ message: '请输入密码' })
  @MaxLength(128)
  password!: string;
}
