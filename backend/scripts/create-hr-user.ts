import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { HrRole } from '../src/modules/auth/enums/hr-role.enum';
import {
  HrUser,
  type HrUserDocument,
} from '../src/modules/auth/schemas/hr-user.schema';

interface CreateHrArguments {
  email: string;
  password: string;
  name: string;
  role: HrRole;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

function printUsage(): void {
  console.log(`
创建 HR 账号：
  npm run create:hr -- --email <邮箱> --password <密码> [--name <姓名>] [--role hr|admin]

示例：
  npm run create:hr -- --email hr3@example.com --password 666666 --name "上海 HR"
  npm run create:hr -- --email admin@example.com --password StrongPass123 --name "总 HR" --role admin

也可以通过 HR_PASSWORD 环境变量传递密码，避免密码留在 shell 历史中：
  HR_PASSWORD=666666 npm run create:hr -- --email hr3@example.com --name "上海 HR"
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

function parseArguments(args: string[]): CreateHrArguments {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const email = readOption(args, '--email')?.trim().toLowerCase();
  const password =
    readOption(args, '--password') ?? process.env.HR_PASSWORD?.trim();
  const roleInput =
    readOption(args, '--role')?.trim().toLowerCase() ?? HrRole.Hr;

  if (!email) {
    throw new Error('请使用 --email 提供 HR 邮箱');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('HR 邮箱格式不正确');
  }

  if (!password) {
    throw new Error('请使用 --password 或 HR_PASSWORD 提供密码');
  }

  if (password.length < 6) {
    throw new Error('密码长度不能少于 6 位');
  }

  if (!Object.values(HrRole).includes(roleInput as HrRole)) {
    throw new Error('--role 只能是 hr 或 admin');
  }

  const name = readOption(args, '--name')?.trim() || email.split('@')[0];

  return {
    email,
    password,
    name,
    role: roleInput as HrRole,
  };
}

async function main(): Promise<void> {
  const input = parseArguments(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const hrUserModel = app.get<Model<HrUserDocument>>(
      getModelToken(HrUser.name),
    );
    const existingUser = await hrUserModel.exists({ email: input.email });

    if (existingUser) {
      throw new ConflictException(`HR 邮箱已存在：${input.email}`);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await hrUserModel.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      lastLoginAt: null,
    });

    console.log('HR 账号创建成功：');
    console.log(`  ID: ${user._id.toString()}`);
    console.log(`  姓名: ${user.name}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  角色: ${user.role}`);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(`HR 邮箱已存在：${input.email}`);
    }

    throw error;
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`创建 HR 账号失败：${message}`);
  process.exitCode = 1;
});
