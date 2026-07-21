export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiErrorResponse {
  message?: string | string[];
  statusCode?: number;
  path?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorMessage(data: unknown): string {
  if (typeof data !== "object" || data === null || !("message" in data)) {
    return "请求失败，请稍后重试";
  }

  const message = data.message;

  if (Array.isArray(message)) {
    return message.filter((item) => typeof item === "string").join("；");
  }

  return typeof message === "string" ? message : "请求失败，请稍后重试";
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  // FormData 必须由浏览器自动生成包含 boundary 的 Content-Type。
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      ...options,

      // 浏览器需要携带后端写入的 HttpOnly Cookie。
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError("无法连接服务器，请检查网络后重试", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(data),
      response.status,
      data as ApiErrorResponse,
    );
  }

  return data as T;
}
