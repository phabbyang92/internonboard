import { HrRole } from '../enums/hr-role.enum';

export interface HrAccessContext {
  hrUserId: string;
  role: HrRole;
}
