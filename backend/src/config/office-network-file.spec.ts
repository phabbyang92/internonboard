import { WorkLocation } from '../modules/student/enums/student.enums';
import { parseOfficeNetworkFile } from './office-network-file';

const completeNetworks = [
  WorkLocation.BeijingOffice,
  WorkLocation.HongKongOffice,
  WorkLocation.ShenzhenOffice,
  WorkLocation.ShenzhenInstitute,
  WorkLocation.ShanghaiOffice,
  WorkLocation.ShanghaiInstitute,
  WorkLocation.NanjingOffice,
].map((workLocation, index) => ({
  workLocation,
  cidrs: [`8.8.${index}.1/32`],
  enabled: true,
  description: null,
}));

describe('parseOfficeNetworkFile', () => {
  it('accepts a complete production office network configuration', () => {
    const result = parseOfficeNetworkFile(
      {
        updatedByHrEmail: 'ADMIN@EXAMPLE.COM',
        networks: completeNetworks,
      },
      { requireAllEnabled: true, requirePublicAddresses: true },
    );

    expect(result.updatedByHrEmail).toBe('admin@example.com');
    expect(result.networks).toHaveLength(7);
  });

  it('rejects missing office locations', () => {
    expect(() =>
      parseOfficeNetworkFile({
        updatedByHrEmail: 'admin@example.com',
        networks: completeNetworks.slice(0, -1),
      }),
    ).toThrow('配置文件缺少工作地点');
  });

  it('rejects private addresses in production mode', () => {
    const networks = completeNetworks.map((network, index) =>
      index === 0 ? { ...network, cidrs: ['192.168.1.1/32'] } : network,
    );

    expect(() =>
      parseOfficeNetworkFile(
        { updatedByHrEmail: 'admin@example.com', networks },
        { requireAllEnabled: true, requirePublicAddresses: true },
      ),
    ).toThrow('必须配置公网 IP/CIDR');
  });

  it('rejects a disabled location in production mode', () => {
    const networks = completeNetworks.map((network, index) =>
      index === 0 ? { ...network, enabled: false, cidrs: [] } : network,
    );

    expect(() =>
      parseOfficeNetworkFile(
        { updatedByHrEmail: 'admin@example.com', networks },
        { requireAllEnabled: true },
      ),
    ).toThrow('正式发布前必须配置公网出口 IP');
  });
});
