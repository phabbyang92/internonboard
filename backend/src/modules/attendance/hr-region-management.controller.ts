import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { UpdateHrRegionsDto } from './dto/update-hr-regions.dto';
import { HrRegionManagementService } from './hr-region-management.service';

@Controller('hr/admin/users')
@UseGuards(HrAuthGuard)
export class HrRegionManagementController {
  constructor(private readonly service: HrRegionManagementService) {}

  @Get()
  list(@Req() request: AuthenticatedHrRequest) {
    return this.service.list(this.getAccess(request));
  }

  @Patch(':hrUserId/regions')
  update(
    @Param('hrUserId') hrUserId: string,
    @Body() dto: UpdateHrRegionsDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.service.update(hrUserId, dto, this.getAccess(request));
  }

  private getAccess(request: AuthenticatedHrRequest): HrAccessContext {
    return {
      hrUserId: request.hrUser.sub,
      role: request.hrUser.role,
    };
  }
}
