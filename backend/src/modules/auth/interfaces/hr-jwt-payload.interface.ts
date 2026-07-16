import { HrRole } from '../enums/hr-role.enum';

export interface HrJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: HrRole;
}
