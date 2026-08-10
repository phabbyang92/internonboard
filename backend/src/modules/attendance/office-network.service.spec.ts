import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { WorkLocation } from '../student/enums/student.enums';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import { OfficeNetworkService } from './office-network.service';
import type { OfficeNetworkDocument } from './schemas/office-network.schema';

const NETWORK_ID = '6a574ec45bd0f7b2a8b65d01';

interface TestNetwork {
  _id: Types.ObjectId;
  workLocation: WorkLocation;
  cidrs: string[];
  enabled: boolean;
}

function network(overrides: Partial<TestNetwork> = {}): TestNetwork {
  return {
    _id: new Types.ObjectId(NETWORK_ID),
    workLocation: WorkLocation.ShanghaiOffice,
    cidrs: ['203.0.113.0/24'],
    enabled: true,
    ...overrides,
  };
}

function createService(configuredNetwork: TestNetwork | null) {
  const exec = jest.fn().mockResolvedValue(configuredNetwork);
  const lean = jest.fn().mockReturnValue({ exec });
  const model = {
    findOne: jest.fn().mockReturnValue({ lean }),
  };

  return {
    model,
    service: new OfficeNetworkService(
      model as unknown as Model<OfficeNetworkDocument>,
    ),
  };
}

describe('OfficeNetworkService', () => {
  it('accepts an IPv4 address inside the configured CIDR', async () => {
    const { service, model } = createService(network());

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '203.0.113.42'),
    ).resolves.toEqual({
      matchedOfficeNetworkId: NETWORK_ID,
      workLocation: WorkLocation.ShanghaiOffice,
      ipMatchSucceeded: true,
    });
    expect(model.findOne).toHaveBeenCalledWith({
      workLocation: WorkLocation.ShanghaiOffice,
      enabled: true,
    });
  });

  it('treats a plain IP configuration as an exact-address network', async () => {
    const { service } = createService(network({ cidrs: ['203.0.113.42'] }));

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '203.0.113.42'),
    ).resolves.toMatchObject({ ipMatchSucceeded: true });
    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '203.0.113.43'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('normalizes an IPv4-mapped IPv6 request address', async () => {
    const { service } = createService(network({ cidrs: ['127.0.0.1/32'] }));

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '::ffff:127.0.0.1'),
    ).resolves.toMatchObject({ ipMatchSucceeded: true });
  });

  it('supports IPv6 office network ranges', async () => {
    const { service } = createService(
      network({ cidrs: ['2001:db8:abcd::/48'] }),
    );

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '2001:db8:abcd::25'),
    ).resolves.toMatchObject({ ipMatchSucceeded: true });
  });

  it('rejects an IP outside the configured office network', async () => {
    const { service } = createService(network());

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, '198.51.100.20'),
    ).rejects.toMatchObject({
      response: {
        code: AttendanceErrorCode.OfficeNetworkRequired,
        message: '请连接当前办公室 Wi-Fi 后再登记出勤',
      },
    });
  });

  it.each([
    ['missing client IP', undefined, network()],
    ['missing office configuration', '203.0.113.42', null],
    ['empty CIDR list', '203.0.113.42', network({ cidrs: [] })],
    [
      'invalid CIDR configuration',
      '203.0.113.42',
      network({ cidrs: ['203.0.113.0/99'] }),
    ],
  ])('fails closed for %s', async (_label, clientIp, configuredNetwork) => {
    const { service } = createService(configuredNetwork);

    await expect(
      service.assertIpAllowed(WorkLocation.ShanghaiOffice, clientIp),
    ).rejects.toThrow(ForbiddenException);
  });

  it('queries only enabled configuration for the requested office', async () => {
    const { service, model } = createService(null);

    await expect(
      service.assertIpAllowed(WorkLocation.BeijingOffice, '203.0.113.42'),
    ).rejects.toThrow(ForbiddenException);
    expect(model.findOne).toHaveBeenCalledWith({
      workLocation: WorkLocation.BeijingOffice,
      enabled: true,
    });
  });

  it('rejects online and unknown locations before querying MongoDB', async () => {
    const { service, model } = createService(network());

    await expect(
      service.assertIpAllowed(WorkLocation.Online, '203.0.113.42'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.assertIpAllowed('不存在的地点', '203.0.113.42'),
    ).rejects.toThrow(BadRequestException);
    expect(model.findOne).not.toHaveBeenCalled();
  });
});
