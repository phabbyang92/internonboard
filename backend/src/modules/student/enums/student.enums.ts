export enum OnboardingStatus {
  Candidate = 'candidate',
  PendingOnboarding = 'pending_onboarding',
  Onboarded = 'onboarded',
  Departed = 'departed',
}

export enum FormSubmissionStatus {
  NotSubmitted = 'not_submitted',
  Submitted = 'submitted',
}

export enum StudentListSort {
  CreatedAtDesc = 'created_at_desc',
  OnboardingStartAtDesc = 'onboarding_start_at_desc',
  OnboardingStartAtAsc = 'onboarding_start_at_asc',
}

export enum AttachmentType {
  Resume = 'resume',
  IdCardFront = 'id_card_front',
  IdCardBack = 'id_card_back',
}
export enum ApplicationDirection {
  Consulting = '咨询',
  NewMedia = '新媒体',
  Ai = 'ai',
}
export enum WorkLocation {
  BeijingOffice = '北京办公室',
  HongKongOffice = '香港办公室',
  ShenzhenOffice = '深圳办公室',
  ShenzhenInstitute = '深圳研究院',
  ShanghaiOffice = '上海办公室',
  ShanghaiInstitute = '上海研究院',
  NanjingOffice = '南京办公室',
  Online = '线上',
}
