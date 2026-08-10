import type { ConfigService } from '@nestjs/config';
import { OperationMonitorService } from '../../common/observability/operation-monitor.service';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { RegionAccessService } from './access/region-access.service';
import { AttendanceOperationsController } from './attendance-operations.controller';

describe('AttendanceOperationsController', () => {
  it('checks current Admin access before returning a secret-free snapshot', async () => {
    const monitor = new OperationMonitorService();
    const assertAdmin = jest.fn().mockResolvedValue(undefined);
    const regionAccessService = {
      assertAdmin,
    } as unknown as RegionAccessService;
    const config = {
      get: jest.fn().mockReturnValue('true'),
    } as unknown as ConfigService;
    const controller = new AttendanceOperationsController(
      monitor,
      regionAccessService,
      config,
    );
    const request = {
      hrUser: {
        sub: '6a574ec45bd0f7b2a8b65b99',
        actor: 'hr',
        email: 'admin@example.com',
        name: 'Admin',
        role: HrRole.Admin,
      },
    } as AuthenticatedHrRequest;

    const result = await controller.getOperations(request);

    expect(assertAdmin).toHaveBeenCalledWith({
      hrUserId: request.hrUser.sub,
      role: HrRole.Admin,
    });
    expect(result.attendanceCronEnabled).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain('admin@example.com');
  });
});
