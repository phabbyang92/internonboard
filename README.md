# internonboard — 学生入职登记系统

学生入职登记系统是一个基于 Next.js、NestJS 和 MongoDB 的全栈项目，用于完成学生名单预录入、HR 入职安排、学生信息登记和附件管理。

系统的目标流程是：HR 登录后台并预先录入学生，设置工作地点和入职开始日期；学生通过统一入口使用姓名和邮箱登录，填写并一次性提交登记表；HR 在后台查看学生信息并下载附件。

当前 MVP 已完成前后端 API 集成。学生端和 HR 后台均可在浏览器中使用；`prototype/` 保留早期用于需求讨论的静态页面，不参与正式系统运行。

## 已实现功能

当前版本已完成可供 HR 和学生使用的前后端 MVP。HR 可以登录后台、连续录入学生、设置或批量设置入职安排、搜索筛选和排序学生、查看详情、修改登记资料、管理附件，以及维护可修改和撤销的工作地点时间线。普通 HR 仅能管理自己录入的学生，管理员可以查看全部学生并按录入 HR 筛选。

学生可以通过姓名和邮箱登录，填写包含个人信息、教育经历、家庭成员、实习经历和补充信息的登记表，上传个人简历及身份证件正反面，并一次性提交。系统使用 JWT Cookie 鉴权、MongoDB 操作日志和本地文件存储，并通过 NestJS Cron 自动更新待入职、已入职和已离职状态。

当前尚未实现打卡模块和阿里云 OSS 实现。

## 项目结构

```text
internonboard/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── filters/              # 统一异常处理
│   │   │   └── schemas/              # 基础 Schema
│   │   ├── database/                 # MongoDB 连接
│   │   ├── modules/
│   │   │   ├── auth/                 # HR/学生登录、JWT、Cookie、Guard
│   │   │   ├── hr/                   # HR 学生管理接口
│   │   │   ├── student/              # 学生模型、DTO 和业务逻辑
│   │   │   ├── student-form/         # 学生登记表和附件接口
│   │   │   ├── file/                 # 本地文件存储抽象和文件校验
│   │   │   ├── operation-log/        # 持久化操作日志
│   │   │   ├── work-location/        # 工作地点有效期历史
│   │   │   └── onboarding/           # 入职状态定时更新
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── scripts/                      # HR 账号管理和旧数据迁移脚本
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/                       # 前端静态资源
│   ├── src/app/                      # Next.js App Router 页面
│   │   ├── hr/                       # HR 登录、列表和详情页
│   │   └── student/                  # 学生登录、登记和提交成功页
│   ├── src/components/               # HR 与学生业务组件
│   ├── src/hooks/                    # 登录态和表单访问控制
│   ├── src/lib/                      # API 请求、日期和表单转换
│   ├── src/types/                    # 前端数据类型
│   └── package.json
├── prototype/
│   ├── index.html                    # 早期交互原型入口
│   └── *.html                        # 学生端和 HR 端静态原型
├── PROJECT_PLAN.md                   # 需求、流程和数据设计
└── README.md
```

## 项目启动流程

### 前置依赖

| 依赖        | 用途                   | 默认配置                                      |
| ----------- | ---------------------- | --------------------------------------------- |
| Node.js 20+ | 前后端运行环境         | -                                             |
| npm         | 依赖管理               | -                                             |
| MongoDB     | 学生和 HR 数据         | `mongodb://127.0.0.1:27017/intern_onboarding` |
| mongosh     | 本地数据库初始化和检查 | -                                             |

### 1. 安装后端依赖

```bash
cd internonboard/backend
npm install
```

### 2. 配置后端环境变量

```bash
cp .env.example .env
openssl rand -base64 48
```

将生成的随机字符串填写到 `backend/.env` 的 `JWT_SECRET`：

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/intern_onboarding
JWT_SECRET=your-local-random-secret
```

### 3. 启动 MongoDB

确保 MongoDB 正在 `127.0.0.1:27017` 运行。如果使用其他 MongoDB 地址，修改 `.env` 中的 `MONGODB_URI`。

### 4. 创建本地 HR 测试账号

在 `backend` 目录运行账号创建脚本：

```bash
npm run create:hr -- \
  --email hr@example.com \
  --password 'TestPass123!' \
  --name '测试 HR' \
  --role admin
```

普通 HR 的 `role` 默认为 `hr`，因此可以省略：

```bash
npm run create:hr -- \
  --email hr1@example.com \
  --password 666666 \
  --name '上海 HR'
```

也可以使用环境变量传递密码，避免密码留在 shell 历史中：

```bash
HR_PASSWORD=666666 npm run create:hr -- \
  --email hr2@example.com \
  --name '北京 HR'
```

`role: "admin"` 是总 HR，可查看全部学生；地区或普通 HR 使用 `role: "hr"`，
只能查看和管理自己新增的学生。
脚本会检查邮箱和密码、使用 bcrypt 保存密码哈希，并拒绝重复邮箱。

### 5. 回填旧学生负责人

如果数据库中已有本功能上线前创建的学生，启动新版后端前执行：

```bash
cd internonboard/backend
DEFAULT_STUDENT_OWNER_EMAIL=hr@example.com npm run migrate:student-owners
```

脚本优先根据最早的学生创建日志确定负责人；没有创建日志的旧记录使用
`DEFAULT_STUDENT_OWNER_EMAIL` 指定的 HR。脚本只处理缺少 `ownerHrId` 的学生，
不会覆盖已有负责人，可安全重复执行。

旧学生已有当前地点和实习开始日期、但没有地点历史时，可执行：

```bash
npm run migrate:work-location-history
```

脚本会把当前地点和实习开始日期写成第一段地点历史，并清理旧版专用的
`onlineOnboardingStartAt` 字段。已有地点历史的学生不会被重复处理，可安全重复执行。

### 6. 启动后端

```bash
npm run start:dev
```

后端默认地址：

```text
http://localhost:3001/api
```

健康检查：

```bash
curl http://localhost:3001/api/health
```

### 7. 配置并启动前端

新建一个终端：

```bash
cd internonboard/frontend
npm install
cp .env.example .env.local
npm run dev
```

`frontend/.env.local` 默认内容：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

前端默认地址：

```text
http://localhost:3000
```

可访问的主要页面：

```text
http://localhost:3000/student/login
http://localhost:3000/hr/login
```

### 8. 运行检查和测试

```bash
cd internonboard/backend

# 单元测试
npm test

# 单元测试覆盖率
npm run test:cov

# HTTP 端到端测试
npm run test:e2e

# 后端代码检查和生产构建
npm run lint
npm run build
```

```bash
cd internonboard/frontend

# 前端代码检查和生产构建
npm run lint
npm run build
```

端到端测试默认连接独立数据库
`mongodb://127.0.0.1:27017/intern_onboarding_e2e`，并会在每个测试前后清空该测试数据库的数据，不会修改开发数据库 `intern_onboarding`。

如需使用其他测试数据库，可单独设置 `E2E_MONGODB_URI`。为了防止误删数据，数据库名称必须以 `_e2e` 结尾：

```bash
E2E_MONGODB_URI=mongodb://127.0.0.1:27017/company_onboarding_e2e \
  npm run test:e2e
```

## API 接口

所有后端接口统一使用 `/api` 前缀。

### 基础接口

| Method | Path          | 说明             |
| ------ | ------------- | ---------------- |
| `GET`  | `/api/health` | 检查后端运行状态 |

### HR 登录

| Method | Path             | 说明                         |
| ------ | ---------------- | ---------------------------- |
| `POST` | `/api/hr/login`  | HR 邮箱密码登录并设置 Cookie |
| `POST` | `/api/hr/logout` | 清除 HR 登录 Cookie          |
| `GET`  | `/api/hr/me`     | 获取当前登录 HR 信息         |
| `GET`  | `/api/hr/users`  | 管理员获取 HR 账号列表       |

登录请求体：

```json
{
  "email": "hr@example.com",
  "password": "TestPass123!"
}
```

### HR 学生管理

以下接口由 `HrAuthGuard` 保护，需要携带 HR 登录 Cookie。

普通 HR 的列表、详情、修改、安排、附件和日志接口都会自动限制为其
`ownerHrId`；管理员不受该限制。越权访问返回 `404`，避免泄露其他 HR
是否拥有某名学生。

| Method   | Path                                         | 说明                   |
| -------- | -------------------------------------------- | ---------------------- |
| `POST`   | `/api/hr/students`                           | 新增单个学生           |
| `GET`    | `/api/hr/students`                           | 获取学生列表           |
| `GET`    | `/api/hr/students/:id`                       | 获取学生完整详情       |
| `GET`    | `/api/hr/students/:id/work-location-history` | 获取工作地点历史       |
| `POST`   | `/api/hr/students/:id/work-location-assignments` | 新增带生效日期的地点变更 |
| `PATCH`  | `/api/hr/students/:id/work-location-assignments/:assignmentId` | 修改一段工作地点安排 |
| `DELETE` | `/api/hr/students/:id/work-location-assignments/:assignmentId` | 撤销一段工作地点安排 |
| `GET`    | `/api/hr/students/:id/operation-logs`        | 分页获取操作日志       |
| `PATCH`  | `/api/hr/students/:id/profile`               | 修改学生登记信息       |
| `PATCH`  | `/api/hr/students/:id/arrangement`           | 设置单个学生的入职安排 |
| `PATCH`  | `/api/hr/students/batch-arrangement`         | 批量设置学生入职安排   |
| `DELETE` | `/api/hr/students/:id`                       | 软删除学生             |
| `POST`   | `/api/hr/students/:id/attachments`           | HR 上传附件            |
| `PUT`    | `/api/hr/students/:id/attachments/replace`   | HR 替换附件            |
| `DELETE` | `/api/hr/students/:id/attachments`           | HR 删除附件            |
| `GET`    | `/api/hr/students/:id/attachments/download`  | HR 下载附件            |

### 学生登录和登记

| Method   | Path                       | 说明                 |
| -------- | -------------------------- | -------------------- |
| `POST`   | `/api/student/login`       | 使用姓名和邮箱登录   |
| `POST`   | `/api/student/logout`      | 清除学生登录 Cookie  |
| `GET`    | `/api/student/me`          | 获取当前登录学生     |
| `GET`    | `/api/student/form`        | 获取登记表和 HR 安排 |
| `POST`   | `/api/student/form/submit` | 一次性提交登记表     |
| `POST`   | `/api/student/attachments` | 提交前上传附件       |
| `DELETE` | `/api/student/attachments` | 提交前删除附件       |

新增学生请求体：

```json
{
  "name": "测试学生",
  "email": "student@example.com",
  "phone": "13800000000",
  "workLocation": "上海办公室",
  "onboardingStartAt": "2026-08-01T00:00:00+08:00"
}
```

`phone`、`workLocation` 和 `onboardingStartAt` 为可选字段；如果录入时安排入职，工作地点和开始日期必须同时提供。

学生列表支持以下 Query 参数：

| 参数                   | 类型     | 默认值          | 说明                                                   |
| ---------------------- | -------- | --------------- | ------------------------------------------------------ |
| `page`                 | number   | `1`             | 当前页码                                               |
| `limit`                | number   | `20`            | 每页数量，最大 100                                     |
| `keyword`              | string   | -               | 搜索姓名、邮箱、手机号或学校                           |
| `status`               | string   | -               | 按学生状态筛选                                         |
| `workLocation`         | string   | -               | 按工作地点筛选                                         |
| `formStatus`           | string   | -               | `not_submitted` 或 `submitted`                         |
| `onboardingStartMonth` | string   | -               | 按首次开始工作的月份筛选，格式为 `YYYY-MM`             |
| `ownerHrId`            | ObjectId | -               | 管理员按录入 HR 筛选；普通 HR 始终只返回自己的学生     |
| `sortBy`               | string   | `created_at_desc` | `created_at_desc`、`onboarding_start_at_asc` 或 `onboarding_start_at_desc` |

单个安排请求体：

```json
{
  "workLocation": "上海办公室",
  "onboardingStartAt": "2026-08-01T00:00:00+08:00"
}
```

批量安排请求体：

```json
{
  "studentIds": ["studentObjectId1", "studentObjectId2"],
  "workLocation": "线上",
  "onboardingStartAt": "2026-08-05T00:00:00+08:00"
}
```

当前学生状态：

```text
candidate -> pending_onboarding -> onboarded -> departed
```

- `candidate`：HR 已预录入，但尚未完成入职安排。
- `pending_onboarding`：HR 已设置工作地点和入职开始日期。
- `onboarded`：入职开始日期已到；系统每天自动更新，并在 HR 获取列表时补漏。
- `departed`：实习结束日期的次日；系统自动将学生标记为已离职。

状态更新使用中国自然日判断并采用幂等数据库条件。NestJS Cron 每天在
`Asia/Shanghai 00:05` 执行，HR 获取学生列表时也会调用同一方法作为兜底。

## 技术栈

| 模块                 | 技术                                |
| -------------------- | ----------------------------------- |
| Frontend             | Next.js 16 + React 19 + TypeScript  |
| UI                   | Tailwind CSS 4 + DayPicker + Lucide |
| Backend              | NestJS 11 + TypeScript              |
| Runtime              | Node.js 20+                         |
| Database             | MongoDB                             |
| ODM                  | Mongoose 9                          |
| Validation           | class-validator + class-transformer |
| Authentication       | JWT + HttpOnly Cookie               |
| Password Hash        | bcrypt                              |
| Current File Storage | 本地 `backend/uploads/`             |
| Future File Storage  | 公司阿里云 OSS                      |
