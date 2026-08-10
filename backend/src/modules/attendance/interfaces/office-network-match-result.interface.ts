import { WorkLocation } from '../../student/enums/student.enums';

export interface OfficeNetworkMatchResult {
  matchedOfficeNetworkId: string;
  workLocation: WorkLocation;
  ipMatchSucceeded: true;
}
