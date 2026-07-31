import type { WorkLocation } from "@/types/student";

export const WORK_LOCATION_ADDRESSES: Partial<Record<WorkLocation, string>> = {
  北京办公室: "国贸写字楼二座2401室",
  香港办公室: "交易广场二期3006室",
  "深圳办公室 - 1302": "华润置地大厦E座1302室",
  "深圳办公室 - 41层": "华润置地大厦E座41楼",
  "上海办公室 - 会德丰": "会德丰国际广场",
  "上海办公室 - 绿地汇": "绿地汇B座1018室",
  南京办公室: "兴智科技园B栋401室",
};

export function getWorkLocationAddress(
  location: string | null | undefined,
): string | null {
  if (!location) return null;

  return WORK_LOCATION_ADDRESSES[location as WorkLocation] ?? null;
}
