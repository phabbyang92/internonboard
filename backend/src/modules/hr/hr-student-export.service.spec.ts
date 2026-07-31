import { NotFoundException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { HrRole } from '../auth/enums/hr-role.enum';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import {
  ApplicationDirection,
  OnboardingStatus,
  WorkLocation,
} from '../student/enums/student.enums';
import { StudentService } from '../student/student.service';
import { HrStudentExportService } from './hr-student-export.service';

const STUDENT_ID = '6a574ec45bd0f7b2a8b65a02';
const HR_ID = '6a574ec45bd0f7b2a8b65b99';
const HR_ACCESS: HrAccessContext = { hrUserId: HR_ID, role: HrRole.Hr };

describe('HrStudentExportService', () => {
  function createDependencies() {
    const studentService = {
      findOneByIdForHr: jest.fn(),
    };
    const operationLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    return {
      studentService,
      operationLogService,
      service: new HrStudentExportService(
        studentService as unknown as StudentService,
        operationLogService as unknown as OperationLogService,
      ),
    };
  }

  it('creates a readable XLSX containing every requested student section', async () => {
    const { service, studentService, operationLogService } =
      createDependencies();
    studentService.findOneByIdForHr.mockResolvedValue({
      id: STUDENT_ID,
      ownerHrId: HR_ID,
      name: '测试学生',
      email: 'student@example.com',
      phone: '13800138000',
      onboardingStatus: OnboardingStatus.Onboarded,
      basicInfo: {
        position: '咨询师助理',
        applicationDirection: ApplicationDirection.Consulting,
        sourceChannel: '官网',
        formDate: null,
        gender: '女',
        birthDate: new Date('2002-05-20T00:00:00.000Z'),
        idNumber: 'TEST-ID',
        householdRegistration: '上海',
        currentSchool: '测试大学',
        major: '经济学',
        degree: '本科',
        politicalStatus: '群众',
        homeAddress: '测试地址',
        homePhone: '02100000000',
      },
      educationExperiences: [
        {
          startYear: 2020,
          endYear: 2024,
          school: '测试大学',
          major: '经济学',
          advisor: '测试导师',
          phone: '02111111111',
        },
      ],
      familyMembers: [
        {
          relation: '父亲',
          name: '测试家长',
          employer: '测试单位',
          phone: '13900000000',
        },
      ],
      internshipExperiences: [
        {
          startYear: 2024,
          endYear: 2025,
          company: '测试公司',
          referenceName: '测试证明人',
          phone: '13700000000',
        },
      ],
      emergencyContactName: '紧急联系人',
      emergencyContactPhone: '13600000000',
      emergencyContactRelation: '家长',
      hasIdCopyAndAgreement: true,
      agreementSignedAt: null,
      notes: '补充说明',
      applicantSignature: '测试学生',
      applicantSignedAt: new Date('2026-07-01T00:00:00.000Z'),
      attachments: [],
      workLocation: WorkLocation.BeijingOffice,
      onboardingStartAt: new Date('2026-07-01T00:00:00.000Z'),
      onboardingEndAt: new Date('2026-09-30T00:00:00.000Z'),
      submittedAt: new Date('2026-07-15T08:30:00.000Z'),
      hasSubmitted: true,
      canEdit: false,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      hrMemo: null,
      hrMemoUpdatedByHrId: null,
      hrMemoUpdatedAt: null,
    });

    const result = await service.createExport(STUDENT_ID, HR_ACCESS);
    const workbook = new Workbook();
    await workbook.xlsx.load(result.buffer);
    const worksheet = workbook.getWorksheet('学生详情');
    const values: string[] = [];
    let formDateValue: unknown;

    worksheet?.eachRow((row) => {
      row.eachCell((cell, columnNumber) => {
        if (typeof cell.value === 'string') values.push(cell.value);
        if (cell.value === '填表日期') {
          formDateValue = row.getCell(columnNumber + 1).value;
        }
      });
    });

    expect(result.fileName).toBe('测试学生_学生详情.xlsx');
    expect(result.buffer.byteLength).toBeGreaterThan(1_000);
    expect(values).toEqual(
      expect.arrayContaining([
        '基本信息',
        '实习安排',
        '个人情况',
        '教育经历',
        '家庭成员',
        '校外实习或兼职经历',
        '补充信息',
        '测试学生',
        'student@example.com',
        '测试大学',
        '测试单位',
        '测试公司',
        '补充说明',
      ]),
    );
    expect(formDateValue).toBe('2026/07/15');
    expect(operationLogService.record).toHaveBeenCalledWith({
      operatorHrId: HR_ID,
      studentId: STUDENT_ID,
      action: OperationAction.StudentExported,
      changes: { format: 'xlsx' },
    });
  });

  it('does not create or log an export when HR access is denied', async () => {
    const { service, studentService, operationLogService } =
      createDependencies();
    studentService.findOneByIdForHr.mockRejectedValue(
      new NotFoundException('学生不存在'),
    );

    await expect(service.createExport(STUDENT_ID, HR_ACCESS)).rejects.toThrow(
      NotFoundException,
    );
    expect(operationLogService.record).not.toHaveBeenCalled();
  });
});
