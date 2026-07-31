import { Injectable } from '@nestjs/common';
import { Workbook, type Cell, type Worksheet } from 'exceljs';
import type { HrAccessContext } from '../auth/interfaces/hr-access-context.interface';
import { OperationAction } from '../operation-log/enums/operation-action.enum';
import { OperationLogService } from '../operation-log/operation-log.service';
import { StudentService } from '../student/student.service';

type ExportStudent = Awaited<ReturnType<StudentService['findOneByIdForHr']>>;

type ExportValue = string | number | boolean | Date | null | undefined;

const CHINA_TIME_ZONE = 'Asia/Shanghai';
const BORDER_COLOR = 'FFCCD8E3';
const SECTION_FILL = 'FF184268';
const HEADER_FILL = 'FFEAF1F7';

@Injectable()
export class HrStudentExportService {
  constructor(
    private readonly studentService: StudentService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async createExport(studentId: string, access: HrAccessContext) {
    // Reuse the detail lookup so export follows the same HR ownership rules.
    const student = await this.studentService.findOneByIdForHr(
      studentId,
      access,
    );
    const workbook = this.buildWorkbook(student);
    const arrayBuffer = await workbook.xlsx.writeBuffer();

    await this.operationLogService.record({
      operatorHrId: access.hrUserId,
      studentId,
      action: OperationAction.StudentExported,
      changes: { format: 'xlsx' },
    });

    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: `${this.safeFileName(student.name)}_学生详情.xlsx`,
    };
  }

  private buildWorkbook(student: ExportStudent): Workbook {
    const workbook = new Workbook();
    workbook.creator = '学生入职登记系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('学生详情', {
      views: [{ state: 'frozen', ySplit: 2 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      },
    });

    worksheet.columns = [
      { width: 18 },
      { width: 23 },
      { width: 18 },
      { width: 23 },
      { width: 18 },
      { width: 23 },
    ];

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${student.name} - 学生详情`;
    titleCell.font = {
      name: 'Microsoft YaHei',
      size: 18,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SECTION_FILL },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 34;

    worksheet.mergeCells('A2:F2');
    const exportedAtCell = worksheet.getCell('A2');
    exportedAtCell.value = `导出时间：${this.formatDateTime(new Date())}`;
    exportedAtCell.font = {
      name: 'Microsoft YaHei',
      size: 10,
      color: { argb: 'FF5F7285' },
    };
    exportedAtCell.alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    this.addPairSection(worksheet, '基本信息', [
      ['姓名', student.name, '邮箱', student.email, '手机号', student.phone],
    ]);

    this.addPairSection(worksheet, '实习安排', [
      [
        '实习开始日期',
        this.formatDate(student.onboardingStartAt),
        '实习结束日期',
        this.formatDate(student.onboardingEndAt),
        '工作地点',
        student.workLocation,
      ],
    ]);

    const basic = student.basicInfo;
    this.addPairSection(worksheet, '个人情况', [
      [
        '申请职位',
        basic?.position,
        '投递方向',
        basic?.applicationDirection,
        '投递渠道',
        basic?.sourceChannel,
      ],
      [
        '填表日期',
        this.formatDate(student.submittedAt ?? basic?.formDate),
        '性别',
        basic?.gender,
        '出生日期',
        this.formatDate(basic?.birthDate),
      ],
      [
        '身份证号码（或外籍护照号）',
        basic?.idNumber,
        '户籍',
        basic?.householdRegistration,
        '政治面貌',
        basic?.politicalStatus,
      ],
      [
        '在读学校',
        basic?.currentSchool,
        '专业',
        basic?.major,
        '学历',
        basic?.degree,
      ],
      ['家庭地址', basic?.homeAddress, '家庭电话', basic?.homePhone, '', ''],
    ]);

    this.addTable(
      worksheet,
      '教育经历',
      ['起始年', '结束年', '学校', '专业', '班主任 / 导师', '联系电话'],
      student.educationExperiences.map((item) => [
        item.startYear,
        item.endYear,
        item.school,
        item.major,
        item.advisor,
        item.phone,
      ]),
    );

    this.addTable(
      worksheet,
      '家庭成员',
      ['关系', '姓名', '工作单位', '联系电话'],
      student.familyMembers.map((item) => [
        item.relation,
        item.name,
        item.employer,
        item.phone,
      ]),
    );

    this.addTable(
      worksheet,
      '校外实习或兼职经历',
      ['起始年', '结束年', '实习公司', '证明人', '联系电话'],
      student.internshipExperiences.map((item) => [
        item.startYear,
        item.endYear,
        item.company,
        item.referenceName,
        item.phone,
      ]),
    );

    this.addPairSection(worksheet, '补充信息', [
      [
        '紧急联系人姓名',
        student.emergencyContactName,
        '紧急联系人电话',
        student.emergencyContactPhone,
        '紧急联系人关系',
        student.emergencyContactRelation,
      ],
      [
        '身份证复印件和学生证是否齐全',
        this.formatBoolean(student.hasIdCopyAndAgreement),
        '申请人签名',
        student.applicantSignature,
        '申请人签署日期',
        this.formatDate(student.applicantSignedAt),
      ],
    ]);
    this.addFullWidthField(worksheet, '其他需要补充说明的情况', student.notes);

    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => this.applyCellStyle(cell));
    });

    return workbook;
  }

  private addPairSection(
    worksheet: Worksheet,
    title: string,
    rows: ExportValue[][],
  ): void {
    this.addSectionTitle(worksheet, title);

    for (const values of rows) {
      const row = worksheet.addRow(
        Array.from({ length: 6 }, (_, index) =>
          this.displayValue(values[index]),
        ),
      );
      row.height = 28;

      for (const column of [1, 3, 5]) {
        const cell = row.getCell(column);
        cell.font = { name: 'Microsoft YaHei', bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL },
        };
      }
    }
  }

  private addTable(
    worksheet: Worksheet,
    title: string,
    headers: string[],
    rows: ExportValue[][],
  ): void {
    this.addSectionTitle(worksheet, title);
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Microsoft YaHei', bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
    });

    if (!rows.length) {
      worksheet.mergeCells(
        headerRow.number + 1,
        1,
        headerRow.number + 1,
        headers.length,
      );
      const emptyCell = worksheet.getCell(headerRow.number + 1, 1);
      emptyCell.value = '暂无记录';
      emptyCell.font = {
        name: 'Microsoft YaHei',
        italic: true,
        color: { argb: 'FF6B7F92' },
      };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(headerRow.number + 1).height = 26;
      return;
    }

    for (const values of rows) {
      const row = worksheet.addRow(
        headers.map((_, index) => this.displayValue(values[index])),
      );
      row.height = 28;
    }
  }

  private addSectionTitle(worksheet: Worksheet, title: string): void {
    if (worksheet.rowCount > 2) worksheet.addRow([]);
    const rowNumber = worksheet.rowCount + 1;
    worksheet.mergeCells(rowNumber, 1, rowNumber, 6);
    const cell = worksheet.getCell(rowNumber, 1);
    cell.value = title;
    cell.font = {
      name: 'Microsoft YaHei',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SECTION_FILL },
    };
    cell.alignment = { vertical: 'middle' };
    worksheet.getRow(rowNumber).height = 27;
  }

  private addFullWidthField(
    worksheet: Worksheet,
    label: string,
    value: ExportValue,
  ): void {
    const rowNumber = worksheet.rowCount + 1;
    worksheet.mergeCells(rowNumber, 2, rowNumber, 6);
    const row = worksheet.getRow(rowNumber);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: 'Microsoft YaHei', bold: true };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    };
    row.getCell(2).value = this.displayValue(value);
    row.height = 42;
  }

  private applyCellStyle(cell: Cell): void {
    cell.font = {
      name: cell.font?.name ?? 'Microsoft YaHei',
      size: cell.font?.size ?? 10,
      bold: cell.font?.bold,
      italic: cell.font?.italic,
      color: cell.font?.color,
    };
    cell.alignment = {
      ...cell.alignment,
      vertical: cell.alignment?.vertical ?? 'middle',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  }

  private displayValue(value: ExportValue): string | number {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return this.formatDate(value);
    if (typeof value === 'boolean') return value ? '是' : '否';
    return value;
  }

  private formatBoolean(value: boolean | null): string {
    if (value === null) return '';
    return value ? '是' : '否';
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: CHINA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: CHINA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private safeFileName(value: string): string {
    return value.trim().replace(/[\\/:*?"<>|]/g, '_') || '学生';
  }
}
