import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadOfficeNetworkFile } from '../src/config/office-network-file';
import {
  assertProductionDatabaseName,
  getMongoDatabaseName,
  loadEnvironmentFile,
  validateFrontendReleaseEnvironment,
} from '../src/config/release-readiness';
import { validateEnvironment } from '../src/config/environment.validation';

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

function assertCommandAvailable(command: string): void {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });

  if (result.error || result.status !== 0) {
    throw new Error(`缺少命令 ${command}，请安装 MongoDB Database Tools`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const officeConfigPath = resolve(
    process.cwd(),
    readOption(args, '--office-networks') ??
      'config/office-networks.production.json',
  );
  const frontendEnvironmentPath = resolve(
    process.cwd(),
    readOption(args, '--frontend-env') ?? '../frontend/.env.production',
  );

  const backendEnvironment = validateEnvironment(process.env);
  if (backendEnvironment.NODE_ENV !== 'production') {
    throw new Error('8F 正式环境预检要求 NODE_ENV=production');
  }

  const databaseName = getMongoDatabaseName(
    String(backendEnvironment.MONGODB_URI),
  );
  assertProductionDatabaseName(databaseName);

  const remotePath = String(backendEnvironment.WEBDAV_REMOTE_PATH);
  if (/e2e|test/i.test(remotePath)) {
    throw new Error('正式 WEBDAV_REMOTE_PATH 不能使用测试目录名称');
  }

  const officeConfig = await loadOfficeNetworkFile(officeConfigPath, {
    requireAllEnabled: true,
    requirePublicAddresses: true,
  });
  const frontendEnvironment = validateFrontendReleaseEnvironment(
    await loadEnvironmentFile(frontendEnvironmentPath),
  );

  if (!args.includes('--skip-binaries')) {
    assertCommandAvailable('mongodump');
    assertCommandAvailable('mongorestore');
  }

  console.log('Phase 8F 正式环境配置预检通过：');
  console.log(`  MongoDB 数据库：${databaseName}`);
  console.log(`  前端 Origin：${String(backendEnvironment.FRONTEND_ORIGIN)}`);
  console.log(`  API Origin：${frontendEnvironment.apiOrigin}`);
  console.log(`  ownCloud 根目录：${remotePath}`);
  console.log(`  受信代理层数：${String(backendEnvironment.TRUST_PROXY_HOPS)}`);
  console.log(`  办公室网络：${officeConfig.networks.length} 个地点全部启用`);
  console.log(`  腾讯文档：${frontendEnvironment.documentTitle}`);
  console.log('  MongoDB Database Tools：可用');
  console.log('未打印 JWT、MongoDB 或 ownCloud 凭据。');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase 8F 正式环境配置预检失败：${message}`);
  process.exitCode = 1;
});
