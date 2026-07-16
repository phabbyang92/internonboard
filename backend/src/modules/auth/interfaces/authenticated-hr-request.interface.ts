import type { Request } from 'express';
import type { HrJwtPayload } from './hr-jwt-payload.interface';

export interface AuthenticatedHrRequest extends Request {
  // The guard adds the verified HR identity to the request.
  hrUser: HrJwtPayload;
}
