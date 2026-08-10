import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  BUSINESS_NOW_PROVIDER,
  type BusinessNowProvider,
} from './business-clock.constants';
import { BusinessClockService } from './business-clock.service';

const systemNowProvider: BusinessNowProvider = () => new Date();

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BUSINESS_NOW_PROVIDER,
      useValue: systemNowProvider,
    },
    BusinessClockService,
  ],
  exports: [BusinessClockService],
})
export class BusinessClockModule {}
