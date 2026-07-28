# 学生出勤管理模块开发计划

## 1. 文档目的

本文档定义学生每日出勤登记、请假登记、HR 出勤管理、工作日历和办公室
网络校验功能，是后续开发和验收打卡模块的主要依据。

本模块接入当前系统已有的能力：

- 学生姓名和邮箱登录。
- 学生实习开始日期、结束日期及入职状态。
- 可按日期查询的工作地点历史。
- 普通 HR 只能管理自己录入的学生，Admin HR 可以查看全部学生。
- NestJS Cron、MongoDB、JWT Cookie 和操作日志。

本模块只提供每日一次的出勤登记，不设计下班打卡。

## 2. 功能范围

### 2.1 学生端

- 实习期间进入出勤登记页面。
- 查看当天是否需要打卡、当天安排地点及允许选择的签到方式。
- 点击“出勤登记”后选择线上签到或线下签到。
- 每个工作日完成一次出勤登记。
- 一次选择多个日期登记请假。
- 按月份查看自己的出勤记录、请假记录和出勤汇总。

### 2.2 HR 端

- 查看每日学生出勤情况。
- 查看每名学生的出勤汇总。
- 在学生详情页查看该学生的每日打卡记录和累计天数。
- 按学生、月份、安排地点及实际签到方式筛选。
- Admin HR 可以按负责 HR 筛选。

### 2.3 Admin HR

- 添加、修改和取消不需要打卡的法定或临时假期。
- 维护各办公室允许线下打卡的公网 IP 或 CIDR。

### 2.4 暂不实现

- 上下班两次打卡。
- 请假审批流。
- GPS 定位。
- 人脸识别。
- 自动同步国家法定节假日。
- 出勤数据导出。
- WebAuthn 或移动 App 设备认证。

## 3. 名词和状态

### 3.1 出勤状态

```text
on_time  按时打卡
late     迟到
leave    请假
absent   缺勤
```

`pending` 只用于截止时间之前的页面展示，表示当天尚未登记，不写入数据库。

### 3.2 签到方式

```text
online   学生本次选择线上签到
offline  学生本次选择线下签到
```

签到方式表示学生本次实际选择的模式，不等同于 HR 安排的工作地点。
系统需要同时保存“当天安排地点”和“实际签到方式”。

### 3.3 记录来源

```text
check_in            学生主动登记出勤
leave_registration  学生登记请假
absence_scheduler   定时任务生成缺勤
```

## 4. 核心业务规则

### 4.1 日期和时区

- 所有业务日期使用 `Asia/Shanghai` 中国时区判断。
- 前端只负责展示，不能使用浏览器本地时区决定出勤日期或状态。
- `attendanceDate` 使用 `YYYY-MM-DD` 保存北京时间业务日期。
- `checkInAt` 使用 MongoDB `Date` 保存 UTC 时间。
- 只统计周一至周五，并排除 Admin HR 添加的假期。

### 4.2 学生是否可以打卡

打卡接口先幂等刷新学生入职状态，再校验以下条件：

```text
学生未被软删除
onboardingStatus = onboarded
当前日期不早于 onboardingStartAt
当前日期不晚于 onboardingEndAt
当前日期是需要出勤的工作日
```

实习结束日期当天仍可打卡。实习结束日期第二天，学生状态变为
`departed`，不再允许打卡。

如果历史数据缺少 `onboardingEndAt`，学生在 `onboarded` 状态下仍可打卡，
但 HR 后台显示“未设置实习结束日期”的数据提示。

### 4.3 学生入口

学生登录成功后，后端返回入口状态：

| 入口状态 | 条件 | 页面 |
| --- | --- | --- |
| `registration` | 实习尚未开始且登记表未提交 | 入职登记表 |
| `waiting` | 实习尚未开始且登记表已提交 | 已提交/等待入职 |
| `attendance` | 当前日期在实习日期范围内 | 出勤管理 |
| `ended` | 当前日期晚于实习结束日期 | 实习已结束 |

从实习开始日期起，不再向学生展示或开放之前的登记表。
后端登记表 API 也必须拒绝学生继续修改，不能只依赖前端隐藏。

### 4.4 打卡时间

后端收到打卡请求时生成 `checkInAt`，前端不能传入或修改打卡时间。

建议使用以下确定边界：

| 北京时间 | 状态 |
| --- | --- |
| `10:01:00` 之前 | `on_time` |
| `10:01:00` 至 `10:15:59` | `late` |
| `10:16:00` 起 | `absent` |

学生在 `10:16:00` 后仍可以点击登记，但结果保持为缺勤，并记录实际登记时间。

### 4.5 每日唯一限制

- 每名学生每天最多一条有效出勤记录。
- 同一设备在同一个北京时间自然日内，只能为一名学生完成一次出勤打卡。
- 请假和系统生成的缺勤不占用设备名额。
- 重复点击返回当天已有记录，不重复创建数据。
- 数据库唯一索引负责最终并发保护，不能只依赖 Service 查询。

设备标识由后端生成随机值，通过签名的 `HttpOnly` Cookie 保存。数据库只保存
设备标识的哈希，不保存原始标识。

网页 Cookie 只能提供第一版的设备限制。用户清除 Cookie、使用无痕窗口或更换
浏览器可能被识别为新设备。若后续需要更强的防代打能力，应增加 WebAuthn
设备注册或移动 App 设备认证。

### 4.6 当天安排地点与签到方式

打卡接口不能直接使用学生文档上的当前地点，而应从
`work_location_assignments` 中查询 `attendanceDate` 当天生效的工作地点。

```text
当天安排地点 = 线上
  -> allowedCheckInModes = [online]
  -> 学生只能选择线上签到
  -> 不校验办公室 IP

当天安排地点 = 办公室或研究院
  -> allowedCheckInModes = [online, offline]
  -> 学生自行选择线上签到或线下签到
  -> 选择 online 时不校验办公室 IP
  -> 选择 offline 时校验该安排地点允许的公网出口 IP/CIDR
```

后端必须校验学生提交的签到方式，不能仅依赖前端隐藏选项。安排地点为“线上”
的学生如果伪造 `offline` 请求，接口应拒绝。

打卡记录保存以下快照：

```text
assignedWorkLocation  当天 HR 安排地点
checkInMode           学生实际选择的 online/offline
checkInLocation       online 时为“线上”；offline 时为当天安排地点
```

这样办公室学生选择线上签到时，HR 仍能看到其原安排地点。以后 HR 修改地点历史
时，不能直接改变已经完成的历史出勤记录；确需修正时应由 Admin HR 执行专门
的数据修正。

### 4.7 办公室 IP

- 公司 IT 提供的是办公室 Wi-Fi 的公网出口 IP，不是 `192.168.x.x` 内网地址。
- 一个办公室可以配置多个 IPv4、IPv6 或 CIDR。
- 禁用的网络配置不能用于匹配。
- 后端必须配置可信反向代理，不能无条件相信客户端传入的
  `X-Forwarded-For`。
- 普通 HR 和学生不能查看原始网络配置。
- HR 出勤页面只显示“办公室网络匹配成功”，不显示学生的原始 IP。

学生实际选择线下签到且 IP 不匹配时返回：

```text
请连上办公室 Wi-Fi 后再登记出勤
```

### 4.8 请假

- 可选择今天至未来 14 天以内的日期。
- 可以一次选择多个日期。
- 只能选择实习日期范围内需要出勤的工作日。
- 周末、系统假期、已打卡、已请假或已缺勤日期不可重复选择。
- 提交后对应日期立即记为 `leave`，第一版没有审批状态。
- 未来请假可在日期到来前由学生撤销。
- 日期当天如需修正，由学生联系 HR 处理，第一版不允许学生自行覆盖。

页面固定提示：

> 请假先与带教分析师对接，后告知 HR 并在登记表记为请假状态。

一次多日期提交使用同一个 `leaveBatchId`，方便查看和撤销同一批登记。

### 4.9 自动缺勤

NestJS Cron 在每个工作日 `10:16` 后执行：

1. 查询当天处于实习日期范围内的在职学生。
2. 排除当天不需要出勤的假期。
3. 排除已有按时、迟到或请假记录的学生。
4. 为剩余学生创建 `absent` 记录。

任务必须幂等，可以安全重复执行。HR 查询每日记录时再执行一次轻量补算，
避免服务重启或 Cron 暂停造成漏记。

## 5. HR 出勤统计

### 5.1 每日统计

每日页面显示：

```text
今日应出勤学生
按时打卡
迟到
请假
缺勤
待登记
```

`待登记` 只在截止时间之前出现。截止时间后，无记录学生会被补算为缺勤。

### 5.2 学生出勤汇总

每名学生只显示：

| 字段 | 说明 |
| --- | --- |
| 总出勤天数 | 按时天数 + 迟到天数 |
| 迟到 | 天数和具体日期 |
| 请假 | 天数和具体日期 |
| 缺勤 | 天数和具体日期 |
| 线上出勤天数 | 有效出勤且学生实际选择 `online` |
| 线下出勤天数 | 有效出勤且学生实际选择 `offline` |
| 最近一次打卡 | 北京时间、安排地点、实际签到地点及签到方式 |

日期较多时默认显示前几项，通过“查看全部”展开。

### 5.3 HR 数据权限

- 普通 HR 只能查询 `ownerHrId` 为自己的学生及其出勤记录。
- Admin HR 可以查看全部学生。
- Admin HR 可以使用 `ownerHrId` 筛选负责 HR。
- Controller 不能直接接受普通 HR 传入的 `ownerHrId` 扩大数据范围。
- 学生详情接口同样执行所有权校验。

### 5.4 筛选条件

- 学生姓名或邮箱。
- 月份。
- 安排工作地点。
- 学生实际签到方式 `online` 或 `offline`。
- 出勤状态。
- 负责 HR，仅 Admin HR 显示。

## 6. MongoDB 数据库设计

### 6.1 attendance_records

每个文档表示一名学生某个工作日的最终状态。

```js
{
  _id: ObjectId,

  studentId: ObjectId,
  ownerHrId: ObjectId,
  attendanceDate: "2026-07-28",

  status: "on_time" | "late" | "leave" | "absent",
  source: "check_in" | "leave_registration" | "absence_scheduler",

  checkInAt: Date | null,
  checkInAttemptAt: Date | null,

  assignedWorkLocation: String,
  assignedWorkLocationAssignmentId: ObjectId | null,
  checkInMode: "online" | "offline" | null,
  checkInLocation: String | null,

  deviceIdHash: String | null,
  matchedOfficeNetworkId: ObjectId | null,
  ipMatchSucceeded: Boolean | null,

  leaveBatchId: String | null,
  leaveRegisteredAt: Date | null,

  createdAt: Date,
  updatedAt: Date
}
```

说明：

- `ownerHrId` 是查询权限快照，便于普通 HR 直接筛选。
- `checkInAt` 仅在学生完成出勤登记时存在。
- `assignedWorkLocation` 是当天 HR 排班地点快照。
- `checkInMode` 是学生实际选择的签到方式；请假和系统缺勤可为 `null`。
- `checkInLocation` 在线上签到时为“线上”，在线下签到时为安排的办公室或
  研究院。
- Cron 生成缺勤后，学生在截止时间后点击打卡时，记录
  `checkInAttemptAt`，状态仍为 `absent`。
- 原始 IP 不进入常规 HR 返回结果。第一版可以不长期保存原始 IP，只保存
  是否匹配及匹配的网络配置 ID。

索引：

```js
{ studentId: 1, attendanceDate: 1 } unique
{ ownerHrId: 1, attendanceDate: 1, status: 1 }
{ attendanceDate: 1, assignedWorkLocation: 1, checkInMode: 1, status: 1 }
{ studentId: 1, attendanceDate: -1 }
{ deviceIdHash: 1, attendanceDate: 1 } unique partial
```

设备唯一索引仅匹配：

```js
{
  deviceIdHash: { $type: "string" },
  source: "check_in"
}
```

### 6.2 attendance_calendar

保存不需要打卡的法定或临时假期。

```js
{
  _id: ObjectId,
  date: "2026-10-01",
  name: "国庆节",
  type: "public_holiday" | "temporary_holiday",
  reason: String | null,
  createdByHrId: ObjectId,
  updatedByHrId: ObjectId,
  isDeleted: Boolean,
  deletedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

索引：

```js
{ date: 1 } unique partial where isDeleted = false
{ isDeleted: 1, date: 1 }
```

管理员可以在页面选择日期范围，后端把日期范围展开成单日文档。周末可接受
重复配置但返回提示“该日期本身不是工作日”。

### 6.3 office_networks

```js
{
  _id: ObjectId,
  workLocation: "北京办公室",
  cidrs: [
    "203.0.113.10/32",
    "2001:db8:1234::/48"
  ],
  enabled: Boolean,
  description: String | null,
  updatedByHrId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

索引：

```js
{ workLocation: 1 } unique
{ enabled: 1 }
```

“线上”不创建网络配置。

### 6.4 operation_logs

沿用现有操作日志集合，新增动作：

```text
attendance.calendar.created
attendance.calendar.updated
attendance.calendar.deleted
attendance.office_network.updated
attendance.record.corrected
```

学生正常打卡不写入 HR 操作日志，避免高频日志污染；其行为已经保存在
`attendance_records`。

## 7. 后端模块结构

建议新增独立模块：

```text
backend/src/modules/attendance/
├── attendance.module.ts
├── controllers/
│   ├── student-attendance.controller.ts
│   ├── hr-attendance.controller.ts
│   └── admin-attendance-settings.controller.ts
├── services/
│   ├── attendance.service.ts
│   ├── attendance-eligibility.service.ts
│   ├── attendance-calendar.service.ts
│   ├── attendance-summary.service.ts
│   ├── attendance-device.service.ts
│   ├── office-network.service.ts
│   └── attendance-reconciliation.service.ts
├── schedulers/
│   └── attendance-absence.scheduler.ts
├── schemas/
│   ├── attendance-record.schema.ts
│   ├── attendance-calendar.schema.ts
│   └── office-network.schema.ts
├── dto/
│   ├── create-leave-registration.dto.ts
│   ├── create-attendance-check-in.dto.ts
│   ├── list-student-attendance-query.dto.ts
│   ├── list-daily-attendance-query.dto.ts
│   ├── list-attendance-summary-query.dto.ts
│   ├── create-calendar-exception.dto.ts
│   └── update-office-network.dto.ts
├── enums/
│   ├── attendance-status.enum.ts
│   ├── attendance-source.enum.ts
│   └── check-in-mode.enum.ts
└── attendance.constants.ts
```

### 7.1 Service 职责

`AttendanceEligibilityService`

- 以北京时间确定业务日期。
- 幂等刷新学生入职状态。
- 判断学生是否在职。
- 判断当天是否是工作日。
- 查询当天有效工作地点。

`AttendanceService`

- 处理学生打卡。
- 校验学生选择的签到方式是否符合当天安排地点。
- 计算按时、迟到或缺勤。
- 保证学生每日唯一。
- 写入安排地点、实际签到方式和实际签到地点快照。

`AttendanceDeviceService`

- 生成并签名设备 Cookie。
- 计算设备标识哈希。
- 检查设备当天是否已被其他学生使用。

`OfficeNetworkService`

- 从可信请求信息读取客户端 IP。
- 解析 IPv4、IPv6 和 CIDR。
- 仅在线下签到时，根据当天安排地点匹配允许网络。

`AttendanceCalendarService`

- 判断周末和系统假期。
- 管理法定与临时假期。
- 校验请假日期范围。

`AttendanceReconciliationService`

- 为超过截止时间但没有记录的学生生成缺勤。
- 保证 Cron 和查询补算幂等。

`AttendanceSummaryService`

- 生成每日统计。
- 生成学生月份汇总及日期列表。
- 执行普通 HR/Admin HR 数据范围过滤。

### 7.2 模块依赖

```text
AttendanceModule
  -> StudentModule
  -> WorkLocationHistoryModule
  -> AuthModule
  -> OperationLogModule
```

使用现有 `StudentAuthGuard`、`HrAuthGuard` 和 `HrAccessContext`，不重新实现
第二套登录或权限系统。

### 7.3 环境配置

建议增加：

```env
ATTENDANCE_TIMEZONE=Asia/Shanghai
ATTENDANCE_ON_TIME_BEFORE=10:01
ATTENDANCE_ABSENT_FROM=10:16
ATTENDANCE_DEVICE_COOKIE_NAME=attendance_device
ATTENDANCE_DEVICE_SECRET=replace-with-random-secret
TRUST_PROXY_HOPS=1
```

截止时间在第一版可由环境变量配置，不需要提供 HR 修改页面。

## 8. API 设计

所有时间由后端生成或校验。API 错误继续使用项目现有统一错误响应格式。

### 8.1 学生入口状态

```text
GET /api/student/portal
```

响应：

```json
{
  "portalState": "attendance",
  "student": {
    "id": "studentId",
    "name": "张三",
    "onboardingStatus": "onboarded"
  }
}
```

### 8.2 获取当天状态

```text
GET /api/student/attendance/today
```

响应：

```json
{
  "attendanceDate": "2026-07-28",
  "isWorkday": true,
  "assignedWorkLocation": "上海办公室",
  "allowedCheckInModes": ["online", "offline"],
  "officeNetworkRequiredFor": ["offline"],
  "status": "pending",
  "checkInAt": null
}
```

### 8.3 出勤登记

```text
POST /api/student/attendance/check-in
```

请求：

```json
{
  "checkInMode": "offline"
}
```

学生只能提交本次选择的 `checkInMode`。学生、时间、日期、安排地点、实际签到
地点、设备和 IP 均由后端确定；后端还要根据当天安排地点校验该模式是否允许。

成功响应：

```json
{
  "attendanceDate": "2026-07-28",
  "status": "on_time",
  "checkInAt": "2026-07-28T01:42:12.000Z",
  "assignedWorkLocation": "上海办公室",
  "checkInMode": "offline",
  "checkInLocation": "上海办公室"
}
```

主要错误：

| HTTP | code | 场景 |
| --- | --- | --- |
| `400` | `ATTENDANCE_NOT_REQUIRED` | 周末或假期 |
| `400` | `CHECK_IN_MODE_NOT_ALLOWED` | 该安排地点不允许所选签到方式 |
| `403` | `STUDENT_NOT_ONBOARDED` | 学生当前不在职 |
| `403` | `OFFICE_NETWORK_REQUIRED` | 线下打卡 IP 不匹配 |
| `409` | `STUDENT_ALREADY_CHECKED_IN` | 学生当天已有记录 |
| `409` | `DEVICE_ALREADY_USED` | 设备当天已给其他学生打卡 |
| `409` | `LEAVE_ALREADY_REGISTERED` | 当天已有请假记录 |

### 8.4 学生记录

```text
GET /api/student/attendance/records?month=2026-07
```

只返回当前登录学生自己的记录，不能通过查询参数指定其他 `studentId`。

响应包含当月汇总和每日明细：

```json
{
  "month": "2026-07",
  "summary": {
    "totalAttendanceDays": 18,
    "late": {
      "count": 2,
      "dates": ["2026-07-03", "2026-07-15"]
    },
    "leave": {
      "count": 1,
      "dates": ["2026-07-18"]
    },
    "absent": {
      "count": 1,
      "dates": ["2026-07-22"]
    },
    "onlineAttendanceDays": 8,
    "offlineAttendanceDays": 10
  },
  "items": [
    {
      "attendanceDate": "2026-07-28",
      "status": "on_time",
      "checkInAt": "2026-07-28T01:42:12.000Z",
      "assignedWorkLocation": "上海办公室",
      "checkInMode": "offline",
      "checkInLocation": "上海办公室"
    }
  ]
}
```

### 8.5 请假可选日期

```text
GET /api/student/attendance/leave-options
```

返回今天至未来 14 天内可选择、禁用及禁用原因。

### 8.6 登记请假

```text
POST /api/student/attendance/leaves
```

请求：

```json
{
  "dates": ["2026-07-30", "2026-07-31"]
}
```

响应：

```json
{
  "leaveBatchId": "random-batch-id",
  "dates": ["2026-07-30", "2026-07-31"]
}
```

### 8.7 撤销未来请假

```text
DELETE /api/student/attendance/leaves/:attendanceDate
```

只能撤销晚于当前北京时间日期的请假。

### 8.8 HR 每日出勤

```text
GET /api/hr/attendance/daily
```

查询参数：

```text
date=2026-07-28
keyword=张三
status=late
workLocation=上海办公室
checkInMode=offline
ownerHrId=...          仅 Admin
page=1
limit=20
```

`workLocation` 按当天安排地点筛选，`checkInMode` 按学生实际签到方式筛选。
响应包含统计卡片和分页列表。

### 8.9 HR 出勤汇总

```text
GET /api/hr/attendance/summary
```

查询参数：

```text
month=2026-07
keyword=张三
workLocation=上海办公室
checkInMode=offline
ownerHrId=...          仅 Admin
page=1
limit=20
```

`workLocation` 与 `checkInMode` 的筛选口径和每日出勤接口相同。

每名学生返回：

```json
{
  "studentId": "studentId",
  "name": "张三",
  "totalAttendanceDays": 18,
  "late": {
    "count": 2,
    "dates": ["2026-07-03", "2026-07-15"]
  },
  "leave": {
    "count": 1,
    "dates": ["2026-07-18"]
  },
  "absent": {
    "count": 1,
    "dates": ["2026-07-22"]
  },
  "onlineAttendanceDays": 8,
  "offlineAttendanceDays": 10,
  "lastCheckIn": {
    "checkInAt": "2026-07-28T01:42:12.000Z",
    "assignedWorkLocation": "上海办公室",
    "checkInMode": "offline",
    "checkInLocation": "上海办公室"
  }
}
```

### 8.10 学生详情中的出勤记录

```text
GET /api/hr/students/:studentId/attendance?month=2026-07
```

普通 HR 只能访问自己录入的学生，Admin HR 可访问全部学生。

### 8.11 工作日历

```text
GET    /api/hr/attendance/calendar
POST   /api/hr/attendance/calendar
PATCH  /api/hr/attendance/calendar/:id
DELETE /api/hr/attendance/calendar/:id
```

写操作仅允许 Admin HR。

### 8.12 办公网配置

```text
GET /api/hr/attendance/office-networks
PUT /api/hr/attendance/office-networks/:workLocation
```

仅允许 Admin HR。

## 9. 学生前端设计

### 9.1 路由

```text
/student/login
/student/form
/student/submitted
/student/attendance
/student/ended
```

登录后调用 `/api/student/portal` 决定跳转目标。

### 9.2 出勤页面

页面采用两个标签页：

```text
出勤登记
请假登记
```

“出勤登记”显示：

- 北京时间日期和当前时间。
- 当天工作地点及具体地址。
- 当天允许选择的签到方式。
- 当前状态。
- 出勤登记按钮。
- “我的出勤记录”入口。

点击“出勤登记”后打开签到方式选择弹窗，使用分段控件展示允许方式：

```text
当天安排地点为“线上”
  -> 只显示“线上签到”，默认选中且不可切换为线下

当天安排地点为办公室或研究院
  -> 显示“线上签到”和“线下签到”
  -> 由学生选择后确认
```

学生选择“线下签到”时，弹窗固定提示：

> 请先连接当前办公室 Wi-Fi，再登记出勤。

学生选择“线上签到”时不进行 IP 校验。前端提供的可选项仅用于改善体验，
后端仍必须重新校验选择是否合法。

点击按钮后的状态：

```text
正在登记
打卡成功
今日已登记
请连上办公室 Wi-Fi 后再登记出勤
该设备今日已完成出勤登记
今日无需登记出勤
```

成功后按钮禁用，展示实际北京时间、地点和按时/迟到/缺勤状态。

### 9.3 我的出勤记录

学生端提供正式的个人出勤记录页面或标签页，而不只显示最近几条：

- 只能读取当前登录学生自己的数据。
- 支持按月份查询。
- 显示总出勤、迟到、请假、缺勤、线上出勤和线下出勤天数。
- 迟到、请假和缺勤显示具体日期。
- 每日明细显示日期、状态、打卡时间、安排地点、签到方式和实际签到地点。
- 最近一次打卡显示北京时间、签到方式和地点。
- 没有记录的月份显示明确空状态。

### 9.4 请假页面

- 使用 Ant Design 多日期日历。
- 默认显示今天所在月份。
- 只允许选择后端返回的可用日期。
- 支持一次选择多个日期并显示已选列表。
- 提交前二次确认。
- 展示未来已登记请假及可撤销状态。
- 固定显示请假提示文案。

日期是否可选最终由后端判断，前端禁用状态只用于改善体验。

### 9.5 非打卡状态

- 周末或假期：显示“今日无需登记出勤”。
- 实习未开始：返回等待入职页面。
- 实习已结束：显示“实习已结束，当前无需登记出勤”。
- 缺少地点安排：显示“当前工作地点未配置，请联系 HR”。

## 10. HR 前端设计

### 10.1 导航

HR 后台新增一级导航：

```text
学生管理
出勤管理
```

“出勤管理”包含：

```text
每日出勤
出勤汇总
工作日历        仅 Admin
办公网络        仅 Admin
```

### 10.2 每日出勤

顶部统计卡片：

```text
应出勤学生
按时打卡
迟到
请假
缺勤
待登记
```

筛选栏：

```text
日期
学生
工作地点
实际签到方式
出勤状态
负责 HR        仅 Admin
```

列表字段：

```text
学生
负责 HR        仅 Admin
当天状态
打卡时间
安排工作地点
签到方式
实际签到地点
网络校验结果
查看详情
```

### 10.3 出勤汇总

筛选栏：

```text
月份
学生
工作地点
实际签到方式
负责 HR        仅 Admin
```

列表字段：

```text
学生
总出勤天数
迟到天数和日期
请假天数和日期
缺勤天数和日期
线上出勤天数
线下出勤天数
最近打卡时间和地点
```

日期列表默认折叠，避免表格过宽。

### 10.4 学生详情

现有 `/hr/students/:id` 页面新增“出勤记录”区域：

- 累计数据摘要。
- 月份选择。
- 每日出勤记录。
- 打卡时间、状态、安排地点、签到方式和实际签到地点。
- 迟到、请假和缺勤日期。

该区域沿用学生详情页现有权限，不新增绕过所有权校验的接口。

### 10.5 工作日历

Admin HR 可以：

- 选择单日或日期范围。
- 填写假期名称、类型和原因。
- 修改未来假期。
- 取消误添加的假期。
- 查看创建和最后修改人。

修改已经产生出勤记录的历史日期时，必须二次确认，并触发指定日期的出勤
重新核算或交由 Admin 手动处理。

### 10.6 办公网配置

每个办公室显示：

- 工作地点。
- 地址。
- 允许的 IP/CIDR 列表。
- 启用状态。
- 最后修改时间和修改人。

保存前后端均校验 IP/CIDR 格式。修改配置只影响后续打卡，不改变历史记录。

## 11. 定时任务

```text
Cron: 每个工作日北京时间 10:16 后
Time zone: Asia/Shanghai
```

实现要求：

- 使用 `@nestjs/schedule`。
- 使用批量写入和唯一索引处理并发。
- 重复运行不产生重复记录。
- 记录开始时间、结束时间、扫描人数、新增缺勤数和失败数。
- 单个学生失败不能终止整批任务。
- 查询每日出勤时执行幂等补算作为兜底。

## 12. 安全与隐私

- 服务端生成打卡时间。
- 学生只能提交 `checkInMode`，不能提交 `studentId`、时间、安排地点、实际签到
  地点、IP 或设备哈希。
- 后端根据当天安排地点校验 `checkInMode`，不能相信前端提供的可选范围。
- 普通 HR 不能访问其他 HR 学生的出勤数据。
- 只有 Admin HR 能维护假期和办公网络。
- 不向 HR 页面返回完整设备标识。
- 默认不向 HR 返回原始客户端 IP。
- 设备 Cookie 使用 `HttpOnly`、`Secure` 和合适的 `SameSite`。
- 生产环境必须配置 HTTPS 和可信反向代理。
- 打卡接口增加频率限制。

## 13. 测试计划

### 13.1 单元测试

- 北京时间跨日和月份边界。
- 周末和管理员假期。
- 开始日期、结束日期和结束次日。
- `10:00:59`、`10:01:00`、`10:15:59`、`10:16:00`。
- 当天工作地点历史查询。
- 安排地点为“线上”时只允许线上签到，伪造线下签到被拒绝。
- 安排地点为办公室或研究院时允许选择线上签到，且不校验 IP。
- 安排地点为办公室或研究院时选择线下签到，校验 IPv4、IPv6、CIDR。
- 汇总中的线上和线下天数按学生实际选择的 `checkInMode` 统计。
- 请假 14 天边界和多日期校验。
- 学生每日唯一和设备每日唯一。
- Cron 幂等和查询补算。
- 普通 HR/Admin HR 权限范围。

### 13.2 集成测试

- 同一学生并发点击两次，只生成一条记录。
- 同一设备切换学生，当天第二名学生被拒绝。
- Cron 与学生同时打卡时不会生成两条记录。
- 办公室学生线上签到时同时保存原安排地点和实际线上签到。
- 线上学生提交线下签到时返回 `CHECK_IN_MODE_NOT_ALLOWED`。
- 未来请假提交及撤销。
- 工作地点在同一天发生变化时使用正确的有效段。
- Admin 添加临时假期后，当天不再生成缺勤。

### 13.3 前端验收

- 学生登录后进入正确页面。
- 线上地点只展示线上签到；办公室地点展示线上和线下两种选择。
- 线下失败提示与线上成功流程。
- 打卡按钮重复点击保护。
- 学生可以按月份查看自己的出勤汇总和每日记录。
- 多日期请假选择和禁用日期。
- HR 每日统计总数一致。
- 普通 HR 看不到其他 HR 学生。
- Admin 筛选负责 HR。
- 桌面和手机页面无文字遮挡或横向溢出。

## 14. 开发顺序

### Phase 1：基础数据和公共服务

- 新增 Schema、枚举、索引和 Module。
- 实现北京时间、工作日和在职资格判断。
- 实现当天工作地点查询。

验收：Service 单元测试通过，可以正确判断某学生某天是否需要出勤。

### Phase 2：学生打卡后端

- 实现设备 Cookie。
- 实现签到方式 DTO、允许方式判断和后端校验。
- 实现办公室学生线上/线下选择及线下 IP 校验。
- 实现每日唯一打卡。
- 实现按时、迟到和截止后缺勤。

验收：使用 `curl` 或测试用例完成允许方式、伪造方式、线上、线下、重复和设备
冲突验证。

### Phase 3：请假和工作日历

- 实现多日期请假。
- 实现未来请假撤销。
- 实现 Admin 假期 CRUD。

验收：周末、假期和不可选日期均不能产生错误记录。

### Phase 4：自动缺勤

- 实现 Cron。
- 实现查询时幂等补算。
- 增加任务日志。

验收：重复运行任务不会重复写入，截止后无记录学生变为缺勤。

### Phase 5：学生前端

- 修改登录后入口路由。
- 开发出勤登记和请假登记页面。
- 开发签到方式选择、状态反馈和“我的出勤记录”。

验收：学生在开始前、实习中、结束后分别进入正确页面。

### Phase 6：HR 后端

- 实现每日统计、汇总和学生详情 API。
- 接入普通 HR/Admin HR 权限。
- 实现筛选和分页。

验收：统计数量正确，普通 HR 无法访问他人学生记录。

### Phase 7：HR 前端

- 新增出勤管理导航。
- 开发每日出勤、出勤汇总和学生详情区域。
- 开发 Admin 工作日历和办公网络页面。

验收：筛选、统计、权限和响应式布局通过。

### Phase 8：完整测试和上线准备

- 补齐单元、集成和端到端测试。
- 配置正式办公室公网 IP。
- 配置可信代理、HTTPS 和设备密钥。
- 编写管理员和 HR 使用说明。

## 15. 完成标准

满足以下条件后，打卡模块才算完成：

1. 学生只能在有效实习工作日打卡。
2. 学生只能选择后端允许的签到方式，其他时间、地点、设备和 IP 数据由后端
   决定。
3. 学生每日唯一和设备每日唯一在并发情况下仍有效。
4. “线上”地点只能线上签到；办公室或研究院地点允许学生选择线上或线下签到。
5. 学生选择线下签到时必须匹配对应办公室公网 IP。
6. 学生可以按月份查看自己的出勤汇总和每日记录。
7. 学生可以登记未来 14 天内的多个有效请假日期。
8. 截止后系统能幂等生成缺勤。
9. 普通 HR 只能查看自己的学生，Admin HR 可以查看全部并筛选负责 HR。
10. 每日统计、学生汇总和学生详情数据一致。
11. 管理员可以维护假期和办公网络。
12. 核心时间边界、权限、IP、设备和并发测试通过。
