# 学生出勤管理模块开发计划

## 1. 文档目的

本文档定义学生每日出勤登记、请假登记、HR 出勤管理、工作日历、办公室
网络校验和 HR 共享文档页面，是后续开发和验收打卡模块的主要依据。

本模块接入当前系统已有的能力：

- 学生姓名和邮箱登录。
- 学生实习开始日期、结束日期及入职状态。
- 可按日期查询的工作地点历史。
- 普通 HR 只能管理自己录入的学生，Admin HR 可以查看全部学生。
- 普通 HR 可以被分配一个或多个负责地区，用于管理地区临时假期和地区配置。
- 可选的 NestJS Cron、MongoDB、JWT Cookie 和操作日志。

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
- 普通 HR 可以维护自己负责地区的临时假期，但不能维护全国法定假期。
- 通过“共享文档”页面查看公司指定的在线腾讯文档。

### 2.3 Admin HR

- 为普通 HR 分配一个或多个负责地区。
- 添加、修改和取消全国法定假期或任意地区的临时假期。
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

`pending` 只用于打卡窗口关闭前的页面展示，表示当天尚未登记，不写入数据库。

迟到程度单独保存，避免把“严重迟到”误计入普通迟到天数：

```text
normal  10:01:00 至 10:30:00 完成打卡，状态为 late
severe  10:30:00 后至 11:00:00 完成打卡，状态为 absent
```

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

### 3.4 地区代码

地区权限使用稳定代码，不直接使用可能发生变化的工作地点显示名称：

```text
beijing    北京
hong_kong  香港
shenzhen   深圳
shanghai   上海
nanjing    南京
online     线上
```

后端集中维护“工作地点 -> 地区代码”的映射。一个地区可以包含多个办公室，
例如上海地区可以同时包含“上海办公室 - 会德丰”和“上海办公室 - 绿地汇”。
以后调整地点名称或详细地址时，不需要同步修改 HR 地区权限数据。

当前映射：

| 工作地点            | 地区代码    |
| ------------------- | ----------- |
| 北京办公室          | `beijing`   |
| 香港办公室          | `hong_kong` |
| 深圳办公室 - 1302   | `shenzhen`  |
| 深圳办公室 - 41层   | `shenzhen`  |
| 上海办公室 - 会德丰 | `shanghai`  |
| 上海办公室 - 绿地汇 | `shanghai`  |
| 南京办公室          | `nanjing`   |
| 线上                | `online`    |

## 4. 核心业务规则

### 4.1 日期和时区

- 所有业务日期使用 `Asia/Shanghai` 中国时区判断。
- 前端只负责展示，不能使用浏览器本地时区决定出勤日期或状态。
- `attendanceDate` 使用 `YYYY-MM-DD` 保存北京时间业务日期。
- `checkInAt` 使用 MongoDB `Date` 保存 UTC 时间。
- 只统计周一至周五，并排除全国法定假期和学生当天有效工作地点所属地区的
  临时假期。

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

| 入口状态       | 条件                       | 页面            |
| -------------- | -------------------------- | --------------- |
| `registration` | 实习尚未开始且登记表未提交 | 入职登记表      |
| `waiting`      | 实习尚未开始且登记表已提交 | 已提交/等待入职 |
| `attendance`   | 当前日期在实习日期范围内   | 出勤管理        |
| `ended`        | 当前日期晚于实习结束日期   | 实习已结束      |

从实习开始日期起，不再向学生展示或开放之前的登记表。
后端登记表 API 也必须拒绝学生继续修改，不能只依赖前端隐藏。

### 4.4 打卡时间

后端收到打卡请求时生成 `checkInAt`，前端不能传入或修改打卡时间。

使用以下确定边界：

| 北京时间                   | 是否允许打卡 | 最终状态  | 页面提示                           |
| -------------------------- | ------------ | --------- | ---------------------------------- |
| `10:01:00` 之前            | 允许         | `on_time` | 打卡成功                           |
| `10:01:00` 至 `10:30:00`   | 允许         | `late`    | 打卡成功，今日记为迟到             |
| `10:30:00` 后至 `11:00:00` | 允许         | `absent`  | 严重迟到，今日记缺勤               |
| `11:00:00` 后              | 不允许       | `absent`  | 已过打卡时间，无法打卡，今日记缺勤 |

边界按秒判断：

```text
10:00:59 -> on_time
10:01:00 -> late，lateLevel = normal
10:30:00 -> late，lateLevel = normal
10:30:01 -> absent，lateLevel = severe，但保存本次打卡
11:00:00 -> absent，lateLevel = severe，但保存本次打卡
11:00:01 -> 拒绝打卡并确保当日缺勤记录存在
```

`10:30:00` 后至 `11:00:00` 的登记仍保存 `checkInAt`、签到方式、安排地点和
实际签到地点，用于 HR 查看严重迟到发生的时间，但不计入总出勤天数或迟到
天数。`11:00:00` 后不再写入有效 `checkInAt`，接口返回打卡窗口已关闭。

### 4.5 每日唯一限制

- 每名学生在同一个北京时间业务日期内最多一条最终出勤记录。
- 同一浏览器设备标识在同一个北京时间业务日期内最多完成一次成功打卡。
- 设备不与学生永久绑定，同一设备可以在不同日期由不同学生使用。
- 请假和系统生成的缺勤不占用设备名额。
- 失败的打卡请求不占用设备名额。
- 重复点击返回当天已有记录，不重复创建数据。
- 数据库唯一索引负责最终并发保护，不能只依赖 Service 查询。

学生第一次进入考勤页面时，前端使用 `crypto.randomUUID()` 生成 `deviceId`，
保存到浏览器 `localStorage` 的 `attendance_device_id`。后续每次主动打卡时，
前端将该 UUID 和签到方式一起提交给后端。

后端校验 `deviceId` 为合法 UUID，使用 SHA-256 计算 `deviceIdHash`，数据库只
保存哈希，不保存前端原始 UUID。`deviceId` 只用于每日设备次数限制，不作为
学生身份认证；学生身份始终来自现有 JWT 登录态。

第一版识别的是浏览器存储环境，不是严格意义上的物理手机或电脑。用户清除
`localStorage`、使用无痕窗口或更换浏览器会生成新的设备标识。这是当前 MVP
明确接受的限制；若后续需要更强的防代打能力，再考虑 WebAuthn、移动 App
设备认证或其他可信设备机制。

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
时，不能直接改变已经完成的历史出勤记录；确需修正时，应由有权限的 HR 通过
专门的“考勤更正”接口操作并填写原因，不能直接修改 MongoDB 文档。

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

### 4.9 自动缺勤与查询补算

系统以服务端查询时的幂等补算保证数据正确，不依赖前端页面自己计算缺勤。
HR 查询每日出勤、月度汇总或学生考勤详情前，后端对相关日期执行：

1. 查询当天处于实习日期范围内的在职学生。
2. 排除当天不需要出勤的假期。
3. 排除已有按时、迟到、严重迟到缺勤或请假记录的学生。
4. 为剩余学生创建 `absent` 记录。

补算必须幂等，可以在 HR 刷新页面时安全重复执行。学生在 `11:00:00` 后尝试
打卡时，也先幂等确保当天缺勤记录存在，再返回“已过打卡时间”。

NestJS Cron 可作为生产环境推荐的增强方案，在每个工作日 `11:01` 主动执行同一
个补算 Service，使缺勤记录在无人打开页面时也能及时生成。MVP 可以关闭 Cron，
但不能省略后端查询补算；仅依靠前端刷新而不在后端补算会导致数据不一致。Cron
和查询接口必须复用同一个 Service，并受 `ATTENDANCE_CRON_ENABLED` 环境变量控制。

补算发现已有人工更正记录时必须跳过，不能把 HR 更正后的请假或出勤重新覆盖为
缺勤。

### 4.10 HR 地区权限与地区假期

学生负责人和地区权限是两个独立概念：

- `ownerHrId` 表示学生由哪位 HR 录入，继续决定普通 HR 能查看和修改哪些
  学生。
- `managedRegionCodes` 表示 HR 可以维护哪些地区的临时假期和地区配置。
- 学生更换工作地点时不自动更换 `ownerHrId`，避免学生可见范围随排班变化。
- Admin HR 不受地区限制，可以管理全部学生、全部地区及全国法定假期。

普通 HR 创建地区临时假期时，目标 `regionCode` 必须属于自己的
`managedRegionCodes`。该权限必须由后端校验，不能只通过前端隐藏选项实现。
普通 HR 不能通过伪造请求创建全国假期或其他地区的临时假期。

地区临时假期按学生当天生效的工作地点判断，而不是按录入该学生的 HR 判断：

1. 查询 `work_location_assignments` 中当天生效的工作地点。
2. 将工作地点转换为稳定的 `regionCode`。
3. 查询当天有效的全国法定假期。
4. 查询当天有效且 `regionCode` 匹配的地区临时假期。
5. 任一规则匹配时，该学生当天无需打卡，也不会被自动记为缺勤。

线上学生默认只受全国法定假期影响，不受北京、上海等线下地区临时假期影响。
如果公司需要设置线上临时假期，由 Admin HR 创建 `regionCode = online` 的
地区假期；普通 HR 只有被明确分配 `online` 权限后才能维护此类配置。

### 4.11 HR 考勤更正

- 普通 HR 只能更正自己录入学生的考勤，Admin HR 可以更正全部学生。
- HR 可以将某个实习工作日更正为按时、迟到、请假或缺勤，也可以为尚无记录的
  日期补建记录。
- 更正日期必须位于学生实习日期范围内且是应出勤工作日。
- 第一版只允许更正北京时间今天或过去日期；未来请假仍使用学生请假登记流程。
- 每次更正必须填写原因，原因不能为空，并限制合理长度。
- 更正沿用 `{ studentId, attendanceDate }` 唯一索引，不创建第二条最终记录。
- 更正不能占用或释放其他学生的设备名额；只有学生主动成功打卡记录参与设备
  每日唯一限制。
- 学生端、HR 每日统计和月度汇总均读取更正后的最终状态。
- 自动缺勤补算和 Cron 不得覆盖人工更正记录。
- 每次更正都写入 `operation_logs`，记录更正前后的必要字段、原因和操作 HR；
  不在日志中保存原始 IP、设备标识等敏感信息。

如果同一记录被多次更正，`attendance_records` 保存最新最终结果，完整修改过程以
操作日志为准。

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

`待登记` 只在打卡窗口关闭前出现。窗口关闭后，无记录学生会被补算为缺勤。
`10:30:00` 后完成的严重迟到虽然保存打卡详情，但最终状态仍为缺勤，因此
计入“缺勤”，不计入“迟到”或“总出勤天数”。

### 5.2 学生出勤汇总

每名学生只显示：

| 字段         | 说明                                       |
| ------------ | ------------------------------------------ |
| 总出勤天数   | 按时天数 + 迟到天数                        |
| 迟到         | 天数和具体日期                             |
| 请假         | 天数和具体日期                             |
| 缺勤         | 天数和具体日期                             |
| 线上出勤天数 | 有效出勤且学生实际选择 `online`            |
| 线下出勤天数 | 有效出勤且学生实际选择 `offline`           |
| 最近一次打卡 | 北京时间、安排地点、实际签到地点及签到方式 |

日期较多时默认显示前几项，通过“查看全部”展开。

### 5.3 HR 数据权限

- 普通 HR 只能查询 `ownerHrId` 为自己的学生及其出勤记录。
- Admin HR 可以查看全部学生。
- Admin HR 可以使用 `ownerHrId` 筛选负责 HR。
- Controller 不能直接接受普通 HR 传入的 `ownerHrId` 扩大数据范围。
- 学生详情接口同样执行所有权校验。
- 普通 HR 的 `managedRegionCodes` 不扩大其学生查询范围，只用于地区临时
  假期和地区配置授权。
- Admin HR 可以分配或收回普通 HR 的地区权限，权限修改后应立即生效并记录
  操作日志。

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
  lateLevel: "normal" | "severe" | null,
  source: "check_in" | "leave_registration" | "absence_scheduler" | "hr_manual",

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

  originalStatus: "on_time" | "late" | "leave" | "absent" | null,
  correctedByHrId: ObjectId | null,
  correctedAt: Date | null,
  correctionReason: String | null,
  correctionCount: Number,

  createdAt: Date,
  updatedAt: Date
}
```

`portalState` 由后端在刷新学生状态后按北京时间计算：未提交且未开始为
`registration`，已提交但未开始为 `waiting`，实习开始日至结束日（含）为
`attendance`，结束日次日起为 `ended`。前端不能根据浏览器日期自行推断。

说明：

- `ownerHrId` 是查询权限快照，便于普通 HR 直接筛选。
- `checkInAt` 仅在学生完成出勤登记时存在。
- `lateLevel = normal` 表示普通迟到，最终状态为 `late`。
- `lateLevel = severe` 表示学生在 `10:30:00` 后至 `11:00:00` 完成登记，
  最终状态为 `absent`，但保留实际打卡详情供 HR 查看。
- `assignedWorkLocation` 是当天 HR 排班地点快照。
- `checkInMode` 是学生实际选择的签到方式；请假和系统缺勤可为 `null`。
- `checkInLocation` 在线上签到时为“线上”，在线下签到时为安排的办公室或
  研究院。
- `deviceIdHash` 只在 `source = check_in` 的主动打卡记录中存在，由后端对
  前端 UUID 执行 SHA-256 后生成。请假和系统缺勤记录为 `null`。
- `11:00:00` 后的打卡请求不写入有效 `checkInAt`；后端幂等创建或保留
  `absent` 记录，并可在 `checkInAttemptAt` 保存最后一次被拒绝的尝试时间。
- `source = hr_manual` 仅用于 HR 为原本没有记录的日期补建记录。更正已有记录时
  保留其原始 `source`，并更新更正元数据。
- `originalStatus` 在第一次更正时保存更正前状态，后续更正不覆盖；完整的每次
  前后变化保存在操作日志中。
- `correctedByHrId`、`correctedAt`、`correctionReason` 保存最近一次更正信息，
  `correctionCount` 记录累计更正次数。
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

保存不需要打卡的全国法定假期或地区临时假期。一个地区假期文档只对应一个
`regionCode`；如果同一临时假期涉及多个地区，后端为每个地区分别创建文档，
便于执行唯一索引和权限校验。

```js
{
  _id: ObjectId,
  date: "2026-10-01",
  name: "国庆节",
  type: "public_holiday" | "temporary_holiday",
  scope: "global" | "region",
  regionCode: "shanghai" | null,
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
{ date: 1, scope: 1, regionCode: 1 } unique partial where isDeleted = false
{ isDeleted: 1, date: 1 }
{ isDeleted: 1, regionCode: 1, date: 1 }
```

字段约束：

```text
scope = global -> type 必须为 public_holiday，regionCode 必须为 null
scope = region -> type 必须为 temporary_holiday，regionCode 必须存在
```

Admin HR 可以在页面选择日期范围，后端把日期范围展开成单日文档。普通 HR
只能创建、修改和删除 `regionCode` 属于自己 `managedRegionCodes` 的地区临时
假期。周末可接受重复配置但返回提示“该日期本身不是工作日”。

### 6.3 hr_users 地区权限扩展

沿用现有 `hr_users` 集合，增加：

```js
{
  role: "admin" | "hr",
  managedRegionCodes: [
    "beijing" | "hong_kong" | "shenzhen" |
    "shanghai" | "nanjing" | "online"
  ]
}
```

- 普通 HR 可以负责一个或多个地区。
- Admin HR 的 `managedRegionCodes` 可以为空，因为 Admin 默认拥有全部地区权限。
- 空数组的普通 HR 仍可管理自己录入的学生，但不能维护任何地区临时假期。
- 地区权限由 Admin HR 修改，普通 HR 不能修改自己的权限。

建议索引：

```js
{
  managedRegionCodes: 1;
}
```

### 6.4 office_networks

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
{
  workLocation: 1;
}
unique;
{
  enabled: 1;
}
```

“线上”不创建网络配置。

### 6.5 operation_logs

沿用现有操作日志集合。为兼容学生以外的配置对象，新增通用目标字段：

```js
{
  operatorHrId: ObjectId,
  studentId: ObjectId | null,
  targetType: "student" | "attendance_calendar" | "attendance_record",
  targetId: ObjectId,
  action: String,
  changes: Object | null,
  createdAt: Date
}
```

旧学生日志允许暂时没有 `targetType/targetId`；读取时按 `student` 和 `studentId`
兼容返回。所有新日志必须由 Service 写入目标字段。新增动作：

```text
attendance.calendar.created
attendance.calendar.updated
attendance.calendar.deleted
attendance.office_network.updated
attendance.record.corrected
hr.regions.updated
```

学生正常打卡不写入 HR 操作日志，避免高频日志污染；其行为已经保存在
`attendance_records`。`attendance.record.corrected` 必须保存目标学生、考勤日期、
更正原因以及更正前后的非敏感业务字段。

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
│   ├── attendance-leave-policy.service.ts
│   ├── office-network.service.ts
│   ├── attendance-correction.service.ts
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
│   ├── correct-attendance-record.dto.ts
│   └── update-office-network.dto.ts
├── enums/
│   ├── attendance-status.enum.ts
│   ├── attendance-source.enum.ts
│   ├── check-in-mode.enum.ts
│   ├── attendance-calendar-scope.enum.ts
│   └── region-code.enum.ts
├── access/
│   ├── work-location-region.map.ts
│   └── region-access.service.ts
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
- 计算按时、普通迟到、严重迟到缺勤或打卡窗口关闭。
- 保证学生每日唯一。
- 写入安排地点、实际签到方式和实际签到地点快照。

`AttendanceDeviceService`

- 校验前端提交的 `deviceId` 是否为合法 UUID。
- 使用 SHA-256 计算 `deviceIdHash`，不保存原始 UUID。
- 检查该浏览器设备标识当天是否已完成成功打卡。
- 把设备唯一索引冲突转换为明确的 `DEVICE_ALREADY_USED` 错误。

`OfficeNetworkService`

- 从可信请求信息读取客户端 IP。
- 解析 IPv4、IPv6 和 CIDR。
- 仅在线下签到时，根据当天安排地点匹配允许网络。

`AttendanceCalendarService`

- 判断周末和系统假期。
- 根据学生当天工作地点判断全国或地区假期。
- 允许 Admin HR 管理全国法定假期和任意地区临时假期。
- 允许普通 HR 仅管理其负责地区的临时假期。
- 校验请假日期范围。

`RegionAccessService`

- 将工作地点映射为稳定地区代码。
- 判断普通 HR 是否具有指定地区权限。
- 拒绝普通 HR 越权修改其他地区或全国假期。
- Admin HR 始终通过地区权限校验。

`AttendanceReconciliationService`

- 为 `11:00:00` 后仍没有记录的学生生成缺勤。
- 保证 Cron 和查询补算幂等。
- 跳过已有记录和人工更正记录。

`AttendanceCorrectionService`

- 校验普通 HR/Admin HR 的学生数据范围。
- 校验日期、实习期、工作日和更正字段组合。
- 更新已有记录或使用 `source = hr_manual` 补建记录。
- 保存最近更正元数据并写入完整操作日志。
- 保证人工更正不会被自动缺勤补算覆盖。

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
第二套登录或权限系统。`HrAccessContext` 需要扩展 `managedRegionCodes`，并由
后端根据当前 HR 数据生成，不能相信请求正文传入的地区权限。

### 7.3 环境配置

建议增加：

```env
ATTENDANCE_TIMEZONE=Asia/Shanghai
ATTENDANCE_ON_TIME_BEFORE=10:01
ATTENDANCE_LATE_THROUGH=10:30
ATTENDANCE_CHECK_IN_CLOSE_AFTER=11:00
ATTENDANCE_CRON_ENABLED=true
TRUST_PROXY_HOPS=1
```

时间边界在第一版由环境变量配置，不提供 HR 修改页面。所有比较均使用
`Asia/Shanghai`，不能使用服务器或浏览器本地时区。设备 UUID 由前端保存在
`localStorage` 并随请求提交，因此不需要设备 Cookie、
`ATTENDANCE_DEVICE_SECRET` 或设备 Cookie 环境变量。

`ATTENDANCE_CRON_ENABLED=false` 时，系统仍必须在 HR 每日出勤、月度汇总和学生
考勤详情查询前执行幂等补算。该开关只控制主动定时执行，不关闭数据正确性兜底。

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
  "checkInWindow": "open",
  "status": "pending",
  "checkInAt": null
}
```

`checkInWindow` 为 `open` 或 `closed`，用于告诉前端当天打卡窗口是否仍开放。
最终判断仍由提交接口在后端重新执行，不能只依赖页面加载时的值。

### 8.3 出勤登记

```text
POST /api/student/attendance/check-in
```

请求：

```json
{
  "checkInMode": "offline",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

学生只提交本次选择的 `checkInMode` 和当前浏览器保存的 `deviceId`。后端校验
UUID、计算 SHA-256 哈希并执行设备每日唯一检查。学生身份、时间、日期、安排
地点、实际签到地点、设备哈希和 IP 均由后端确定；后端还要根据当天安排地点
校验签到方式是否允许。

后端推荐按以下顺序处理：

```text
校验学生登录态
-> 计算北京时间业务日期
-> 查询学生当天是否已有最终记录
-> 校验 deviceId UUID 并计算 deviceIdHash
-> 查询该设备标识当天是否已成功打卡
-> 校验在职、工作日、时间窗口、地点、签到方式和办公室 IP
-> 写入出勤记录
```

MongoDB 的学生每日唯一索引和设备每日唯一部分索引负责最终并发保护。后端需
识别具体的重复键索引，把学生冲突转换为 `STUDENT_ALREADY_CHECKED_IN`，把
设备冲突转换为 `DEVICE_ALREADY_USED`。

成功响应：

```json
{
  "attendanceDate": "2026-07-28",
  "status": "on_time",
  "lateLevel": null,
  "message": "打卡成功",
  "checkInAt": "2026-07-28T01:42:12.000Z",
  "assignedWorkLocation": "上海办公室",
  "checkInMode": "offline",
  "checkInLocation": "上海办公室"
}
```

严重迟到仍返回成功的 HTTP 响应并保存本次登记，但业务状态为缺勤：

```json
{
  "attendanceDate": "2026-07-28",
  "status": "absent",
  "lateLevel": "severe",
  "message": "严重迟到，今日记缺勤",
  "checkInAt": "2026-07-28T02:45:00.000Z",
  "assignedWorkLocation": "上海办公室",
  "checkInMode": "offline",
  "checkInLocation": "上海办公室"
}
```

主要错误：

| HTTP  | code                                 | 场景                                 |
| ----- | ------------------------------------ | ------------------------------------ |
| `400` | `ATTENDANCE_NOT_REQUIRED`            | 周末或假期                           |
| `400` | `CHECK_IN_MODE_NOT_ALLOWED`          | 该安排地点不允许所选签到方式         |
| `403` | `STUDENT_NOT_ONBOARDED`              | 学生当前不在职                       |
| `403` | `OFFICE_NETWORK_REQUIRED`            | 线下打卡 IP 不匹配                   |
| `409` | `STUDENT_ALREADY_CHECKED_IN`         | 学生当天已有记录                     |
| `409` | `DEVICE_ALREADY_USED`                | 设备当天已给其他学生打卡             |
| `400` | `INVALID_LEAVE_DATE`                 | 请假日期格式、真实日期或请求数量无效 |
| `400` | `LEAVE_DATE_OUT_OF_RANGE`            | 请假日期不在今天至未来 14 天内       |
| `409` | `LEAVE_ALREADY_REGISTERED`           | 当天已有请假记录                     |
| `409` | `ATTENDANCE_ALREADY_RECORDED`        | 请假日期已有出勤或缺勤记录           |
| `400` | `LEAVE_CANCELLATION_DATE_NOT_FUTURE` | 撤销日期不是未来日期                 |
| `404` | `LEAVE_RECORD_NOT_FOUND`             | 本人当天没有可撤销的记录             |
| `409` | `LEAVE_NOT_CANCELLABLE`              | 记录不是学生提交的请假               |
| `400` | `CALENDAR_DATE_RANGE_INVALID`        | 假期日期无效或开始日期晚于结束日期   |
| `400` | `CALENDAR_DATE_RANGE_TOO_LARGE`      | 单次创建超过 366 天                  |
| `409` | `CALENDAR_EXCEPTION_CONFLICT`        | 同日期、范围和地区已有有效配置       |
| `404` | `CALENDAR_EXCEPTION_NOT_FOUND`       | 假期配置不存在或已软删除             |
| `409` | `CHECK_IN_WINDOW_CLOSED`             | `11:00:00` 后尝试打卡                |

`CHECK_IN_WINDOW_CLOSED` 的用户提示固定为：

> 已过打卡时间，无法打卡，今日记缺勤。

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
      "lateLevel": null,
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

响应示例：

```json
{
  "startDate": "2026-08-06",
  "endDate": "2026-08-20",
  "maxDaysAhead": 14,
  "items": [
    {
      "attendanceDate": "2026-08-06",
      "selectable": true,
      "reason": "available",
      "message": "可登记请假",
      "workLocation": "上海办公室 - 绿地汇",
      "holidayName": null,
      "existingStatus": null
    },
    {
      "attendanceDate": "2026-08-08",
      "selectable": false,
      "reason": "weekend",
      "message": "周末无需登记出勤",
      "workLocation": "上海办公室 - 绿地汇",
      "holidayName": null,
      "existingStatus": null
    }
  ]
}
```

后端会完整返回 15 个自然日。前端只允许选择 `selectable=true` 的日期，并直接显示
`message` 解释禁用原因。已有出勤、请假或缺勤记录的日期也会禁用，分别返回稳定的
`reason` 和 `existingStatus`。

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
  "dates": ["2026-07-30", "2026-07-31"],
  "registeredAt": "2026-07-28T02:00:00.000Z"
}
```

后端只接受日期数组，学生 ID、负责 HR、登记时间、工作地点和地点安排 ID 均从登录
身份及当天有效安排中生成。所有日期先统一完成 14 天窗口、在职、工作日、假期和已有
记录校验，再以同一个 UUID `leaveBatchId` 写入 `attendance_records`。正常校验失败不会
写入任何记录；并发请求触发学生每日唯一索引时，后端会按本次 `leaveBatchId` 清理已
写入部分并返回稳定的 `409`，避免保留不完整的请假批次。

### 8.7 撤销未来请假

```text
DELETE /api/student/attendance/leaves/:attendanceDate
```

只能撤销晚于当前北京时间日期、属于当前登录学生、并由学生请假登记接口生成的请假。
当天或过去日期、出勤记录、系统缺勤记录和未来由 HR 更正产生的记录都不能通过此接口删除。

撤销成功后物理删除该日期的学生请假记录，因此学生之后可以重新申请该日期，或在当天正常
打卡。学生 ID 只从 JWT Cookie 读取，删除条件同时包含学生 ID、日期、状态和来源，避免越权
或并发请求误删其他记录。

成功响应：

```json
{
  "attendanceDate": "2026-08-07",
  "leaveBatchId": "0c5ee67a-720a-45e0-a786-f62d16890b17",
  "cancelledAt": "2026-08-06T02:00:00.000Z"
}
```

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

响应按学生返回：

```json
{
  "month": "2026-07",
  "items": [
    {
      "student": {
        "id": "studentId",
        "name": "张三",
        "email": "zhangsan@example.com",
        "ownerHr": { "id": "hrId", "name": "上海 HR" }
      },
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
        "offlineAttendanceDays": 10,
        "latestCheckIn": {
          "attendanceDate": "2026-07-28",
          "checkInAt": "2026-07-28T01:42:12.000Z",
          "assignedWorkLocation": "上海办公室 - 会德丰",
          "checkInMode": "offline",
          "checkInLocation": "上海办公室 - 会德丰"
        }
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### 8.10 学生详情中的出勤记录

```text
GET /api/hr/attendance/students/:studentId?month=2026-07
```

普通 HR 只能访问自己录入的学生，Admin HR 可访问全部学生。

### 8.10.1 HR 更正学生考勤

```text
PATCH /api/hr/attendance/students/:studentId/records/:attendanceDate
```

该接口按学生和日期幂等更新：已有记录时更正最终状态，没有记录时补建人工记录。
请求示例：

```json
{
  "status": "leave",
  "correctionReason": "学生已提前向带教请假，HR 补登记"
}
```

更正为 `on_time` 或 `late` 时，接口还需要接收并校验实际签到方式等必要字段；
更正为 `leave` 或 `absent` 时，不伪造学生打卡时间或设备信息。普通 HR 只能操作
自己录入的学生，Admin HR 可以操作全部学生。成功后返回最新记录，并写入
`attendance.record.corrected` 操作日志。

### 8.11 工作日历

```text
GET    /api/hr/attendance/calendar
POST   /api/hr/attendance/calendar
PATCH  /api/hr/attendance/calendar/:id
DELETE /api/hr/attendance/calendar/:id
```

查询参数：

```text
month=2026-10
scope=global|region
regionCode=shanghai
```

以上四个接口都会根据数据库中的 HR 当前角色和 `managedRegionCodes` 重新鉴权，
不只信任登录 Cookie 中可能过期的权限：

- Admin HR 可以查看和维护全国法定假期及全部地区临时假期。
- 普通 HR 可以查看全国法定假期，以及自己负责地区的临时假期。
- 普通 HR 只能创建、修改和删除自己负责地区的临时假期，不能维护全国法定假期。
- 修改记录时同时校验原记录和修改后的目标地区，不能借修改接口把记录转移到无权地区。
- 不带 `scope/regionCode` 查询时，普通 HR 默认返回全国假期和其负责地区假期；显式查询
  地区时，地区必须属于当前数据库中的 `managedRegionCodes`。

创建全国法定假期：

```json
{
  "startDate": "2026-10-01",
  "endDate": "2026-10-07",
  "name": "国庆节",
  "scope": "global",
  "regionCode": null,
  "reason": "全国法定假期"
}
```

创建地区临时假期：

```json
{
  "startDate": "2026-09-18",
  "endDate": "2026-09-18",
  "name": "上海临时假期",
  "scope": "region",
  "regionCode": "shanghai",
  "reason": "公司临时安排"
}
```

后端将闭区间展开为单日文档，单次最多 366 天。`scope=global` 时自动写入
`type=public_holiday` 且 `regionCode=null`；`scope=region` 时自动写入
`type=temporary_holiday` 并要求地区代码。客户端不能自行指定 `type`。

`PATCH` 每次修改一条单日记录，可修改 `date`、`name`、`scope`、`regionCode` 和
`reason`，至少需要提供一个字段。`DELETE` 使用 `isDeleted/deletedAt` 软删除，删除后
同一日期、范围和地区可以重新创建。所有写入都保存 `createdByHrId` 或
`updatedByHrId`。同一日期、范围和地区已存在有效配置时返回稳定的 `409`。
创建、修改和删除分别写入 `attendance.calendar.created`、
`attendance.calendar.updated` 和 `attendance.calendar.deleted` 操作日志；日志只保存
日历 ID、日期、范围、地区、名称、原因及必要的新旧值，不包含学生敏感信息。

### 8.12 办公网配置

```text
GET /api/hr/attendance/office-networks
PUT /api/hr/attendance/office-networks/:workLocation
```

仅允许 Admin HR。

### 8.13 HR 地区权限管理

```text
GET   /api/hr/admin/users
PATCH /api/hr/admin/users/:hrUserId/regions
```

仅允许 Admin HR。修改请求示例：

```json
{
  "managedRegionCodes": ["shanghai", "nanjing"]
}
```

后端校验地区代码、去重并记录操作日志。不能从前端接收或修改目标 HR 的
`role`、密码等无关字段。

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

进入页面时，前端读取 `localStorage` 中的 `attendance_device_id`。如果不存在，
则通过 `crypto.randomUUID()` 生成并保存。学生确认签到时，前端把该 `deviceId`
与 `checkInMode` 一起提交；它只用于限制同一浏览器设备标识当天只能成功签到
一次，不参与学生登录，也不与学生永久绑定。

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
打卡成功，今日记为迟到
严重迟到，今日记缺勤
已过打卡时间，无法打卡，今日记缺勤
今日已登记
请连上办公室 Wi-Fi 后再登记出勤
该设备今日已完成出勤登记
今日无需登记出勤
```

成功后按钮禁用，展示实际北京时间、地点和按时/迟到/严重迟到缺勤状态。
`11:00:00` 后接口返回打卡窗口关闭，页面弹窗显示固定提示并禁用当天打卡
按钮。

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
共享文档
```

“出勤管理”包含：

```text
每日出勤
出勤汇总
工作日历        Admin 和已分配地区的普通 HR
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
- 创建全国法定假期或任意地区临时假期。
- 填写假期名称、类型、地区和原因。
- 修改未来假期。
- 取消误添加的假期。
- 查看创建和最后修改人。

普通 HR 可以：

- 查看全国法定假期。
- 创建、修改和取消自己负责地区的临时假期。
- 只能在 `managedRegionCodes` 范围内选择地区。

普通 HR 不应在下拉框中看到无权限地区，但后端仍必须对提交的 `regionCode`
再次鉴权。

修改已经产生出勤记录的历史日期时，必须二次确认，并触发指定日期的出勤
重新核算或交由 Admin 手动处理。

### 10.6 HR 地区权限管理

Admin HR 后台增加“HR 账号权限”页面：

- 查看普通 HR 的姓名、邮箱和负责地区。
- 使用多选控件分配一个或多个地区。
- 清空地区权限时明确提示该 HR 将不能维护任何地区临时假期。
- 保存后立即刷新权限并显示操作成功提示。

普通 HR 只在自己的账号信息中只读查看负责地区，不能自行修改。

### 10.7 办公网配置

每个办公室显示：

- 工作地点。
- 地址。
- 允许的 IP/CIDR 列表。
- 启用状态。
- 最后修改时间和修改人。

保存前后端均校验 IP/CIDR 格式。修改配置只影响后续打卡，不改变历史记录。

### 10.8 共享文档

新增 HR 页面：

```text
/hr/shared-document
```

页面用于展示公司指定的在线腾讯文档：

- 页面标题显示配置的文档名称。
- 优先在页面主体使用 `iframe` 展示腾讯文档。
- 提供“在腾讯文档中打开”按钮，始终允许在新标签页打开原始链接。
- 加载失败、登录状态失效或腾讯文档禁止嵌入时，显示明确提示并保留新标签页
  打开入口。
- 普通 HR 和 Admin HR 均可访问此页面。
- 文档的查看、编辑和分享权限由腾讯文档自身控制，系统不把文档内容复制到
  MongoDB，也不绕过腾讯文档登录。

前端环境配置：

```env
NEXT_PUBLIC_TENCENT_DOC_URL=https://docs.qq.com/...
NEXT_PUBLIC_TENCENT_DOC_TITLE=HR 在线文档
```

开发时必须使用公司提供的实际腾讯文档链接验证嵌入效果。若腾讯文档响应的
安全策略、登录 Cookie 或页面类型不允许 `iframe` 嵌入，则正式方案显示说明
和“在腾讯文档中打开”按钮，不通过代理绕过第三方页面安全限制。

## 11. 自动缺勤执行方式

### 11.1 必需：查询时幂等补算

HR 每次查询每日出勤、月度汇总或学生考勤详情时，后端先调用统一的
`AttendanceReconciliationService` 补齐查询范围内应生成的缺勤记录，再返回
查询结果。前端刷新只是触发 API 请求，缺勤判断和数据库写入必须由后端完成。

实现要求：

- 使用批量写入和唯一索引处理并发。
- 重复查询和重复补算不产生重复记录。
- 单个学生失败不能导致整个查询范围的补算中止。
- 已有记录和 HR 人工更正记录不得被覆盖。
- 补算完成后的统计和列表必须来自数据库最终记录。

### 11.2 可选：NestJS Cron 主动补算

```text
Cron: 每个工作日北京时间 11:01
Time zone: Asia/Shanghai
开关: ATTENDANCE_CRON_ENABLED
```

Cron 与查询接口调用同一个 `AttendanceReconciliationService`。开启后，它负责在
无人访问 HR 页面时及时生成缺勤记录；关闭后，系统仍可在 HR 下次查询或刷新时
补齐记录。

开启 Cron 时还应：

- 使用 `@nestjs/schedule`。
- 记录开始时间、结束时间、扫描人数、新增缺勤数和失败数。
- 单个学生失败不能终止整批任务。
- 多实例部署时增加分布式锁，或改由云平台只触发一个任务实例。

## 12. 安全与隐私

- 服务端生成打卡时间。
- 学生只能提交 `checkInMode` 和浏览器生成的 UUID `deviceId`，不能提交
  `studentId`、时间、安排地点、实际签到地点、IP 或设备哈希。
- `deviceId` 只用于每日设备次数限制，不能作为身份认证；学生身份必须来自
  现有 JWT 登录态。
- 后端校验 UUID 格式并只保存 SHA-256 `deviceIdHash`，不保存原始 UUID。
- 后端根据当天安排地点校验 `checkInMode`，不能相信前端提供的可选范围。
- 普通 HR 不能访问其他 HR 学生的出勤数据。
- 只有 Admin HR 能维护全国法定假期和办公网络；普通 HR 只能维护自己负责
  地区的临时假期。
- 后端从已认证 HR 账号读取 `managedRegionCodes`，不能相信请求正文声明的
  地区权限。
- 不向 HR 页面返回完整设备标识。
- 默认不向 HR 返回原始客户端 IP。
- 第一版 `localStorage` 设备标识可以被清除或更换，不应被描述为严格的物理
  设备认证或防作弊机制。
- 生产环境必须配置 HTTPS 和可信反向代理。
- 打卡接口增加频率限制。

## 13. 测试计划

### 13.1 单元测试

- 北京时间跨日和月份边界。
- 周末和管理员假期。
- 开始日期、结束日期和结束次日。
- `10:00:59`、`10:01:00`、`10:30:00`、`10:30:01`、`11:00:00`、
  `11:00:01`。
- 普通迟到保存 `lateLevel = normal`，严重迟到保存
  `status = absent` 和 `lateLevel = severe`。
- `11:00:00` 后拒绝有效打卡，并幂等确保当天缺勤记录存在。
- 当天工作地点历史查询。
- 安排地点为“线上”时只允许线上签到，伪造线下签到被拒绝。
- 安排地点为办公室或研究院时允许选择线上签到，且不校验 IP。
- 安排地点为办公室或研究院时选择线下签到，校验 IPv4、IPv6、CIDR。
- 汇总中的线上和线下天数按学生实际选择的 `checkInMode` 统计。
- 请假 14 天边界和多日期校验。
- `deviceId` UUID 格式校验和 SHA-256 哈希。
- 学生每日唯一和浏览器设备标识每日唯一。
- 请假、系统缺勤和失败打卡不占用设备名额。
- Cron 幂等和查询补算。
- 关闭 Cron 时，HR 查询仍能幂等生成应有缺勤记录。
- 人工更正已有记录、补建缺失记录和多次更正。
- 自动缺勤补算不会覆盖人工更正结果。
- 普通 HR 不能更正其他 HR 学生，Admin 可以更正全部学生。
- 普通 HR/Admin HR 权限范围。
- 工作地点到地区代码的映射。
- 全国法定假期对所有地区生效。
- 地区临时假期只对当天地点属于对应地区的学生生效。
- 普通 HR 只能维护 `managedRegionCodes` 内的临时假期。
- 普通 HR 伪造其他地区或全国假期请求时被拒绝。
- Admin HR 可以维护全部地区并修改 HR 地区权限。

### 13.2 集成测试

- 同一学生并发点击两次，只生成一条记录。
- 同一学生同一天改用另一设备，第二次打卡仍被拒绝。
- 不同学生同一天使用同一设备标识，第二名学生被拒绝。
- 不同学生同一天使用不同设备标识，均可成功打卡。
- 同一设备标识在不同日期可以再次使用，也不与任何学生永久绑定。
- Cron 与学生同时打卡时不会生成两条记录。
- HR 更正与查询补算并发时仍只保留一条最终记录。
- HR 将缺勤更正为请假后，刷新和重复补算不会恢复为缺勤。
- `10:30:00` 后至 `11:00:00` 的登记保存时间和地点，但汇总计入缺勤。
- `11:00:00` 后打卡返回 `CHECK_IN_WINDOW_CLOSED`，不写入有效
  `checkInAt`。
- 办公室学生线上签到时同时保存原安排地点和实际线上签到。
- 线上学生提交线下签到时返回 `CHECK_IN_MODE_NOT_ALLOWED`。
- 未来请假提交及撤销。
- 工作地点在同一天发生变化时使用正确的有效段。
- Admin 添加全国假期后，所有地区当天不再生成缺勤。
- 上海 HR 添加上海临时假期后，上海地点学生当天不生成缺勤，北京地点学生
  不受影响。
- 普通 HR 无法修改未分配地区的日历记录。

### 13.3 前端验收

- 学生登录后进入正确页面。
- 线上地点只展示线上签到；办公室地点展示线上和线下两种选择。
- 线下失败提示与线上成功流程。
- 打卡按钮重复点击保护。
- 普通迟到、严重迟到和超过打卡时间分别显示正确提示。
- 学生可以按月份查看自己的出勤汇总和每日记录。
- 多日期请假选择和禁用日期。
- HR 每日统计总数一致。
- 普通 HR 看不到其他 HR 学生。
- Admin 筛选负责 HR。
- 普通 HR 的工作日历仅显示可管理地区，Admin 可以选择全部地区和全国范围。
- Admin 可以为普通 HR 分配多个地区，普通 HR 不能自行修改。
- “共享文档”可以嵌入实际腾讯文档，或在禁止嵌入时正确显示新标签页入口。
- 桌面和手机页面无文字遮挡或横向溢出。

## 14. 开发顺序

### Phase 1：基础数据和公共服务

- 新增 Schema、枚举、索引和 Module。
- 新增地区代码、工作地点到地区的映射和 `managedRegionCodes`。
- 实现北京时间、工作日和在职资格判断。
- 实现当天工作地点查询。

验收：Service 单元测试通过，可以正确判断某学生某天是否需要出勤。

当前状态：Phase 1 已完成。北京时间、地区权限、工作日历、当天有效地点和统一
出勤资格判断均已实现，并由单元测试与跨服务验收测试覆盖。

### Phase 2：学生打卡后端

- 实现 `deviceId` DTO 的 UUID 校验和后端 SHA-256 哈希。
- 实现学生每日唯一和设备标识每日唯一的部分索引及冲突处理。
- 实现签到方式 DTO、允许方式判断和后端校验。
- 实现办公室学生线上/线下选择及线下 IP 校验。
- 实现每日唯一打卡。
- 实现按时、普通迟到、严重迟到缺勤和 `11:00:00` 后关闭打卡。

验收：使用 `curl` 或测试用例完成允许方式、伪造方式、线上、线下、重复和设备
冲突验证。

当前状态：2A、2B、2C、2D、2E、2F 已完成。学生打卡请求 DTO、响应和标准错误码契约已经建立；
设备 UUID 会在后端进行二次校验、标准化和 SHA-256 哈希，并支持主动打卡记录的
每日设备占用预检查及唯一索引冲突转换；签到策略会根据当天安排地点返回允许
方式，并在后端拒绝伪造方式；线下签到网络服务会读取对应地点的启用配置，支持
IPv4、IPv6、单个 IP 和 CIDR 匹配，并采用失败关闭策略。核心打卡 Service 已将
学生每日唯一、资格、签到方式、设备、办公室 IP、北京时间状态分级及并发冲突
处理串联起来；`POST /api/student/attendance/check-in` 已接入现有学生 JWT Cookie
鉴权，学生 ID 只取自验证后的 token，客户端 IP 只取自服务端请求对象。Controller
单元测试和真实登录 Cookie 的 HTTP 验收覆盖了未登录、非法 DTO 与合法请求。

### Phase 3：请假和工作日历

- `3A`：请假 DTO、北京时间 14 天窗口和学生状态规则。
- `3B`：查询未来 14 天内可选、禁用日期及原因。
- `3C`：多日期请假登记、批次 ID、唯一索引冲突处理。
- `3D`：仅撤销学生自己提交的未来请假。
- `3E`：Admin 全国/地区假期 CRUD。
- `3F`：普通 HR 负责地区临时假期 CRUD、越权校验和操作日志。
- `3G`：请假、假期、权限和并发测试。

当前状态：`3A`、`3B`、`3C`、`3D`、`3E`、`3F`、`3G` 已完成。`CreateLeaveRegistrationDto` 只允许提交唯一的
`YYYY-MM-DD` 日期数组；`AttendanceLeavePolicyService` 使用北京时间校验今天至
未来第 14 天的闭区间、真实日历日期和有效实习工作日，并提供结构化错误码。
`GET /api/student/attendance/leave-options` 使用学生 JWT Cookie 鉴权，按北京时间
生成今天至未来第 14 天共 15 个日期，逐日判断实习期、当前状态、有效工作地点、
周末、全国/地区假期及已有考勤记录，并返回可选状态和禁用原因。批量资格判断只刷新
一次学生状态并读取一次学生快照，避免为 15 个日期重复查询相同基础数据。
`POST /api/student/attendance/leaves` 会重新执行全部后端规则，不能依赖前端传回的
可选状态；通过后为所有日期创建 `leave` 记录并共享同一个 `leaveBatchId`。已有请假
返回 `LEAVE_ALREADY_REGISTERED`，已有出勤或缺勤返回
`ATTENDANCE_ALREADY_RECORDED`，MongoDB 学生每日唯一索引负责最终并发保护。
`DELETE /api/student/attendance/leaves/:attendanceDate` 只允许当前登录学生撤销晚于北京时间
今天、且来源为 `leave_registration` 的本人请假。撤销会物理删除该条记录，让该日期可以重新
申请或打卡；删除查询再次限定学生、日期、状态和来源，并对并发撤销返回稳定的 `404`。
`GET/POST/PATCH/DELETE /api/hr/attendance/calendar` 已提供 Admin 全国及任意地区
假期维护能力，以及普通 HR 负责地区临时假期维护能力。查询按月份读取有效记录；创建
会把日期闭区间展开为单日记录并自动推导全国法定假期或地区临时假期类型；修改执行
原范围、目标范围权限和唯一性校验；删除使用软删除。每次操作先从数据库复核当前角色和
地区权限，账号降权或地区权限变更后无需等待旧 Cookie 过期。创建、修改、删除均写入
通用目标操作日志，旧学生日志保持兼容。
现有 `managedRegionCodes` 和 Admin 分配地区权限已在 Phase 1 完成，Phase 3
直接复用，不重复开发权限数据模型。

`3G` 已补充 Phase 3 综合验收测试，并使用真实的北京时间、当天有效地点、地区映射、
工作日历、出勤资格、请假策略和请假登记 Service 串联验证。测试覆盖地区临时假期只
影响对应地区、全国假期影响全部地区、假期不能生成请假记录、同一学生同一日期并发
申请时最终只保留一条记录，以及敏感权限始终以数据库中的最新 HR 角色和负责地区为准。
已有单元测试继续覆盖多日期批次、部分写入补偿清理、未来请假撤销、日历 CRUD、
越权读写和操作日志。

验收：周末、假期和不可选日期均不能产生错误记录。

### Phase 4：自动缺勤

- `4A`：建立统一的 `AttendanceReconciliationService`，提供按单日、日期范围和
  单个学生补算的入口；统一返回扫描、新增、跳过、失败数量及失败明细，并完成日期、
  日期范围和学生 ID 的基础校验。
- `4B`：扫描指定日期内需要出勤、已入职且尚无考勤记录的候选学生。
- `4C`：为候选学生写入自动缺勤记录，并保留当天安排地点等必要快照。
- `4D`：通过数据库唯一索引和条件写入保证重复执行、并发补算都不会生成重复记录，
  也不会覆盖学生登记或 HR 人工更正结果。
- `4E`：在 HR 每日考勤和学生考勤详情查询前执行幂等补算，作为必须的数据正确性机制。
- `4F`：实现可通过 `ATTENDANCE_CRON_ENABLED` 开关的 Cron，作为推荐增强。
- `4G`：补充任务日志、单元测试、集成测试和异常场景测试。

当前进度：`4A`、`4B`、`4C`、`4D`、`4E`、`4F`、`4G` 已完成，Phase 4 已收尾。服务已经注册到 `AttendanceModule` 并导出，调用契约、
基础校验和候选扫描已有单元测试。扫描会在一批任务开始时只刷新一次学生状态，按日期
批量查询处于有效实习期的已入职或已离职学生及已有考勤记录，再根据当天有效工作地点、
周末和全国/地区假期筛出真正需要补算且尚无记录的候选学生。已有任何来源的考勤记录、
缺少有效地点或当天无需出勤的学生都会跳过；单个学生的地点或日历查询失败只进入失败
明细，不会中断整批扫描。候选学生会写入 `source = absence_scheduler`、
`status = absent` 的缺勤记录，并保存负责 HR、当天安排地点及地点记录 ID 快照；历史日期
允许补算，当天只有在北京时间打卡窗口关闭后才能写入，未来日期始终跳过。单条写入失败
不会阻止其他候选学生继续处理。缺勤保存使用按 `studentId + attendanceDate` 条件执行的
原子 `$setOnInsert` upsert；已有签到、请假、缺勤或 HR 人工更正时只计为跳过，不修改任何
业务字段或 `updatedAt`。并发补算触发学生每日唯一索引冲突时同样计为幂等跳过，不进入失败
明细。重复执行、扫描与写入之间出现其他来源记录、并发唯一索引竞争均已有单元测试。

`AttendanceQueryPreparationService` 已作为统一的“查询前补算”入口注册并从
`AttendanceModule` 导出。Admin HR 查询每日记录时执行全局单日补算，普通 HR 只按
`ownerHrId` 补算自己负责的学生；按月查询会对历史月份补算完整月份，对当前月份只补算到
北京时间今天，对未来月份不执行补算。学生查看自己的月度明细时只补算当前学生，不能扩大
到其他学生。Phase 5 和 Phase 6 实现学生记录、HR 每日考勤及月度汇总查询 Service 时，必须
先调用该准备层，再读取 `attendance_records`；Controller 不重复实现权限或日期范围逻辑。
Admin、普通 HR、单个学生、闰月、当前月截断、未来月份和非法月份均已有单元测试。

`AttendanceAbsenceScheduler` 已在 `AttendanceModule` 注册，每个周一至周五北京时间
`11:01` 调用同一个 `AttendanceReconciliationService.reconcileDate()`。任务使用
`waitForCompletion` 防止同一实例内重叠执行，并记录业务日期、开始时间、完成时间、扫描数、
新增数、跳过数和失败数；存在隔离失败时记录 warning，任务整体异常会记录 error 并继续向
调度框架抛出，避免静默失败。
`ATTENDANCE_CRON_ENABLED` 支持 `true/1/yes/on` 启用，未设置或其他值均视为关闭；关闭时
任务不会读取或写入数据库。本地 `.env.example` 默认关闭，生产环境可以显式设为 `true`。
无论 Cron 是否开启，4E 的查询前补算仍是数据正确性的保底机制。

`4G` 已增加 Phase 4 综合验收测试，串联真实的北京时间服务、查询前准备层、缺勤补算服务和
Cron，并使用确定性的内存模型模拟 MongoDB 原子 upsert。测试覆盖普通 HR 只补算自己负责的
学生、Admin 补算全部学生、已有请假等记录不被覆盖、Cron 后查询仍保持幂等、两次并发补算
最终每名学生只有一条记录，以及单个学生地点查询失败不会阻止其他学生生成缺勤。该测试不
依赖本地 MongoDB，适合在开发机和 CI 中稳定重复执行；唯一索引冲突及数据库错误分支继续由
对应 Service 单元测试覆盖。

验收：重复运行任务不会重复写入；关闭 Cron 时，HR 刷新查询仍会使 `11:01`
后无记录学生变为缺勤；任何补算都不会覆盖人工更正结果。

### Phase 5：学生前端

- `5A`：补齐学生入口状态、今日考勤状态和个人月度记录三个只读 API。
- `5B`：建立前端考勤类型、API Client 和 `attendance_device_id` 本地持久化工具。
- `5C`：根据 `/api/student/portal` 改造登录后入口路由。
- `5D`：搭建学生考勤主页面和今日状态面板。
- `5E`：实现线上/线下签到选择、提交和状态反馈。
- `5F`：实现多日期请假登记、禁用原因和未来请假撤销。
- `5G`：实现按月查看“我的出勤记录”和个人汇总。
- `5H`：补齐未开始、已结束、非工作日、缺少地点和登录过期等页面状态。
- `5I`：完成前端测试、响应式检查和 Phase 5 验收。

当前进度：`5A`、`5B`、`5C`、`5D`、`5E`、`5F`、`5G`、`5H`、`5I` 已完成，Phase 5 已收尾。`StudentPortalService` 会先刷新数据库中的入职/离职状态，
再返回 `registration`、`waiting`、`attendance` 或 `ended`；结束日期当天仍返回
`attendance`。`StudentAttendanceReadService` 在今日状态和月度记录查询前调用 Phase 4
查询准备层执行幂等缺勤补算，今日响应包含工作日、安排地点、允许签到方式、签到窗口和
最终状态。月度接口只查询当前登录学生，按日期升序返回明细；总出勤只统计按时和普通迟到，
严重迟到仍计入缺勤，线上/线下天数也只统计有效出勤。三个接口均由学生 JWT Cookie 保护，
月份必须为 `YYYY-MM`，学生 ID 只读取 Cookie 中的 `sub`。

前端已建立与后端契约一致的入口、今日考勤、签到、请假和月度记录 TypeScript 类型，
并通过统一 API Client 调用全部学生考勤接口。浏览器首次需要签到时使用
`crypto.randomUUID()` 生成 `attendance_device_id` 并持久化到 `localStorage`；已有合法 UUID
会继续复用，缺失或非法值会重新生成。该标识只用于设备每日使用次数限制，不是身份凭证，
不使用设备 Cookie，也不会把学生永久绑定到一台设备。后端业务错误码已由通用
`ApiError.code` 暴露，后续页面可针对重复签到、设备已使用、办公室网络不匹配等情况显示
明确反馈。

学生前端已将 `/api/student/portal` 作为登录后入口的唯一分流依据，不再通过登录响应中的
`hasSubmitted` 判断页面。`registration`、`waiting`、`attendance`、`ended` 分别进入
`/student/form`、`/student/submitted`、`/student/attendance`、`/student/ended`；
`/student` 作为统一工作台入口，会在已有登录态下重新读取后端状态并跳转。登记页、已提交页、
考勤页和结束页均会再次校验入口状态，手动输入旧地址时也会回到当前应进入的页面；登录过期则
统一返回学生登录页。考勤页目前已建立通过鉴权和状态校验的页面入口，今日状态面板在 `5D`
接入。

学生考勤工作台现已调用 `GET /api/student/attendance/today` 展示北京时间业务日期、今日是否为
工作日、当天生效的工作地点、签到窗口、可用签到方式、线下签到的办公室 Wi-Fi 要求、最终
考勤状态及已有签到时间。页面覆盖 `pending`、`not_required`、`on_time`、`late`、`leave`、
`absent` 六种状态，并提供加载、请求失败重试、手动刷新和登录失效跳转。地点名称会同时展示
现有详细地址；页面只展示后端判定结果，不在浏览器内自行计算迟到或缺勤。`5E` 已在该面板中
接入线上/线下选择和实际签到提交。

今日状态为 `pending`、当天是工作日且签到窗口开放时，学生可以从后端返回的
`allowedCheckInModes` 中选择实际签到方式；线上地点只显示线上签到，办公室或研究院地点显示
线上和线下签到。线下签到确认弹窗会明确提醒连接当前办公室 Wi-Fi，最终 IP 校验仍由后端
执行。提交时前端只发送 `checkInMode` 和浏览器本地生成的 UUID，不发送学生、时间或地点；
提交期间选择器、弹窗和按钮均锁定，防止重复点击。

签到成功后页面显示后端返回的“打卡成功”“迟到”或“严重迟到/缺勤”结果并刷新今日状态；
`OFFICE_NETWORK_REQUIRED`、`STUDENT_ALREADY_CHECKED_IN`、`DEVICE_ALREADY_USED`、
`CHECK_IN_WINDOW_CLOSED`、`CHECK_IN_MODE_NOT_ALLOWED`、`ATTENDANCE_NOT_REQUIRED`、
`STUDENT_NOT_ONBOARDED`、`LEAVE_ALREADY_REGISTERED` 和无效设备标识均有明确中文反馈。
重复记录、已有请假和窗口关闭还会刷新今日记录，确保界面与数据库最终状态一致。

考勤工作台现提供“今日考勤”和“请假登记”两个视图。请假视图调用后端
`GET /api/student/attendance/leave-options` 展示北京时间今天至未来两周内的日期，支持一次选择
多个可请假工作日；周末、系统或地区假期、实习期外、缺少地点、已有出勤、已有请假或已有缺勤
等日期均按后端返回的原因禁用，并直接显示不可选择原因。页面固定提示学生先与带教分析师对接，
再告知 HR 并登记请假。

学生提交前会在确认弹窗中核对全部所选日期，提交期间锁定日期、刷新和提交操作；成功后清空选择、
显示结果并重新读取后端状态。由学生登记且晚于北京时间今天的请假会显示“撤销请假”，经二次确认
后调用删除接口；今天和过去日期不能由学生撤销。并发冲突、已有记录、超出日期范围、实习状态不符
和不可撤销等业务错误均提供明确中文反馈，并在冲突或撤销后重新加载日期列表。

考勤工作台现增加“出勤记录”视图，默认读取中国北京时间当前月份，并使用 Ant Design 月份选择器
切换历史月份；未来月份不可选择。视图调用 `GET /api/student/attendance/records?month=YYYY-MM`，
展示总出勤、迟到、请假、缺勤、线上出勤和线下出勤六项个人汇总，其中迟到、请假和缺勤同时列出
对应日期。总出勤只采用后端返回的有效出勤天数，不在前端重新推导业务口径。

每日明细按日期升序展示后端保存的最终状态、北京时间登记时间、线上/线下签到方式和当天生效的工作
地点；`lateLevel=severe` 且状态为缺勤时明确显示“严重迟到（记缺勤）”。无记录月份、请求加载、
请求失败重试、手动刷新和登录失效跳转均有独立状态。切换月份时旧月份数据不会短暂显示为新月份，
避免快速切换产生界面错配。

学生入口现已补齐边界页面状态。登记完成但尚未入职时进入“等待入职”页，并显示入职开始日期和
首个工作地点；实习结束日期次日进入结束页，不再显示签到或请假入口。考勤页会区分周末或系统休息日
与缺少有效地点安排：前者提示“今日休息”，后者提示“待安排”并引导学生联系 HR。签到区也会根据
当天状态显示具体不可操作原因，不再统一显示模糊的不可签到提示。

学生端入口查询、登记表读取、今日考勤、请假选项、月度记录以及签到、请假提交和撤销操作遇到
`401` 时，都会跳转到带 `reason=session-expired` 的登录页。登录页会明确提示“登录已过期，请重新
输入姓名和邮箱进入系统”，主动退出仍保持普通登录页提示，避免把正常退出误报为会话过期。

`5I` 已为学生考勤前端接入 Vitest、jsdom 和 Testing Library，共建立 5 个测试文件、13 个测试，
覆盖学生入口四种路由、设备 UUID 持久化、今日考勤边界状态、考勤视图切换及多日期请假选择与提交确认。
桌面端和 `390 x 844` 移动端均已进行浏览器验收；移动端页签和日期网格可正常使用，页面无横向溢出，
浏览器控制台无错误。前端 lint、自动化测试和生产构建均已通过。

验收完成：学生在开始前、实习中、结束后分别进入正确页面；学生可以完成签到、请假登记与撤销，
并按月查看个人出勤记录。Phase 5 的功能、错误状态和响应式页面均已通过验证。

### Phase 6：HR 后端

- `6A`：确定每日统计、月度汇总、学生详情和考勤更正 API 契约。
- `6B`：建立普通 HR/Admin HR 共用的学生与考勤数据权限层。
- `6C`：实现 HR 每日考勤统计和明细 API。
- `6D`：实现 HR 月度学生出勤汇总 API。
- `6E`：实现 HR 学生考勤详情 API。
- `6F`：实现 HR 考勤更正和当前更正信息保存。
- `6G`：为考勤更正接入操作日志。
- `6H`：完成筛选、分页、排序和查询性能检查。
- `6I`：补齐单元、集成测试并完成 Phase 6 验收。

当前进度：`6A`、`6B`、`6C`、`6D`、`6E`、`6F`、`6G`、`6H`、`6I` 已完成，Phase 6 已通过验收。HR 考勤后端固定使用以下四类接口契约：

```text
GET   /api/hr/attendance/daily
GET   /api/hr/attendance/summary
GET   /api/hr/attendance/students/:studentId
PATCH /api/hr/attendance/students/:studentId/records/:attendanceDate
```

每日和月度列表查询统一支持 `page`、`limit`、`keyword`、`workLocation`、`checkInMode` 和
`ownerHrId`。每日查询另接收 `date`、`status` 和每日排序方式，月度汇总另接收 `month` 和汇总
排序方式；`ownerHrId` 只有 Admin HR 可以实际使用，角色校验由 `6B` 完成。学生详情以月份读取
一名学生的汇总与每日记录。

每日响应固定返回应出勤总数、有效打卡、按时、迟到、请假和缺勤数量，以及分页学生明细；月度
汇总固定返回每名学生的总出勤、迟到/请假/缺勤天数及日期、线上/线下天数和最近一次签到。
严重迟到继续作为缺勤统计。考勤更正请求只允许 HR 提交目标状态、更正原因以及可选签到时间、
方式、迟到级别和地点；学生 ID、日期、设备及 IP 由路径或后端决定，不能从请求正文覆盖。
补建的缺失记录使用 `hr_correction` 来源；更正已有记录时保留原始来源，并通过更正元数据标记最新
状态。这样既能保留记录产生方式，也不会因 HR 更正学生主动签到记录而释放该设备当天的占用。

`6G` 已为每次成功考勤更正写入 `attendance.record.corrected` 操作日志。日志目标为实际考勤记录，
并关联对应学生，因此可在学生操作记录中查询。日志保存考勤日期、更正原因及更正前后的状态、迟到
级别、签到时间、安排地点、签到方式和更正次数；补建记录的更正前快照为 `null`。设备哈希、请求 IP、
办公室网络匹配结果和附件等敏感信息不会写入操作日志。

`6H` 已完成筛选、分页、排序及查询性能收尾。每日列表和月度汇总均先按日期、负责人、状态、地点和
签到方式执行首段 `$match`，再关联学生及 HR；关键字筛选会转义正则特殊字符。统计、总数和当前页在
同一条 `$facet` 聚合管道中生成，`page` 与 `limit` 只作用于明细分支，不会改变统计口径。全部排序均
包含稳定的 `_id` 次级排序，未打卡记录固定排在有签到时间的记录之后。月度范围统一使用“本月 1 日
（含）至下月 1 日（不含）”，因此十二月可以正确跨年，也不会依赖不存在的“31 日”作为上界。
现有索引分别覆盖普通 HR 的负责人/日期/状态查询、Admin HR 的日期/地点/方式/状态查询以及学生月度
详情查询；schema 测试会锁定这些索引结构。分页偏移、全部排序方式、空结果和跨年月份边界均已有测试。
本地 MongoDB 的只读 `explain("executionStats")` 检查也已完成：Admin 每日查询命中
`attendanceDate_1_assignedWorkLocation_1_checkInMode_1_status_1`，普通 HR 月度查询命中
`ownerHrId_1_attendanceDate_1_status_1`，两条查询路径均使用 `IXSCAN`，未退化为全表 `COLLSCAN`。

`6I` 已新增 Phase 6 HTTP 集成测试。测试会启动真实 Nest 测试应用，并接入与生产入口一致的全局
`/api` 前缀、Cookie 解析、`HrAuthGuard` 和 DTO `ValidationPipe`；覆盖四类 HR 考勤接口的未登录
拦截、普通 HR/Admin HR 身份传递、查询参数类型转换和默认值、非法日期/月及未知字段拒绝、学生
明细路由参数、更正正文去空格、禁止客户端提交设备等后端控制字段，以及 Service 权限异常保持为
HTTP 404。业务 Service 使用隔离的测试替身，因此 HTTP 验收不会改动 MongoDB 数据。

权限验收采用分层覆盖：HTTP 集成测试确认经过签名验证的 HR ID 与角色会传入 Service；`6B` 的 9 项
权限层单元测试确认普通 HR 查询会被强制限制为自己的 `ownerHrId`，并且无法读取或更正其他 HR 的
学生，Admin HR 则可以读取全部或按负责人筛选。每日、月度、详情、更正、操作日志、分页、排序和
索引结构继续由各 Service 与 schema 测试覆盖。最终后端 lint、Nest 构建以及完整 Jest 均通过，当前
共 `51` 个测试套件、`433` 项测试，无失败项。

`6A` 已增加 DTO 白名单和字段校验测试，覆盖日期/月格式、分页范围、筛选枚举、默认排序、文本
去空格、更正原因以及禁止客户端提交后端控制字段。当前共 14 项契约测试通过。

`6B` 已新增统一的 `HrAttendanceAccessService`。普通 HR 的考勤查询会强制附加当前 HR 的
`ownerHrId`，即使请求携带其他负责人 ID 也会被拒绝；Admin HR 可以查询全部记录，或显式传入
`ownerHrId` 筛选某一名负责人。权限层每次从数据库读取 HR 当前角色，不依赖登录 Cookie 中可能
过期的角色信息。列表和汇总使用 `attendance_records.ownerHrId` 快照限制历史考勤范围；学生详情及
后续考勤更正则复用学生模块的当前归属查询，无权限访问和记录不存在统一返回“学生不存在”，避免
暴露其他 HR 的学生信息。权限层已注册并从 `AttendanceModule` 导出，共 9 项单元测试通过。

`6C` 已实现 `GET /api/hr/attendance/daily`。接口会先按北京时间和当前数据库中的 HR 权限执行幂等
缺勤补算，再读取当天考勤。普通 HR 只补算及查询自己负责的学生；Admin HR 默认处理全部学生，传入
`ownerHrId` 时只处理该负责人范围。接口支持学生关键字、负责人、状态、工作地点、线上/线下方式、
分页和排序筛选，并通过同一条 MongoDB 聚合管道返回统计卡片与明细，避免统计和列表使用不同过滤
条件。`checkedIn` 按是否存在 `checkInAt` 计算，因此 10:30 至 11:00 已打卡但最终记为缺勤的严重
迟到记录，会同时计入“有效打卡”和“缺勤”；按时、普通迟到、请假及缺勤则按最终状态统计。空结果
固定返回全零统计和空列表。接口、权限范围、筛选、分页、序列化及统计口径均已有单元测试保护。

`6D` 已实现 `GET /api/hr/attendance/summary`。接口在读取前按历史整月或当前月截至北京时间今天的
范围执行幂等缺勤补算，未来月份不扫描；普通 HR 只处理自己负责的学生，Admin HR 可处理全部或指定
负责人。汇总以学生为单位统计按时与普通迟到构成的总出勤天数、迟到/请假/缺勤日期、线上/线下出勤
天数，以及该月最近一次有效打卡的时间、安排地点、签到方式和实际签到地点。状态日期按升序返回，
没有打卡时 `latestCheckIn` 为 `null`。接口支持关键字、地点、签到方式、负责人、分页，并支持姓名、
总出勤天数和最近打卡时间三种排序；查询范围、统计累加器、响应序列化和空月份均已有单元测试保护。

`6E` 已实现 `GET /api/hr/attendance/students/:studentId?month=YYYY-MM`。接口先使用学生当前归属校验
访问权限，普通 HR 只能读取自己负责的学生，Admin HR 可以读取全部学生；无权限访问和学生不存在
继续使用相同的“学生不存在”响应。权限通过后只补算目标学生指定月份的记录，不扫描其他学生。
响应包含学生姓名、邮箱、手机号、当前负责人、当前工作地点及实习起止日期，并返回与月度汇总一致的
总出勤、迟到/请假/缺勤日期、线上/线下天数和最近一次打卡，以及按日期升序排列的每日明细。严重
迟到继续按缺勤统计，但其实际打卡仍可成为最近一次打卡；无记录月份返回全零汇总和空明细。每日明细
已预留当前更正信息字段，`6F` 写入更正元数据后可直接展示。权限短路、查询范围、汇总口径、空月份、
更正信息序列化和 Controller 参数传递均已有单元测试保护。

`6F` 已实现 `PATCH /api/hr/attendance/students/:studentId/records/:attendanceDate`。普通 HR 只能更正
自己负责学生，Admin HR 可以更正全部学生；更正日期仅允许北京时间今天或过去日期，并且必须位于
学生实习期内、存在当天有效地点安排且属于应出勤工作日。接口支持将记录更正为按时、普通迟到、
请假、普通缺勤或带签到时间的严重迟到缺勤，并校验签到时间、签到方式、迟到级别和地点之间的业务
一致性。数据库仍使用 `{ studentId, attendanceDate }` 唯一索引，既可更新已有记录，也可补建缺失
记录；并发补建由唯一索引兜底。记录保存首次更正前状态、最后更正 HR、时间、原因和累计更正次数。
学生请假批次字段会在人工更正时清除，避免学生随后撤销 HR 更正；已有签到记录的设备和网络凭据则
保留，避免更正释放设备当天名额。自动缺勤补算发现记录已存在时继续跳过，不会覆盖人工结果。

验收完成：统计数量正确，普通 HR 无法访问他人学生记录，四类 HR 考勤 API 的鉴权、校验、权限与
异常响应均有自动化测试保护。

### Phase 7：HR 前端

- `7A`：建立 HR 考勤前端类型、API Client 和统一错误契约。
- `7B`：新增出勤管理导航和页面框架。
- `7C`：开发每日考勤统计和明细页面。
- `7D`：开发月度出勤汇总页面。
- `7E`：开发学生考勤详情页面。
- `7F`：开发考勤更正弹窗，要求填写更正原因并二次确认。
- `7G`：开发分级工作日历和 Admin HR 地区权限页面。
- `7H`：开发办公网络与“共享文档”页面，并验证腾讯文档嵌入和新标签页降级路径。
- `7I`：补齐前端自动化测试、响应式检查并完成 Phase 7 验收。

当前进度：`7A`、`7B`、`7C`、`7D`、`7E`、`7F`、`7G`、`7H`、`7I` 已完成，Phase 7 已通过验收。前端新增独立的 HR 考勤类型契约，覆盖每日统计、月度汇总、学生详情、
每日记录、更正元数据、分页、筛选、排序和更正请求。后端 `Date` 字段经过 HTTP JSON 序列化后，
在前端统一建模为 ISO 字符串，避免页面误用 JavaScript `Date` 类型。

HR 考勤 API Client 已封装以下四类请求：

```text
listHrDailyAttendance
listHrAttendanceSummary
getHrStudentAttendance
correctHrAttendanceRecord
```

列表请求只拼接已定义的筛选字段，学生 ID 与考勤日期路径参数会进行 URL 编码，更正正文只接受
Phase 6 契约允许的状态、原因及可选签到信息。统一错误函数会把 `401` 标记为需要返回 HR 登录页，
并保留 `400`、`403`、`404` 等后端中文业务提示供页面展示。

`7A` 已增加 6 项 API 测试，覆盖每日筛选序列化、空筛选省略、详情路径编码、更正请求、登录过期
和业务错误提示。

`7B` 已在 HR 后台顶部增加“学生管理”和“出勤管理”两个模块入口，当前模块会根据路由自动高亮，
后续学生考勤详情等嵌套路由也会保持“出勤管理”选中。新增以下页面路由：

```text
/hr/attendance          -> 自动跳转到每日出勤
/hr/attendance/daily    -> 每日出勤页面框架
/hr/attendance/summary  -> 出勤汇总页面框架
```

每日出勤和出勤汇总共用统一页面框架、二级视图导航和 HR 登录态保护；未登录访问仍由现有
`useHrSession` 跳回 HR 登录页。

`7B` 新增 4 项组件测试，覆盖两个 HR 模块入口、嵌套考勤路由高亮、每日/汇总视图切换和共享内容
容器。

`7C` 已将 `/hr/attendance/daily` 接入每日考勤接口。页面展示全部学生、已打卡、按时、迟到、请假和
缺勤六项统计，支持按考勤日期、学生关键词、工作地点、签到方式和考勤状态筛选；Admin HR 额外
支持按负责 HR 筛选并查看负责人列，普通 HR 不显示跨 HR 筛选控件。明细表展示学生、状态、北京时间
登记时间、当天安排地点、签到方式和地点、记录来源及人工更正标记；10:30 至 11:00 的签到统一显示为
“严重迟到（缺勤）”。页面同时支持姓名或签到时间排序、20/50/100 条分页、手动刷新、空数据、请求
失败和登录过期处理。

`7C` 新增 3 项组件测试，覆盖普通 HR 每日记录、Admin HR 负责人信息与严重迟到更正记录，以及登录
过期跳转。

`7D` 已将 `/hr/attendance/summary` 接入月度汇总接口。页面默认读取北京时间当前月份，支持按月份、
学生关键词、工作地点和线上/线下签到方式筛选；Admin HR 额外支持按负责 HR 筛选并查看负责人列，
普通 HR 只会看到自己负责学生的汇总。每名学生固定展示总出勤天数、迟到/请假/缺勤天数及具体日期、
线上/线下出勤天数，以及最近一次签到的北京时间、签到方式、安排地点和实际签到地点。学生姓名链接
已指向后续 `7E` 的考勤详情路由，并保留当前查询月份。

月度列表支持按姓名、总出勤天数或最近签到时间排序，支持 20/50/100 人分页、手动刷新、空月份、
筛选无结果、请求失败重试和登录过期跳转。日期列表在表格中使用紧凑的月/日格式展示，同时保留完整
日期作为悬停提示，避免一个月内记录较多时撑高表格。

`7D` 新增 3 项组件测试，覆盖普通 HR 月度累计与日期、Admin HR 负责人筛选，以及登录过期跳转。

`7E` 新增 `/hr/attendance/students/:id` 学生考勤详情路由，并从月度汇总页携带当前月份进入。详情页支持
切换月份和手动刷新，展示负责 HR、当前工作地点、实习起止日期、总出勤天数、迟到/请假/缺勤天数及
对应日期、线上/线下出勤天数和最近一次签到信息。每日明细按日期从早到晚展示状态、北京时间、当天
安排地点、签到方式与地点、记录来源；严重迟到继续按“严重迟到（缺勤）”口径展示，人工更正记录同时
展示更正原因、时间和累计次数。普通 HR 和 Admin HR 的数据范围继续由后端权限控制，前端保留登录过期、
接口错误、加载中和空月份状态。

`7E` 新增 3 项组件测试，覆盖完整详情与更正记录、Admin HR 空月份，以及登录过期跳转。

`7F` 新增可复用的 HR 考勤更正弹窗，并接入每日考勤列表和学生考勤详情。HR 可以将记录更正为按时、
迟到、请假或缺勤；严重迟到作为带实际签到信息的缺勤处理。弹窗会根据目标状态动态要求签到时间、
签到方式和地点，线上安排不会显示线下签到选项。每次更正必须填写 200 字以内原因，并先进入核对页，
只有二次确认后才调用后端接口。保存成功后页面会重新读取统计及明细，并显示 3 秒成功提示；登录过期、
业务校验失败和接口异常均沿用统一错误处理。更正弹窗新增 3 项组件测试，覆盖原因必填、状态联动与二次
确认，以及登录过期跳转；每日列表测试同时确认更正入口可用。当前前端共 12 个测试文件、35 项测试
全部通过；前端 lint、TypeScript 检查和 Next.js 生产构建均已通过。

`7G` 新增 `/hr/attendance/calendar` 分级工作日历和 `/hr/attendance/regions` 地区权限页面。工作日历
按月展示全国假期和地区临时假期，支持连续日期范围新增、单日编辑、软删除、手动刷新和历史日期
二次确认。普通 HR 只能维护数据库中 `managedRegionCodes` 分配的地区，能查看但不能修改全国假期；
Admin HR 可以维护全国与全部地区记录。页面每次加载都会调用
`GET /api/hr/attendance/calendar/access` 读取数据库中的当前角色和地区权限，不依赖登录 Cookie 中可能
过期的权限副本，后端仍会对每次增删改执行二次鉴权。

地区权限页面只对 Admin HR 显示，通过 `GET /api/hr/admin/users` 列出普通 HR，并通过
`PATCH /api/hr/admin/users/:hrUserId/regions` 保存多选地区。清空权限前会明确提示该 HR 将无法维护任何
地区临时假期；普通 HR 即使直接请求页面或接口也会被拒绝。地区权限修改写入操作日志，但不会改变
学生的 `ownerHrId`，因此不会影响学生可见范围。

`7G` 已补充工作日历、地区权限组件和 API Client 自动化测试，同时增加后端当前权限摘要及 Admin
地区分配服务测试。当前前端共 15 个测试文件、42 项测试通过；后端地区权限相关 14 项单元测试通过。

`7H` 新增 `/hr/attendance/networks` 办公网络页面，仅 Admin HR 可以看到导航和调用接口。页面固定展示
系统支持的全部线下工作地点及详细地址，使用标签输入维护一个或多个公网 IP/CIDR，并可单独设置启用
状态、备注和查看最后更新时间。保存调用 `PUT /api/hr/attendance/office-networks/:workLocation`；裸 IP
会由后端规范为 `/32` 或 `/128`，启用但没有网段、非法 IP/CIDR、线上地点和非 Admin 请求均会被
后端拒绝。接口使用 upsert 保存至 `office_networks`，只影响之后的线下签到校验，不修改历史考勤，
并写入 `attendance.office_network.updated` 操作日志。

`7H` 同时新增所有 HR 可访问的 `/hr/shared-document` 页面和顶部“共享文档”入口。页面从
`NEXT_PUBLIC_TENCENT_DOC_URL` 和 `NEXT_PUBLIC_TENCENT_DOC_TITLE` 读取配置，优先使用 iframe 展示，
始终保留“在腾讯文档中打开”按钮。未配置、iframe 加载失败、第三方登录状态失效或腾讯文档安全策略
禁止嵌入时，页面不会代理或复制文档内容，而是显示明确提示并通过新标签页打开原始链接。

`7H` 增加办公网络后端 4 项单元测试，以及办公网络 UI、共享文档、导航和 API Client 前端测试。
当前前端共 17 个测试文件、47 项测试通过。

`7I` 完成 HR 考勤前端最终验收。顶部 HR 模块导航在窄屏中改为容器内横向滚动，导航项不会被压缩
或造成页面级横向溢出；考勤二级导航在手机宽度下使用稳定的两列布局，在较宽屏幕恢复横向排列。
每日明细、月度汇总和学生详情的大表继续只在自身容器内横向滚动，筛选区、分页、弹窗、工作日历、
地区权限和办公网络表单均保留既有响应式断点。统一加载、空状态和错误页面增加 `aria-live`，异步结果
可分别以礼貌提示或即时错误被辅助技术感知。

`7I` 新增响应式布局契约和页面状态可访问性测试。当前前端共 18 个测试文件、49 项测试全部通过；
前端 ESLint、TypeScript 无输出检查和 Next.js 生产构建均通过。本地验收同时确认后端健康检查和测试
HR 登录接口可用。筛选、统计、普通 HR/Admin 权限、导航、空数据、登录过期、人工更正和设置页面均有
自动化覆盖。

验收：筛选、统计、权限、错误状态、键盘焦点和响应式布局通过。

### Phase 8：完整测试和上线准备

建议拆分为：

- `8A`：冻结功能范围，审计并集中校验后端环境变量，整理上线配置交接清单。
- `8B`：建立完全隔离的测试 MongoDB、附件目录和 ownCloud 测试目录。
- `8C`：执行后端单元、集成和端到端测试，覆盖并发唯一索引、权限、时间边界、
  IP/CIDR、地区假期、按需刷新和 Cron 幂等性。
- `8D`：执行前端组件、API Client、路由守卫、响应式布局和生产构建测试。
- `8E`：完成鉴权、Cookie、CORS、HTTPS、代理信任、敏感日志和附件权限安全检查。
- `8F`：配置正式办公室公网 IP、ownCloud、MongoDB 备份与迁移、腾讯文档权限。
- `8G`（已完成）：提供 liveness/readiness、请求追踪、Cron/按需补算观测、
  部署后探针和上线回滚方案。详见
  `PHASE_8G_OBSERVABILITY_ROLLBACK.md`。
- `8H`（技术门禁与 UAT 清单已完成，待正式签字）：由 Admin、普通 HR 和学生按
  UAT 清单验收，签字后发布。

`8A` 已完成：后端通过 `ConfigModule` 在连接数据库前统一校验核心环境变量，
条件校验 local/ownCloud 配置，并在生产环境拒绝 HTTP、local 存储和示例密钥。
配置字段、动态 MongoDB 设置、外部依赖和交接责任统一记录在
`PHASE_8A_RELEASE_CHECKLIST.md`。进入 8B 后，本轮只接受阻断上线的缺陷、安全和
配置修正，不再临时加入新业务功能。

`8A` 自动化验证结果：后端 54 个测试套件、450 项单元/集成测试和 6 项 E2E 测试
通过；前端 18 个测试文件、49 项测试、ESLint、TypeScript 检查和 Next.js 生产
构建通过。正式外部服务和公网 IP 的验收仍在 8F、8H 完成。

`8B` 已完成：E2E 环境在 `AppModule` 导入前强制使用名称以 `_e2e` 结尾的 MongoDB，
本地附件只允许写入系统临时目录下以 `intern-onboarding-e2e-` 开头的目录，测试结束
后自动清理。ownCloud 使用独立 `e2e` 远程根目录和一次性 UUID 子目录执行上传、
下载、内容比对与清理，不接触正常业务附件。配置模板、命令和守卫说明统一记录在
`PHASE_8B_TEST_ENVIRONMENT.md`。

`8C` 已完成测试设计和数据库级补强：在隔离 MongoDB 上直接并发写入，验证学生每日
唯一和设备每日唯一索引；验证设备可跨日期复用、无设备自动记录不被部分唯一索引
误伤、地区假期软删除重建、办公室 CIDR 以及普通 HR/Admin 日历权限。北京时间、
打卡窗口、按需刷新和 Cron 幂等性继续由现有单元/集成测试覆盖。测试矩阵、命令和
最终执行结果记录在 `PHASE_8C_BACKEND_TEST_REPORT.md`。

`8D` 已完成前端完整回归并补齐学生端测试缺口：新增学生考勤 API Client、Portal
路由守卫和登记表访问守卫测试，覆盖 Cookie 请求、参数编码、四阶段业务分流、401
登录过期和表单快照不一致。既有测试继续覆盖学生考勤/请假、HR 每日与汇总、人工
更正、日历、地区、办公网络、导航权限、可访问状态和响应式布局契约。最终 21 个
测试文件、65 项测试、ESLint、TypeScript 无输出检查和 Next.js 生产构建全部通过，
测试矩阵和执行结果记录在 `PHASE_8D_FRONTEND_TEST_REPORT.md`。

`8E` 已完成上线安全加固：HR 和学生 Guard 在 JWT 校验后重新确认数据库身份，
软删除或撤销账号的旧 Cookie 会立即失效；登录接口增加限流，Cookie 统一启用
HttpOnly、生产 Secure、SameSite=Lax 和 High Priority。后端通过 Helmet 设置安全
响应头和生产 HSTS，CORS 只允许精确 `FRONTEND_ORIGIN`，生产环境强制配置受信代理
层数。异常和 ownCloud 日志不再暴露查询参数、Cookie、请求体、storage key 或凭据，
附件下载同时校验学生范围和附件归属。前后端完整依赖审计均为 0 个已知漏洞；测试
矩阵、部署约束和剩余 8F/8H 验收项记录在 `PHASE_8E_SECURITY_REPORT.md`。

`8F` 已完成正式外部服务的可重复执行工具和交接流程：办公室网络配置支持严格模式，
会阻止缺失地点、停用地点、空 CIDR 和内网地址进入正式库；统一预检检查生产环境
变量、HTTPS、ownCloud 路径、MongoDB 数据库名、代理层数、腾讯文档域名和 Database
Tools。MongoDB 备份会生成 SHA-256 与集合计数元数据，恢复验证强制使用
`_restore_verification` 隔离库并在成功后清理；另有正式索引检查和 ownCloud 在线读写
验证命令。模板、执行顺序和发布阻断条件记录在
`PHASE_8F_EXTERNAL_SERVICES_REPORT.md`。正式凭据及尚未提供的办公室公网 IP 不进入
Git，必须由 IT/部署人员在目标环境补齐并完成报告中的验收复选项。

`8H` 已提供根目录一键技术门禁脚本，统一执行补丁格式、后端 ESLint、480 项
单元/集成测试、生产构建，以及前端 ESLint、TypeScript、65 项组件/API 测试和
webpack 生产构建；隔离 MongoDB 的 16 项 E2E 测试也已通过。Admin、普通 HR、
学生和非功能验收场景、证据栏、缺陷规则与签字表记录在
`PHASE_8H_UAT_SIGNOFF.md`。正式办公室 Wi-Fi、正式 ownCloud/MongoDB/腾讯文档和
三类真实用户签字仍是发布门禁，未完成前不得把 8H 标记为正式发布通过。

## 15. 完成标准

满足以下条件后，打卡模块才算完成：

1. 学生只能在有效实习工作日打卡。
2. 学生只能选择后端允许的签到方式，其他时间、地点、设备和 IP 数据由后端
   决定。
3. 学生每日唯一和浏览器设备标识每日唯一在并发情况下仍有效；设备不与学生
   永久绑定，同一设备标识可以在不同日期再次使用。
4. “线上”地点只能线上签到；办公室或研究院地点允许学生选择线上或线下签到。
5. 学生选择线下签到时必须匹配对应办公室公网 IP。
6. 学生可以按月份查看自己的出勤汇总和每日记录。
7. 学生可以登记未来 14 天内的多个有效请假日期。
8. `10:01:00` 前为按时，`10:01:00` 至 `10:30:00` 为普通迟到，
   `10:30:00` 后至 `11:00:00` 可登记但记缺勤，`11:00:00` 后不可登记；
   HR 查询时后端能幂等补算缺勤，开启 Cron 时还会在 `11:01` 主动补算。
9. 普通 HR 只能查看自己的学生，Admin HR 可以查看全部并筛选负责 HR。
10. 每日统计、学生汇总和学生详情数据一致。
11. Admin 可以维护全国和全部地区假期、办公网络及 HR 地区权限；普通 HR
    只能维护负责地区的临时假期。
12. 地区临时假期只影响当天有效工作地点属于对应地区的学生。
13. HR 可以通过“共享文档”页面访问配置的腾讯文档；禁止嵌入时可在新标签
    页打开。
14. 核心时间边界、权限、地区、IP、设备和并发测试通过。
15. Phase 8H 技术门禁通过，正式外部服务完成核验，并由 Admin、普通 HR、学生、
    技术和部署负责人完成 UAT 签字。
