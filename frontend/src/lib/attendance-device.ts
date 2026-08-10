export const ATTENDANCE_DEVICE_STORAGE_KEY = "attendance_device_id";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireBrowserStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("考勤设备标识只能在浏览器中使用");
  }

  return window.localStorage;
}

export function isValidAttendanceDeviceId(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export function getAttendanceDeviceId(): string | null {
  const storage = requireBrowserStorage();
  const storedDeviceId = storage.getItem(ATTENDANCE_DEVICE_STORAGE_KEY);

  if (!storedDeviceId || !isValidAttendanceDeviceId(storedDeviceId)) {
    return null;
  }

  return storedDeviceId;
}

export function getOrCreateAttendanceDeviceId(): string {
  const storage = requireBrowserStorage();
  const storedDeviceId = storage.getItem(ATTENDANCE_DEVICE_STORAGE_KEY);

  if (storedDeviceId && isValidAttendanceDeviceId(storedDeviceId)) {
    return storedDeviceId;
  }

  // 设备 ID 只用于“同一浏览器每日一次”的业务限制，不用于登录鉴权。
  const deviceId = crypto.randomUUID();
  storage.setItem(ATTENDANCE_DEVICE_STORAGE_KEY, deviceId);

  return deviceId;
}

export function clearAttendanceDeviceId(): void {
  requireBrowserStorage().removeItem(ATTENDANCE_DEVICE_STORAGE_KEY);
}
