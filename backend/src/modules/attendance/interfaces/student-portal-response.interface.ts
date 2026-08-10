import type { OnboardingStatus } from '../../student/enums/student.enums';
import type { StudentPortalState } from '../enums/student-portal-state.enum';

export interface StudentPortalResponse {
  portalState: StudentPortalState;
  student: {
    id: string;
    name: string;
    onboardingStatus: OnboardingStatus;
  };
}
