import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HrAuthGuard } from '../auth/guards/hr-auth.guard';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { UpdateOfficeNetworkDto } from './dto/update-office-network.dto';
import { OfficeNetworkManagementService } from './office-network-management.service';

@Controller('hr/attendance/office-networks')
@UseGuards(HrAuthGuard)
export class OfficeNetworkManagementController {
  constructor(
    private readonly officeNetworkManagementService: OfficeNetworkManagementService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedHrRequest) {
    return this.officeNetworkManagementService.list(this.getAccess(request));
  }

  @Put(':workLocation')
  update(
    @Param('workLocation') workLocation: string,
    @Body() dto: UpdateOfficeNetworkDto,
    @Req() request: AuthenticatedHrRequest,
  ) {
    return this.officeNetworkManagementService.update(
      workLocation,
      dto,
      this.getAccess(request),
    );
  }

  private getAccess(request: AuthenticatedHrRequest): HrAccessContext {
    return {
      hrUserId: request.hrUser.sub,
      role: request.hrUser.role,
    };
  }
}
