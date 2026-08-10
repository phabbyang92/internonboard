import { HrRole } from '../auth/enums/hr-role.enum';
import type { AuthenticatedHrRequest } from '../auth/interfaces/authenticated-hr-request.interface';
import type { ListHrDailyAttendanceQueryDto } from './dto/list-hr-daily-attendance-query.dto';
import type { ListHrAttendanceSummaryQueryDto } from './dto/list-hr-attendance-summary-query.dto';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { HrAttendanceController } from './hr-attendance.controller';
import type { HrAttendanceSummaryService } from './hr-attendance-summary.service';
import type { HrAttendanceCorrectionService } from './hr-attendance-correction.service';
import type { HrDailyAttendanceService } from './hr-daily-attendance.service';
import type { HrStudentAttendanceService } from './hr-student-attendance.service';

const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';

function createController() {
  const dailyAttendanceService = {
    listDaily: jest.fn(),
  };
  const attendanceSummaryService = {
    listSummary: jest.fn(),
  };
  const studentAttendanceService = {
    getStudentAttendance: jest.fn(),
  };
  const attendanceCorrectionService = {
    correctAttendance: jest.fn(),
  };
  const controller = new HrAttendanceController(
    dailyAttendanceService as unknown as HrDailyAttendanceService,
    attendanceSummaryService as unknown as HrAttendanceSummaryService,
    studentAttendanceService as unknown as HrStudentAttendanceService,
    attendanceCorrectionService as unknown as HrAttendanceCorrectionService,
  );
  const request = {
    hrUser: {
      sub: HR_ID,
      actor: 'hr' as const,
      email: 'hr@example.com',
      name: '测试 HR',
      role: HrRole.Hr,
    },
  } as unknown as AuthenticatedHrRequest;

  return {
    controller,
    dailyAttendanceService,
    attendanceSummaryService,
    studentAttendanceService,
    attendanceCorrectionService,
    request,
  };
}

describe('HrAttendanceController', () => {
  it('passes the verified HR identity to the daily attendance service', async () => {
    const response = { attendanceDate: '2026-08-07' };
    const { controller, dailyAttendanceService, request } = createController();
    dailyAttendanceService.listDaily.mockResolvedValue(response);
    const query = {
      date: '2026-08-07',
      page: 1,
      limit: 20,
    } as ListHrDailyAttendanceQueryDto;

    await expect(controller.listDaily(query, request)).resolves.toBe(response);
    expect(dailyAttendanceService.listDaily).toHaveBeenCalledWith(query, {
      hrUserId: HR_ID,
      role: HrRole.Hr,
    });
  });

  it('passes the verified HR identity to the monthly summary service', async () => {
    const response = { month: '2026-08' };
    const { controller, attendanceSummaryService, request } =
      createController();
    attendanceSummaryService.listSummary.mockResolvedValue(response);
    const query = {
      month: '2026-08',
      page: 1,
      limit: 20,
    } as ListHrAttendanceSummaryQueryDto;

    await expect(controller.listSummary(query, request)).resolves.toBe(
      response,
    );
    expect(attendanceSummaryService.listSummary).toHaveBeenCalledWith(query, {
      hrUserId: HR_ID,
      role: HrRole.Hr,
    });
  });

  it('passes the student ID, month and verified HR identity to the detail service', async () => {
    const response = { month: '2026-08', items: [] };
    const { controller, studentAttendanceService, request } =
      createController();
    studentAttendanceService.getStudentAttendance.mockResolvedValue(response);
    const query = { month: '2026-08' };

    await expect(
      controller.getStudentAttendance(STUDENT_ID, query, request),
    ).resolves.toBe(response);
    expect(studentAttendanceService.getStudentAttendance).toHaveBeenCalledWith(
      STUDENT_ID,
      query,
      {
        hrUserId: HR_ID,
        role: HrRole.Hr,
      },
    );
  });

  it('passes a controlled correction payload and verified HR identity to the correction service', async () => {
    const response = { message: '考勤记录更正成功' };
    const { controller, attendanceCorrectionService, request } =
      createController();
    attendanceCorrectionService.correctAttendance.mockResolvedValue(response);
    const dto = {
      status: AttendanceStatus.Leave,
      reason: '补录已批准请假',
    };

    await expect(
      controller.correctAttendance(STUDENT_ID, '2026-08-07', dto, request),
    ).resolves.toBe(response);
    expect(attendanceCorrectionService.correctAttendance).toHaveBeenCalledWith(
      STUDENT_ID,
      '2026-08-07',
      dto,
      {
        hrUserId: HR_ID,
        role: HrRole.Hr,
      },
    );
  });
});
