import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Model } from 'mongoose';
import { HrLoginDto } from './dto/hr-login.dto';
import { HrUser, HrUserDocument } from './schemas/hr-user.schema';
import type { HrJwtPayload } from './interfaces/hr-jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(HrUser.name)
    private readonly hrUserModel: Model<HrUserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: HrLoginDto) {
    const email = dto.email.trim().toLowerCase();

    const hrUser = await this.hrUserModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    const passwordMatches =
      hrUser && (await bcrypt.compare(dto.password, hrUser.passwordHash));

    if (!hrUser || !passwordMatches) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    hrUser.lastLoginAt = new Date();
    await hrUser.save();

    const payload: HrJwtPayload = {
      sub: hrUser._id.toString(),
      email: hrUser.email,
      name: hrUser.name,
      role: hrUser.role,
    };
    // The JWT proves which HR account has logged in.
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: hrUser._id.toString(),
        email: hrUser.email,
        name: hrUser.name,
        role: hrUser.role,
      },
    };
  }
}
