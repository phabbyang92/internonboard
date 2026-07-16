import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { HrUser, HrUserSchema } from './schemas/hr-user.schema';
import { AuthController } from './auth.controller';
import { HrAuthGuard } from './guards/hr-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HrUser.name, schema: HrUserSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  providers: [AuthService, HrAuthGuard],
  exports: [AuthService, HrAuthGuard, JwtModule],
  controllers: [AuthController],
})
export class AuthModule {}
