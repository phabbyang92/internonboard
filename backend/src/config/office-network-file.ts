import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { OFFICE_WORK_LOCATIONS } from '../modules/attendance/attendance.constants';
import { WorkLocation } from '../modules/student/enums/student.enums';

export interface OfficeNetworkInput {
  workLocation: WorkLocation;
  cidrs: string[];
  enabled: boolean;
  description: string | null;
}

export interface OfficeNetworkFileConfig {
  updatedByHrEmail: string;
  networks: OfficeNetworkInput[];
}

interface ParseOfficeNetworkOptions {
  requireAllEnabled?: boolean;
  requirePublicAddresses?: boolean;
}

const OFFICE_LOCATION_SET = new Set<string>(OFFICE_WORK_LOCATIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrivateOrReservedIpv4(address: string): boolean {
  const [first, second, third] = address.split('.').map(Number);

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

function normalizeIpRange(
  value: unknown,
  location: string,
  requirePublicAddress: boolean,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${location} 的 cidrs 只能包含非空字符串`);
  }

  const normalized = value.trim();
  const parts = normalized.split('/');
  const address = parts[0];
  const family = isIP(address);

  if (parts.length > 2 || family === 0) {
    throw new Error(`${location} 包含无效 IP 或 CIDR：${normalized}`);
  }

  if (parts.length === 2) {
    const prefix = Number(parts[1]);
    const maximumPrefix = family === 4 ? 32 : 128;

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximumPrefix) {
      throw new Error(`${location} 包含无效 CIDR 前缀：${normalized}`);
    }
  }

  if (
    requirePublicAddress &&
    ((family === 4 && isPrivateOrReservedIpv4(address)) ||
      (family === 6 && isPrivateOrReservedIpv6(address)))
  ) {
    throw new Error(
      `${location} 必须配置公网 IP/CIDR，不能使用：${normalized}`,
    );
  }

  return normalized;
}

export function parseOfficeNetworkFile(
  value: unknown,
  options: ParseOfficeNetworkOptions = {},
): OfficeNetworkFileConfig {
  if (!isRecord(value)) {
    throw new Error('办公室网络配置必须是 JSON 对象');
  }

  const updatedByHrEmail = value.updatedByHrEmail;
  const networks = value.networks;

  if (
    typeof updatedByHrEmail !== 'string' ||
    updatedByHrEmail.trim().length === 0
  ) {
    throw new Error('配置文件缺少 updatedByHrEmail');
  }

  if (!Array.isArray(networks) || networks.length === 0) {
    throw new Error('配置文件中的 networks 必须是非空数组');
  }

  const seenLocations = new Set<string>();
  const parsedNetworks = networks.map((network, index) => {
    if (!isRecord(network)) {
      throw new Error(`networks[${index}] 必须是对象`);
    }

    const workLocation = network.workLocation;
    const cidrs = network.cidrs;
    const enabled = network.enabled;
    const description = network.description;

    if (
      typeof workLocation !== 'string' ||
      !OFFICE_LOCATION_SET.has(workLocation)
    ) {
      throw new Error(
        `networks[${index}] 包含无效线下工作地点：${String(workLocation)}`,
      );
    }

    if (seenLocations.has(workLocation)) {
      throw new Error(`工作地点重复：${workLocation}`);
    }
    seenLocations.add(workLocation);

    if (!Array.isArray(cidrs)) {
      throw new Error(`${workLocation} 的 cidrs 必须是数组`);
    }

    if (typeof enabled !== 'boolean') {
      throw new Error(`${workLocation} 的 enabled 必须是布尔值`);
    }

    if (enabled && cidrs.length === 0) {
      throw new Error(`${workLocation} 已启用，但没有配置任何 IP 或 CIDR`);
    }

    if (options.requireAllEnabled && !enabled) {
      throw new Error(
        `${workLocation} 尚未启用，正式发布前必须配置公网出口 IP`,
      );
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== 'string'
    ) {
      throw new Error(`${workLocation} 的 description 必须是字符串或 null`);
    }

    const normalizedCidrs = cidrs.map((cidr) =>
      normalizeIpRange(
        cidr,
        workLocation,
        options.requirePublicAddresses ?? false,
      ),
    );

    return {
      workLocation: workLocation as WorkLocation,
      cidrs: normalizedCidrs,
      enabled,
      description:
        typeof description === 'string' ? description.trim() || null : null,
    };
  });

  const missingLocations = OFFICE_WORK_LOCATIONS.filter(
    (location) => !seenLocations.has(location),
  );

  if (missingLocations.length > 0) {
    throw new Error(`配置文件缺少工作地点：${missingLocations.join('、')}`);
  }

  return {
    updatedByHrEmail: updatedByHrEmail.trim().toLowerCase(),
    networks: parsedNetworks,
  };
}

export async function loadOfficeNetworkFile(
  configPath: string,
  options: ParseOfficeNetworkOptions = {},
): Promise<OfficeNetworkFileConfig> {
  const absolutePath = resolve(process.cwd(), configPath);
  const source = await readFile(absolutePath, 'utf8').catch(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`无法读取办公室网络配置 ${absolutePath}：${message}`);
    },
  );

  try {
    return parseOfficeNetworkFile(JSON.parse(source) as unknown, options);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`办公室网络配置无效：${message}`);
  }
}
