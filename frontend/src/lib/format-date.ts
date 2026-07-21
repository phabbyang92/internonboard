export function formatDateTime(value: string | null): string {
  if (!value) {
    return "未设置";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "日期无效";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    // 入职安排以中国办公室业务时间为准，避免 HR 在不同时区查看时偏移。
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function formatDateOnly(value: string | null): string {
  if (!value) {
    return "未设置";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "日期无效";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function toChinaDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function chinaDateInputToIso(value: string): string {
  // 数据库继续保存 Date；固定为中国时区当天零点，避免日期跨时区漂移。
  return new Date(`${value}T00:00:00+08:00`).toISOString();
}

export function getChinaTodayInput(): string {
  return toChinaDateInput(new Date().toISOString());
}
