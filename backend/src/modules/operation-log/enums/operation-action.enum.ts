export enum OperationAction {
  StudentCreated = 'student.created',
  StudentProfileUpdated = 'student.profile.updated',
  StudentArrangementUpdated = 'student.arrangement.updated',
  WorkLocationAssignmentUpdated = 'student.work_location_assignment.updated',
  WorkLocationAssignmentCancelled = 'student.work_location_assignment.cancelled',

  AttachmentUploaded = 'student.attachment.uploaded',
  AttachmentReplaced = 'student.attachment.replaced',
  AttachmentDeleted = 'student.attachment.deleted',

  StudentSoftDeleted = 'student.soft_deleted',
}
