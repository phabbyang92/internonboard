import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BlockList, isIP } from 'node:net';
import type { Model } from 'mongoose';
import { WorkLocation } from '../student/enums/student.enums';
import { OFFICE_WORK_LOCATIONS } from './attendance.constants';
import { AttendanceErrorCode } from './enums/attendance-error-code.enum';
import type { OfficeNetworkMatchResult } from './interfaces/office-network-match-result.interface';
import {
  OfficeNetwork,
  type OfficeNetworkDocument,
} from './schemas/office-network.schema';

type IpFamily = 'ipv4' | 'ipv6';

interface ParsedNetwork {
  address: string;
  family: IpFamily;
  prefix: number;
}

const SUPPORTED_OFFICE_LOCATIONS: readonly string[] = OFFICE_WORK_LOCATIONS;

@Injectable()
export class OfficeNetworkService {
  constructor(
    @InjectModel(OfficeNetwork.name)
    private readonly officeNetworkModel: Model<OfficeNetworkDocument>,
  ) {}

  async assertIpAllowed(
    workLocation: string,
    clientIp: string | undefined,
  ): Promise<OfficeNetworkMatchResult> {
    const officeLocation = this.parseOfficeLocation(workLocation);
    const normalizedClientIp = this.normalizeIpAddress(clientIp);

    if (!normalizedClientIp) {
      throw this.officeNetworkRequiredException();
    }

    const network = await this.officeNetworkModel
      .findOne({
        workLocation: officeLocation,
        enabled: true,
      })
      .lean()
      .exec();

    if (
      !network ||
      !network.cidrs.length ||
      !this.matchesAnyNetwork(normalizedClientIp, network.cidrs)
    ) {
      throw this.officeNetworkRequiredException();
    }

    return {
      matchedOfficeNetworkId: network._id.toString(),
      workLocation: officeLocation,
      ipMatchSucceeded: true,
    };
  }

  private matchesAnyNetwork(clientIp: string, cidrs: string[]): boolean {
    const clientFamily = this.getIpFamily(clientIp);

    if (!clientFamily) {
      return false;
    }

    return cidrs.some((cidr) => {
      const parsedNetwork = this.parseNetwork(cidr);

      if (!parsedNetwork || parsedNetwork.family !== clientFamily) {
        return false;
      }

      const blockList = new BlockList();
      blockList.addSubnet(
        parsedNetwork.address,
        parsedNetwork.prefix,
        parsedNetwork.family,
      );

      return blockList.check(clientIp, clientFamily);
    });
  }

  private parseNetwork(value: string): ParsedNetwork | null {
    const parts = value.trim().split('/');

    if (parts.length > 2 || !parts[0]) {
      return null;
    }

    const address = this.normalizeIpAddress(parts[0]);
    const family = address ? this.getIpFamily(address) : null;

    if (!address || !family) {
      return null;
    }

    const maximumPrefix = family === 'ipv4' ? 32 : 128;
    const prefix =
      parts.length === 1 ? maximumPrefix : Number(parts[1]?.trim());

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximumPrefix) {
      return null;
    }

    return { address, family, prefix };
  }

  private normalizeIpAddress(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    let normalized = value.trim();

    // Express 在双栈环境下可能把 IPv4 表示为 IPv4-mapped IPv6。
    if (normalized.toLowerCase().startsWith('::ffff:')) {
      const mappedIpv4 = normalized.slice(7);

      if (isIP(mappedIpv4) === 4) {
        normalized = mappedIpv4;
      }
    }

    // 去掉本机链路 IPv6 可能携带的 zone id，例如 fe80::1%lo0。
    const zoneIndex = normalized.indexOf('%');

    if (zoneIndex !== -1) {
      normalized = normalized.slice(0, zoneIndex);
    }

    return isIP(normalized) === 0 ? null : normalized.toLowerCase();
  }

  private getIpFamily(value: string): IpFamily | null {
    const family = isIP(value);

    if (family === 4) {
      return 'ipv4';
    }

    if (family === 6) {
      return 'ipv6';
    }

    return null;
  }

  private parseOfficeLocation(workLocation: string): WorkLocation {
    if (!SUPPORTED_OFFICE_LOCATIONS.includes(workLocation)) {
      throw new BadRequestException('当前工作地点不支持线下签到');
    }

    return workLocation as WorkLocation;
  }

  private officeNetworkRequiredException(): ForbiddenException {
    return new ForbiddenException({
      code: AttendanceErrorCode.OfficeNetworkRequired,
      message: '请连接当前办公室 Wi-Fi 后再登记出勤',
    });
  }
}
