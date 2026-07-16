# 实习生入职登记系统 Plan

## 1. 项目目标

建设一个用于实习生入职资料收集、HR 入职安排、附件管理和未来打卡管理的系统。

新的核心流程：

1. HR 确认学生接受 offer。
2. HR 在后台预先录入或批量导入学生名单，至少包含姓名和邮箱。
3. HR 在学生填表前，提前安排工作地点和入职开始日期时间，可单个安排，也可批量安排；安排后学生入职状态变为“待入职”。
4. 学生访问统一登记网址。
5. 学生输入姓名和邮箱登录。
6. 系统校验该学生是否存在于 HR 预录入名单中。
7. 校验通过后，系统提示学生“登记表只能提交一次，请确认信息无误后提交”。
8. 学生填写入职登记表、上传附件，并填写入职结束日期时间。
9. 学生提交登记表后，学生端不可再次修改或重复提交。
10. HR 在后台查看学生信息和下载附件。
11. 如有必要，HR 可在后台修改学生登记信息。
12. HR 可在后台更改学生工作地点和入职结束日期时间。
13. 学生提交登记表后，表单状态变为“已提交”，入职状态保持“待入职”。
14. 到入职开始日期当天，如果学生仍在数据库中，系统默认将其状态变为“已入职”。
15. 如果学生实际未入职或 offer 有变动，HR 需要在入职日期前删除或移除该学生记录。
16. 后续在本项目中增加打卡功能，方便 HR 查看学生出勤情况。

本项目属于全栈项目，包含：

- 学生统一登录页
- 学生登记表页面
- HR 后台页面
- 后端 API
- MongoDB 数据库
- 本地文件/公司阿里云 OSS 文件存储
- 登录认证与权限控制
- 后续打卡模块

## 2. 关键设计变化

### 2.1 不再采用一人一个 token 链接作为主方案

```text
所有学生访问同一个登记网址
学生用姓名 + 邮箱登录
登录成功后填写自己的登记表
```

示例网址：

```text
https://your-company.com/student/login
```

或：

```text
https://your-company.com/register
```

### 2.2 姓名 + 邮箱登录的前提

为了避免陌生人随意填写，HR 需要先在后台建立“学生名单”。

学生登录时，系统不是直接创建新学生，而是先匹配 HR 已录入的学生记录。

登录逻辑：

```text
学生输入姓名 + 邮箱
后端查询 students/candidates 集合
找到匹配记录且 HR 已安排工作地点和入职开始时间 -> 允许进入登记表
找到匹配记录但 HR 尚未完成安排 -> 提示“入职安排尚未完成，请联系 HR”
找不到匹配记录 -> 提示联系 HR
```

MVP 阶段可以先使用姓名 + 邮箱。

正式环境更建议增加：

- 邮箱验证码
- HR 预设的临时密码
- 企业统一认证

原因是姓名和邮箱本身不是强认证方式，只适合内部范围较小、风险可控的第一版。

### 2.3 学生只能提交一次

学生端登记表是一次性提交。

规则：

- 学生第一次进入时可以填写登记表。
- 提交前页面必须明确提示“登记表只能提交一次，请确认信息无误后提交”。
- 提交成功后，学生再次登录只能看到提交成功提示或只读信息。
- 学生提交后不能在学生端修改资料、删除附件或重新上传附件。
- 如果提交后发现错误，由 HR 在后台修改学生登记信息。

这样设计可以减少版本混乱，避免学生反复修改导致 HR 后台看到的数据不稳定。

## 3. 角色与权限

### 3.1 学生

学生通过统一入口登录。

学生可做的事：

- 输入姓名和邮箱登录
- 查看 HR 已安排的工作地点和入职开始日期时间
- 填写个人信息
- 新增/删除教育经历
- 新增/删除家庭成员
- 新增/删除校外实习或兼职经历
- 填写入职结束日期时间
- 填写补充信息
- 上传简历
- 上传身份证件或其他附件
- 提交一次登记表
- 提交后不能再次修改登记表或附件

### 3.2 HR

HR 需要登录后台。

测试阶段可以使用极简登录：

- 固定密码
- 环境变量密码
- 简单隐藏入口

正式阶段必须使用账号密码或公司统一认证。

HR 可做的事：

- 录入单个学生
- 批量导入学生名单
- 查看学生列表
- 搜索学生
- 按状态筛选学生
- 查看学生详情
- 下载学生附件
- 单个安排工作地点和入职开始日期时间
- 批量安排工作地点和入职开始日期时间
- 修改学生登记信息
- 修改学生工作地点
- 修改学生入职结束日期时间
- 删除未入职或发生变动的学生
- 后续查看打卡情况

## 4. MVP 功能范围

第一版先实现资料收集和 HR 安排，不做复杂 OA。

### 4.1 学生端

页面：

- `/student/login`
- `/student/form`
- `/student/submitted`

功能：

- 姓名 + 邮箱登录
- 校验学生是否存在于 HR 预录入名单中
- 展示实习生工作登记表
- 填写个人情况
- 填写教育情况
- 填写家庭关系
- 填写校外实习或兼职经历
- 填写补充信息
- 上传附件
- 提交表单
- 提交前提示“登记表只能提交一次”
- 提交后学生端禁止修改

### 4.2 HR 后台

页面：

- `/hr/login`
- `/hr/students`
- `/hr/students/import`
- `/hr/students/:id`
- `/hr/students/batch-arrange`

第一版功能：

- HR 登录
- 单个新增学生
- 批量导入学生名单
- 学生列表
- 学生详情
- 附件下载
- 单个安排工作地点和入职开始日期时间
- 批量安排工作地点和入职开始日期时间
- 修改学生登记信息
- 修改工作地点
- 修改入职结束日期时间
- 删除未入职学生

后续功能：

- 打卡管理
- 出勤统计
- 异常打卡提醒
- 导出 Excel

### 4.3 后端

API：

- 学生姓名邮箱登录
- 获取当前学生登记表
- 提交学生登记表
- 上传附件
- 删除附件
- HR 登录
- HR 新增学生
- HR 批量导入学生
- HR 获取学生列表
- HR 获取学生详情
- HR 下载附件
- HR 单个安排入职信息
- HR 批量安排入职信息
- HR 修改学生登记信息
- HR 删除学生
- 系统自动更新入职状态

### 4.4 数据库

MongoDB 存结构化数据和附件元信息。

附件文件本体：

- 开发/测试阶段：存在本地 `uploads/` 目录
- 上线阶段：迁移到公司阿里云 OSS

## 5. 页面规划

### 5.1 学生登录页

字段：

- 姓名
- 邮箱

登录结果：

- 匹配到学生记录，且 HR 已安排工作地点和入职开始时间：进入登记表。
- 匹配到学生记录，但 HR 尚未完成安排：提示联系 HR。
- 未匹配到学生记录：提示“未找到登记资格，请联系 HR”。
- 学生已提交登记表：展示已提交提示，不能再次修改。
- 学生记录已删除：提示联系 HR。

### 5.2 学生登记页

表单区块：

1. HR 已安排信息
2. 基本信息
3. 教育情况
4. 家庭关系
5. 校外实习或兼职经历
6. 补充信息
7. 附件上传
8. 确认与提交

HR 已安排信息：

- 工作地点
- 入职开始日期时间

这些字段由 HR 在学生填表前安排，学生只读查看。

基本信息字段参考：

- 申请职位
- 填表日期
- 姓名
- 性别
- 出生日期
- 身份证号
- 户籍
- 婚否
- 在读学校
- 专业
- 学历
- 政治面貌
- 电子邮箱
- 联系电话
- 投递渠道
- 家庭地址
- 家庭电话
- 入职结束日期时间

教育情况字段：

- 起始年
- 终止年
- 学校
- 专业
- 班主任
- 联系电话

家庭关系字段：

- 关系
- 姓名
- 工作单位
- 联系电话

校外实习或兼职经历字段：

- 起始年
- 终止年
- 实习公司
- 证明人
- 联系电话

补充信息字段：

- 紧急联系人姓名
- 紧急联系人电话
- 紧急联系人关系
- 是否有身份证复印件和服务协议
- 服务协议签署时间
- 其他需要补充说明的信息
- 申请人签字
- 签字日期

附件字段：

- 简历
- 身份证件
- 其他附件

### 5.3 HR 学生列表页

列表字段：

- 姓名
- 邮箱
- 手机号
- 申请职位
- 学校
- 专业
- 工作地点
- 入职开始时间
- 入职结束时间
- 表单提交状态
- 入职状态
- 最后更新时间
- 操作

筛选与搜索：

- 姓名
- 邮箱
- 手机号
- 学校
- 职位
- 工作地点
- 表单提交状态
- 入职状态
- 入职开始日期

### 5.4 HR 学生详情页

详情区块：

- 基本信息
- 教育情况
- 家庭关系
- 校外实习或兼职经历
- 补充信息
- 附件列表
- HR 入职安排信息
- 状态历史

HR 操作：

- 下载附件
- 修改学生登记信息
- 修改工作地点
- 修改入职结束日期时间
- 删除学生
- 返回列表

### 5.5 HR 批量安排页

用途：

HR 批量给一组学生安排工作地点和入职开始日期时间。

可选交互：

- 勾选多个学生
- 选择统一工作地点
- 选择统一入职开始日期时间
- 批量确认

批量安排后：

- 学生具备登录填写登记表的资格
- 学生列表显示“待入职”
- 学生登记页展示 HR 已安排的工作地点和入职开始时间

## 6. 状态设计

### 6.1 表单状态

不单独设计 `formStatus` 字段。

学生是否已提交登记表，通过 `submittedAt` 或登记表关键字段是否已有内容判断。

更改为：

- `submittedAt` 为空：学生尚未提交，可以填写。
- `submittedAt` 有值：学生已提交，学生端不可再次修改。

如果后端实现时不使用 `submittedAt`，也可以通过登记表字段内容判断：未填写的学生允许填写，已经提交过内容的学生不允许再次写入。

### 6.2 入职状态

入职状态描述学生从 offer 到入职的业务阶段。

```text
candidate -> pending_onboarding -> onboarded
```

含义：

- `candidate`：HR 已确认学生接受 offer，并录入系统，但尚未完成工作地点和入职开始时间安排。
- `pending_onboarding`：HR 已安排工作地点和入职开始日期时间，学生待入职；学生可以登录并一次性提交登记表。
- `onboarded`：入职开始日期已到，系统默认认为学生已入职。

如果学生未入职、offer 取消、延期或有其他变动：

- HR 在入职开始日期前删除或移除学生。
- 删除后该学生无法再用姓名邮箱登录。

### 6.3 是否允许学生修改

学生是否可以修改登记表，主要由表单提交状态决定。

允许修改：

```text
submittedAt 为空
```

禁止修改：

```text
submittedAt 有值
```

学生提交后再次登录时可以：

- 看到只读资料页；或
- 直接看到“登记表已提交，不能重复提交或修改”的提示。

MVP 可以先做提示页，不做只读详情页。

HR 后台不受学生端锁定限制。学生提交后，如果信息需要更正，由 HR 在后台修改登记信息。

## 7. 自动入职状态更新

### 7.1 业务规则

每天系统检查所有仍在数据库中的学生：

```text
如果 onboardingStartAt <= 当前时间
且 onboardingStatus = pending_onboarding
则自动改为 onboarded
```

也就是说，到入职开始日期当天，如果学生仍然存在于数据库中，系统默认学生已入职。

如果学生实际未入职：

- HR 应在入职开始日期前删除学生记录。
- 或后续增加“未入职/取消入职”状态。

### 7.2 实现方式

MVP 可选两种方式：

方式 A：查询时动态计算

```text
每次 HR 打开列表时，后端检查日期并更新状态
```

优点：

- 简单。
- 不需要额外定时任务。

缺点：

- 状态更新依赖有人访问系统。

方式 B：定时任务

```text
每天凌晨运行 cron job
扫描 pending_onboarding 学生
把达到入职时间的学生改为 onboarded
```

优点：

- 更接近正式系统。
- 状态更新更稳定。

缺点：

- 需要部署环境支持定时任务。

第一版建议先用方式 A，后续根据公司部署环境改成定时任务。

## 8. 数据模型设计

### 8.1 students 集合

```js
{
  _id: ObjectId,

  name: String,
  email: String,
  phone: String,

  onboardingStatus: "candidate" | "pending_onboarding" | "onboarded",

  basicInfo: {
    position: String,
    formDate: Date,
    gender: String,
    birthDate: Date,
    idNumber: String,
    householdRegistration: String,
    maritalStatus: String,
    currentSchool: String,
    major: String,
    degree: String,
    politicalStatus: String,
    sourceChannel: String,
    homeAddress: String,
    homePhone: String
  },

  educationExperiences: [
    {
      startYear: Number,
      endYear: Number,
      school: String,
      major: String,
      advisor: String,
      phone: String
    }
  ],

  familyMembers: [
    {
      relation: String,
      name: String,
      employer: String,
      phone: String
    }
  ],

  internshipExperiences: [
    {
      startYear: Number,
      endYear: Number,
      company: String,
      referenceName: String,
      phone: String
    }
  ],

  emergencyContactName: String,
  emergencyContactPhone: String,
  emergencyContactRelation: String,
  hasIdCopyAndAgreement: Boolean,
  agreementSignedAt: Date,
  notes: String,
  applicantSignature: String,
  applicantSignedAt: Date,

  attachments: [
    {
      type: "resume" | "id_card" | "other",
      originalName: String,
      storageKey: String
    }
  ],

  onboardingStartAt: Date,
  onboardingEndAt: Date,
  workLocation: String,

  isDeleted: Boolean,
  deletedAt: Date,

  submittedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

字段说明：

- `name`、`email`、`phone` 放在学生记录顶层，方便登录匹配、列表筛选和建立索引。
- `onboardingStartAt`：HR 在学生填表前安排的入职开始时间。
- `workLocation`：HR 在学生填表前安排的工作地点，后续 HR 也可以修改。
- `onboardingEndAt`：学生填表时填写的入职结束时间，后续 HR 也可以修改。
- 补充信息字段不单独做 `supplementaryInfo` 对象，直接作为登记表字段存储。
- 补充信息字段是否必填由前端表单和后端校验决定；MVP 阶段建议除紧急联系人外，其余字段先按可选处理。
- 附件元信息只保存 `type`、`originalName`、`storageKey`。

这样可以减少对象嵌套和重复字段，后续展示时直接读取最终值。

### 8.2 学生唯一识别设计

本项目不额外设计 `studentCode`。

学生识别方式：

- `_id`：MongoDB 自动生成的内部主键，给程序和数据库关联使用。
- `name + email`：业务上的唯一匹配条件，用于学生登录和防止重复录入。
- `phone`：辅助搜索和人工核对字段，也可以按 mentor 建议作为备选筛选条件。

数据库唯一索引建议：

```js
{
  name: 1,
  email: 1
}
```

如果 HR 希望使用手机号辅助去重，也可以增加普通索引：

```js
{
  phone: 1;
}
```

数据库建议：

- `name + email` 建唯一联合索引。
- `email` 建普通索引，方便按邮箱搜索。
- `phone` 建普通索引，方便按手机号搜索。
- `basicInfo.idNumber` 可以加密或脱敏存储。
- `deletedAt` 建索引，方便过滤已删除学生。

### 8.3 hr_users 集合

```js
{
  _id: ObjectId,

  email: String,
  passwordHash: String,
  name: String,
  role: "admin" | "hr",

  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 8.4 attendance_records 集合（未来打卡）

后续增加打卡功能时可新增集合：

```js
{
  _id: ObjectId,

  studentId: ObjectId,

  checkInAt: Date,
  checkOutAt: Date,

  workLocation: String,
  checkInMethod: "web" | "mobile" | "qr_code" | "manual",

  status: "normal" | "late" | "missing" | "manual_adjusted",

  note: String,

  createdAt: Date,
  updatedAt: Date
}
```

第一版不做打卡，只预留扩展方向。

## 9. 文件存储设计

### 9.1 测试阶段：本地存储

本地目录：

```text
uploads/
  students/
    {studentId}/
      resume/
      id-card/
      other/
```

MongoDB 中只保存：

- 文件原始名
- 附件类型
- storageKey

示例：

```js
{
  type: "resume",
  originalName: "resume.pdf",
  storageKey: "students/student001/resume/resume-20260708.pdf"
}
```

### 9.2 上线阶段：公司阿里云 OSS

后期迁移到公司阿里云 OSS 时，业务层不变，只替换文件存储实现。

推荐抽象：

```text
FileStorage
  upload(file) -> storageKey
  download(storageKey) -> stream
  delete(storageKey)
  getSignedUrl(storageKey)
```

开发环境使用 `LocalStorage`。

生产环境使用 `AliyunOssStorage`。

## 10. API 规划

### 10.1 学生端 API

```text
POST   /api/student/login
GET    /api/student/me
GET    /api/student/form
POST   /api/student/form/submit
POST   /api/student/attachments
DELETE /api/student/attachments/:attachmentId
POST   /api/student/logout
```

说明：

- `POST /api/student/login`：学生输入姓名和邮箱登录。
- `GET /api/student/me`：获取当前学生和是否允许编辑。
- `GET /api/student/form`：获取登记表内容、HR 已安排地点、入职开始时间。
- `POST /api/student/form/submit`：一次性提交登记表，包含学生填写的入职结束时间，提交后写入 `submittedAt`。
- `POST /api/student/attachments`：提交前上传附件。
- `DELETE /api/student/attachments/:attachmentId`：提交前删除附件。
- `POST /api/student/logout`：退出登录。

后端必须在提交表单、上传附件、删除附件前判断 `submittedAt` 或已提交内容。如果学生已提交，学生端接口必须拒绝修改。

### 10.2 HR API

```text
POST   /api/hr/login
POST   /api/hr/logout
GET    /api/hr/me

POST   /api/hr/students
POST   /api/hr/students/import
GET    /api/hr/students
GET    /api/hr/students/:id
PATCH  /api/hr/students/:id/onboarding
PATCH  /api/hr/students/batch-arrangement
PATCH  /api/hr/students/:id/profile
DELETE /api/hr/students/:id

GET    /api/hr/students/:id/attachments/:attachmentId/download
```

说明：

- `POST /api/hr/students`：HR 新增单个学生。
- `POST /api/hr/students/import`：HR 批量导入学生名单。
- `PATCH /api/hr/students/:id/onboarding`：HR 修改单个学生的工作地点、入职开始日期、入职结束日期。
- `PATCH /api/hr/students/batch-arrangement`：批量安排工作地点和入职开始日期。
- `PATCH /api/hr/students/:id/profile`：HR 修改学生登记信息。
- `DELETE /api/hr/students/:id`：删除未入职或发生变动的学生。

### 10.3 系统任务 API / Job

```text
POST /api/system/sync-onboarding-status
```

或部署为内部定时任务。

作用：

- 查找达到入职时间的 `pending_onboarding` 学生。
- 自动改为 `onboarded`。

## 11. 全栈技术栈

推荐方案：

```text
Frontend: Next.js + React + TypeScript
UI: Tailwind CSS
Backend: NestJS + TypeScript
Runtime: Node.js
Database: MongoDB Atlas / 公司 MongoDB
ODM: Mongoose
Validation: class-validator 或 Zod
File Upload: Multer
Local File Storage: uploads/ directory
Future File Storage: 公司阿里云 OSS
Auth: Cookie session 或 JWT
Password Hash: bcrypt
```

### 11.1 Next.js 和 NestJS 分工

```text
Next.js:
- 学生登录页
- 学生登记表页
- HR 后台页面
- 页面路由
- 前端交互

NestJS:
- 学生登录 API
- 登记表 API
- HR 后台 API
- MongoDB 连接
- 文件上传/下载
- 权限校验
- 自动状态更新任务
- 未来打卡 API
```

### 11.2 MVP 项目结构示例

```text
frontend/
  app/
    student/login
    student/form
    hr/login
    hr/students
    hr/students/[id]
  components/
  lib/

backend/
  src/
    modules/
      student/
      hr/
      file/
      onboarding/
      attendance/
    common/
    database/
```

## 12. 安全设计

因为系统包含身份证号、联系方式、家庭成员、证件附件，所以安全不是后期才做的功能。

必须考虑：

- 全站 HTTPS
- HR 后台登录
- HR 接口鉴权
- 学生登录态管理
- 学生只能访问自己的登记表
- 学生提交后不能再次修改表单或附件
- HR 修改学生登记信息至少更新 `updatedAt`，并使用 NestJS Logger 记录关键操作
- 附件下载鉴权
- 文件类型限制
- 文件大小限制
- 防止任意文件路径读取
- 防止重复提交冲突
- 姓名邮箱登录需要限流，防止撞库或枚举
- 生产环境建议增加邮箱验证码或其他验证方式
- 身份证号默认脱敏展示
- 唯一识别不使用身份证号；手机号只作为辅助搜索或人工核对字段
- 生产环境不公开附件真实地址
- MongoDB 连接串放环境变量
- HR 密码只存 hash，不存明文

建议文件限制：

- 简历：PDF、DOC、DOCX
- 身份证件：PDF、JPG、PNG
- 单文件大小：10 MB 或 20 MB
- 单个学生总附件大小：50 MB

## 13. 删除策略

用户需求中提到：如果学生未入职，需要 HR 把未入职学生删除。

### 13.1 学生记录：软删除

学生记录不立即物理删除，而是设置：

```js
isDeleted: Boolean;
deletedAt: Date;
```

效果：

- 学生无法再登录。
- HR 默认列表不显示。
- 如果误删，可以恢复。

建议所有主要集合复用基础字段：

```js
{
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date,
  isDeleted: Boolean
}
```

### 13.2 嵌套数组内容：直接删除

学生记录里的嵌套数组内容不需要单独做软删除。

例如：

- `attachments`
- `educationExperiences`
- `familyMembers`
- `internshipExperiences`

这些内容如果需要删除，直接从数组中移除即可。

原因：

- 这些内容都依附于一条学生记录。
- 当前项目不需要对每个附件或每段经历单独恢复。
- 如果对数组里的每一项都加 `isDeleted/deletedAt`，schema 会变复杂，查询和展示也会更麻烦。

附件删除时：

- 从 `attachments` 数组中删除对应项。
- 同步删除本地文件或 OSS object。
- 通过 NestJS Logger 记录删除动作。

### 13.3 操作日志

需要记录关键操作日志。

MVP 阶段可以先使用 NestJS 自带 `Logger` 组件记录到服务日志。

建议记录：

- HR 删除学生记录。
- HR 修改学生登记信息。
- HR 修改工作地点、入职开始时间、入职结束时间。
- 学生提交登记表。
- 学生上传或删除附件。

如果后续需要在 HR 后台查看操作历史，再单独设计 `operation_logs` 集合。

## 14. 未来打卡模块

打卡功能不是第一版 MVP，但要在架构上预留。

未来学生入职后可使用：

- 打卡入口
- 上班打卡
- 下班打卡
- 查看自己的打卡记录

HR 可使用：

- 查看每日打卡情况
- 按学生筛选打卡记录
- 按工作地点筛选打卡记录
- 查看迟到、缺卡、异常记录
- 导出打卡统计

未来可能的页面：

- `/student/attendance`
- `/hr/attendance`
- `/hr/attendance/:studentId`

未来可能的 API：

```text
POST /api/student/attendance/check-in
POST /api/student/attendance/check-out
GET  /api/student/attendance

GET  /api/hr/attendance
GET  /api/hr/students/:id/attendance
```

## 15. 实施阶段

### Phase 1：字段和流程确认

目标：

- 确认统一学生登录方式
- 确认 HR 预录入学生字段
- 确认 HR 填表前安排的字段，包括工作地点和入职开始时间
- 确认登记表字段
- 确认入职状态流转
- 确认学生提交后不可修改的提示文案

产出：

- 表单字段清单
- 状态流转图
- 数据模型
- 页面原型

### Phase 2：MVP 开发

目标：

- HR 可录入或批量导入学生
- HR 可提前安排工作地点和入职开始时间
- 学生可用姓名邮箱登录
- 学生可填写并一次性提交登记表
- 附件可上传到本地
- HR 可查看学生信息
- HR 可下载附件
- HR 可修改学生登记信息
- HR 可修改工作地点和入职结束时间
- 学生提交后不能修改资料

产出：

- 学生登录页
- 学生登记页
- HR 登录页
- HR 学生列表页
- HR 学生详情页
- HR 批量安排功能
- HR 修改学生资料功能
- 本地文件上传与下载

### Phase 3：状态自动化和安全增强

目标：

- 自动将到期学生状态改为已入职
- 姓名邮箱登录限流
- 字段校验
- 附件限制
- 身份证脱敏
- 学生重复提交拦截
- NestJS Logger 操作日志
- 删除学生流程

产出：

- 自动状态更新逻辑
- 更稳定的业务流程
- 更安全的数据访问

### Phase 4：上线准备

目标：

- MongoDB 配置
- 公司阿里云 OSS 文件存储
- HTTPS
- 环境变量
- 对接公司的部署环境
- 数据备份策略

产出：

- 可线上使用的版本

### Phase 5：打卡模块

目标：

- 学生入职后可打卡
- HR 可查看打卡情况
- HR 可筛选和导出打卡记录

产出：

- 学生打卡页
- HR 打卡管理页
- 打卡数据模型
- 打卡 API

## 16. 当前需要确认的问题

建议下一步确认：

1. HR 预录入学生时，除了姓名和邮箱，是否还要录入职位、学校、手机号。
2. 学生姓名和邮箱是否足够作为第一版登录方式，是否需要加邮箱验证码。
3. 学生提交后是完全不能访问表格，还是可以只读查看。
4. HR 后台是否需要查看或恢复已软删除的学生。
5. HR 批量安排时是否通常是同一地点同一开始日期，还是需要 Excel 导入每个人不同安排。
6. 学生填写的入职结束时间是否需要格式限制，例如只能选择日期，还是需要精确到小时。
7. 操作日志需要记录哪些动作，是否只用 NestJS Logger，还是后续需要 HR 后台查看日志。
8. 打卡功能未来是否需要定位、Wi-Fi、二维码或仅网页按钮。
