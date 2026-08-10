import { WorkLocation } from '../../student/enums/student.enums';
import { RegionCode } from '../enums/region-code.enum';

// 地区权限使用稳定代码，不依赖可能会调整的地点展示名称。
// 旧名称作为别名保留，确保历史地点记录仍然可以判断地区。
export const WORK_LOCATION_REGION_MAP: Readonly<Record<string, RegionCode>> = {
  [WorkLocation.BeijingOffice]: RegionCode.Beijing,
  [WorkLocation.HongKongOffice]: RegionCode.HongKong,
  [WorkLocation.ShenzhenOffice]: RegionCode.Shenzhen,
  [WorkLocation.ShenzhenInstitute]: RegionCode.Shenzhen,
  [WorkLocation.ShanghaiOffice]: RegionCode.Shanghai,
  [WorkLocation.ShanghaiInstitute]: RegionCode.Shanghai,
  [WorkLocation.NanjingOffice]: RegionCode.Nanjing,
  [WorkLocation.Online]: RegionCode.Online,

  北京: RegionCode.Beijing,
  深圳办公室: RegionCode.Shenzhen,
  深圳研究院: RegionCode.Shenzhen,
  上海办公室: RegionCode.Shanghai,
  上海研究院: RegionCode.Shanghai,
  上海徐汇: RegionCode.Shanghai,
  上海静安: RegionCode.Shanghai,
};
