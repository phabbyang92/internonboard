import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { resolve } from 'node:path';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { loadOfficeNetworkFile } from '../src/config/office-network-file';
import {
  OfficeNetwork,
  type OfficeNetworkDocument,
} from '../src/modules/attendance/schemas/office-network.schema';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';
const DEFAULT_CONFIG_PATH = 'config/office-networks.local.json';

function printUsage(): void {
  console.log(`
同步办公室 Wi-Fi 公网出口 IP：
  npm run sync:office-networks

可选参数：
  --file <配置文件>       默认 config/office-networks.local.json
  --updated-by <HR 邮箱>  覆盖配置文件中的 updatedByHrEmail
  --validate-only         只校验文件，不连接数据库
  --require-all-enabled   要求全部线下地点启用且使用公网 IP/CIDR

示例：
  npm run sync:office-networks -- --file config/office-networks.local.json
  npm run sync:office-networks -- --updated-by admin@example.com
  npm run sync:office-networks -- --file config/office-networks.production.json --require-all-enabled --validate-only
`);
}

function readOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 缺少参数值`);
  }

  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const configPath = readOption(args, '--file') ?? DEFAULT_CONFIG_PATH;
  const requireAllEnabled = args.includes('--require-all-enabled');
  const config = await loadOfficeNetworkFile(configPath, {
    requireAllEnabled,
    requirePublicAddresses: requireAllEnabled,
  });

  if (args.includes('--validate-only')) {
    console.log(
      `办公室网络配置校验通过：${resolve(process.cwd(), configPath)}`,
    );
    console.log(`  线下地点：${config.networks.length}`);
    console.log(
      `  已启用地点：${config.networks.filter((network) => network.enabled).length}`,
    );
    return;
  }
  const updatedByHrEmail = (
    readOption(args, '--updated-by') ?? config.updatedByHrEmail
  )
    .trim()
    .toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    const officeNetworkModel = app.get<Model<OfficeNetworkDocument>>(
      getModelToken(OfficeNetwork.name),
    );
    const hrUser = await hrUserModel
      .findOne({ email: updatedByHrEmail })
      .exec();

    if (!hrUser) {
      throw new Error(`找不到用于记录配置操作的 HR：${updatedByHrEmail}`);
    }

    let createdCount = 0;
    let updatedCount = 0;
    const now = new Date();

    for (const network of config.networks) {
      const result = await officeNetworkModel
        .updateOne(
          { workLocation: network.workLocation },
          {
            $set: {
              cidrs: network.cidrs,
              enabled: network.enabled,
              description: network.description,
              updatedByHrId: hrUser._id,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true, runValidators: true },
        )
        .exec();

      if (result.upsertedCount > 0) {
        createdCount += 1;
      } else if (result.modifiedCount > 0) {
        updatedCount += 1;
      }

      console.log(
        `  ${network.enabled ? '启用' : '停用'} ${network.workLocation}: ${network.cidrs.join(', ') || '无 IP'}`,
      );
    }

    console.log('办公室网络配置同步完成：');
    console.log(`  配置文件：${resolve(process.cwd(), configPath)}`);
    console.log(`  操作 HR：${hrUser.email}`);
    console.log(`  新建记录：${createdCount}`);
    console.log(`  更新记录：${updatedCount}`);
    console.log(`  处理总数：${config.networks.length}`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`同步办公室网络配置失败：${message}`);
  process.exitCode = 1;
});
