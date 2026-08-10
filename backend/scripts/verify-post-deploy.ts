interface ProbeResponse {
  status?: unknown;
  service?: unknown;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数值`);
  }
  return value;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API Origin 只允许使用 HTTP 或 HTTPS');
  }
  return url.origin;
}

async function probe(
  origin: string,
  path: string,
  expectedStatus: string,
): Promise<void> {
  const response = await fetch(`${origin}/api${path}`, {
    headers: { 'X-Request-Id': `post-deploy-${Date.now()}` },
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json()) as ProbeResponse;

  if (!response.ok || body.status !== expectedStatus) {
    throw new Error(
      `${path} 未通过：HTTP ${response.status}, status=${String(body.status)}`,
    );
  }
  if (body.service !== 'intern-onboarding-api') {
    throw new Error(`${path} 返回了非预期服务标识`);
  }
  console.log(`${path} 通过：HTTP ${response.status}, status=${expectedStatus}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const origin = normalizeOrigin(
    readOption(args, '--api-origin') ??
      process.env.DEPLOYED_API_ORIGIN ??
      'http://127.0.0.1:3001',
  );

  await probe(origin, '/health/live', 'ok');
  await probe(origin, '/health/ready', 'ready');
  console.log(`部署后探针验证通过：${origin}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`部署后探针验证失败：${message}`);
  process.exitCode = 1;
});
