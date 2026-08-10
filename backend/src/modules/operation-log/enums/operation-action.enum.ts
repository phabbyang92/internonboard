export enum OperationAction {
  StudentCreated = 'student.created',
  StudentProfileUpdated = 'student.profile.updated',
  StudentMemoUpdated = 'student.memo.updated',
  StudentArrangementUpdated = 'student.arrangement.updated',
  WorkLocationAssignmentUpdated = 'student.work_location_assignment.updated',
  WorkLocationAssignmentCancelled = 'student.work_location_assignment.cancelled',

  AttachmentUploaded = 'student.attachment.uploaded',
  AttachmentReplaced = 'student.attachment.replaced',
  AttachmentDeleted = 'student.attachment.deleted',

  StudentExported = 'student.exported',
  StudentSoftDeleted = 'student.soft_deleted',

  AttendanceCalendarCreated = 'attendance.calendar.created',
  AttendanceCalendarUpdated = 'attendance.calendar.updated',
  AttendanceCalendarDeleted = 'attendance.calendar.deleted',
  AttendanceRecordCorrected = 'attendance.record.corrected',
  HrRegionsUpdated = 'hr.regions.updated',
  OfficeNetworkUpdated = 'attendance.office_network.updated',
}
