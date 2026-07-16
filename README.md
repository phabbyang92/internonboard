# internonboard — 实习生入职登记系统

实习生入职登记系统是一个基于 Next.js、NestJS 和 MongoDB 的全栈项目，用于完成实习生名单预录入、HR 入职安排、学生信息登记和附件管理。

系统的目标流程是：HR 登录后台并预先录入学生，设置工作地点和入职开始时间；学生通过统一入口使用姓名和邮箱登录，填写并一次性提交登记表；HR 在后台查看学生信息并下载附件。

当前项目处于 MVP 后端开发阶段。Next.js 前端目前是基础脚手架，`prototype/` 中提供了用于与 HR 和 mentor 讨论需求的静态页面原型。

## 已实现功能

- MongoDB 和 Mongoose 数据库连接
- 学生数据模型以及 `name + email` 联合唯一索引
- 全局请求参数校验
- 统一错误响应
- HR 账号数据模型
- bcrypt 密码哈希
- HR 邮箱和密码登录
- JWT + HttpOnly Cookie 登录状态
- HR API 鉴权 Guard
- 新增单个学生
- 连续调用新增接口录入多名学生
- 学生列表分页查询
- 按姓名、邮箱或手机号搜索学生
- 按入职状态筛选学生
- HR 单独设置学生工作地点和入职开始时间
- HR 批量设置学生工作地点和入职开始时间
- 安排完成后将学生状态更新为 `pending_onboarding`
- NestJS Logger 记录关键 HR 操作
- 纯前端交互原型

当前尚未实现学生登录、登记表提交、附件上传下载、HR 学生详情编辑、学生软删除、入职状态自动更新和前后端 API 集成。

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
│   │   │   ├── auth/                 # HR 登录、JWT、Cookie、Guard
│   │   │   ├── hr/                   # HR 学生管理接口
│   │   │   ├── student/              # 学生模型、DTO 和业务逻辑
│   │   │   ├── file/                 # 文件模块，待开发
│   │   │   └── onboarding/           # 入职状态模块，待开发
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/app/                      # Next.js App Router
│   └── package.json
├── prototype/
│   ├── index.html                    # 当前交互原型入口
│   └── assets/
├── PROJECT_PLAN.md                   # 需求、流程和数据设计
└── README.md
```

## 项目启动流程

### 前置依赖

| 依赖 | 用途 | 默认配置 |
| --- | --- | --- |
| Node.js 20+ | 前后端运行环境 | - |
| npm | 依赖管理 | - |
| MongoDB | 学生和 HR 数据 | `mongodb://127.0.0.1:27017/intern_onboarding` |
| mongosh | 本地数据库初始化和检查 | - |

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

先生成 bcrypt 密码哈希：

```bash
node -e "require('bcrypt').hash('TestPass123!', 12).then(console.log)"
```

进入 MongoDB：

```bash
mongosh intern_onboarding
```

将生成的哈希填入 `passwordHash`：

```js
db.hr_users.insertOne({
  email: "hr@example.com",
  passwordHash: "<生成的 bcrypt hash>",
  name: "测试 HR",
  role: "admin",
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 5. 启动后端

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

### 6. 启动前端

新建一个终端：

```bash
cd internonboard/frontend
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:3000
```

当前 Next.js 页面还没有连接后端 API。

### 7. 查看静态原型

直接在浏览器打开：

```text
prototype/index.html
```

静态原型使用模拟数据，不连接后端或 MongoDB。

## API 接口

所有后端接口统一使用 `/api` 前缀。

### 基础接口

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 检查后端运行状态 |

### HR 登录

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/hr/login` | HR 邮箱密码登录并设置 Cookie |
| `POST` | `/api/hr/logout` | 清除 HR 登录 Cookie |
| `GET` | `/api/hr/me` | 获取当前登录 HR 信息 |

登录请求体：

```json
{
  "email": "hr@example.com",
  "password": "TestPass123!"
}
```

### HR 学生管理

以下接口由 `HrAuthGuard` 保护，需要携带 HR 登录 Cookie。

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/hr/students` | 新增单个学生 |
| `GET` | `/api/hr/students` | 获取学生列表 |
| `PATCH` | `/api/hr/students/:id/arrangement` | 设置单个学生的入职安排 |
| `PATCH` | `/api/hr/students/batch-arrangement` | 批量设置学生入职安排 |

新增学生请求体：

```json
{
  "name": "测试学生",
  "email": "student@example.com",
  "phone": "13800000000"
}
```

学生列表支持以下 Query 参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | number | `1` | 当前页码 |
| `limit` | number | `20` | 每页数量，最大 100 |
| `keyword` | string | - | 搜索姓名、邮箱或手机号 |
| `status` | string | - | 按学生状态筛选 |

单个安排请求体：

```json
{
  "workLocation": "上海徐汇",
  "onboardingStartAt": "2026-08-01T09:00:00+08:00"
}
```

批量安排请求体：

```json
{
  "studentIds": [
    "studentObjectId1",
    "studentObjectId2"
  ],
  "workLocation": "上海静安",
  "onboardingStartAt": "2026-08-05T09:30:00+08:00"
}
```

当前学生状态：

```text
candidate -> pending_onboarding -> onboarded
```

- `candidate`：HR 已预录入，但尚未完成入职安排。
- `pending_onboarding`：HR 已设置工作地点和入职开始时间。
- `onboarded`：已到入职时间，自动更新逻辑尚未实现。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Frontend | Next.js 16 + React 19 + TypeScript |
| UI | Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript |
| Runtime | Node.js 20+ |
| Database | MongoDB |
| ODM | Mongoose 9 |
| Validation | class-validator + class-transformer |
| Authentication | JWT + HttpOnly Cookie |
| Password Hash | bcrypt |
| Current File Storage | 本地 `uploads/`，待实现 |
| Future File Storage | 公司阿里云 OSS |
