import { HrRole } from '../enums/hr-role.enum';

export interface HrJwtPayload {
  sub: string;
  actor: 'hr';
  email: string;
  name: string;
  role: HrRole;
}
