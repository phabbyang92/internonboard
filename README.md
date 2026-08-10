# internonboard - 学生登记与考勤系统

`internonboard` 是一个面向学生与 HR 的全栈登记、入职安排和考勤管理系统。HR
预录入学生并安排实习地点与日期；学生通过姓名和邮箱进入统一工作台，在入职前
一次性提交登记表和附件，入职后登记出勤、请假并查看个人记录；HR 在后台管理学生、
工作地点时间线、附件和考勤数据。

项目目前已完成登记、入职安排、附件管理、学生考勤和 HR 考勤管理等主要功能。
正式发布前仍需由部署人员配置办公室公网 IP、MongoDB、ownCloud 和腾讯文档，并由
Admin HR、普通 HR 和学生代表完成人工业务验收。

## 当前功能

### 学生端

学生使用 HR 预录入的姓名和邮箱登录。系统根据当前业务阶段自动进入登记表、等待
入职、考勤工作台或实习结束页面。登记表包含个人信息、教育经历、家庭成员、校外
实习经历、补充信息和实习结束日期；个人简历、身份证正反面或外籍护照对应页通过
ownCloud WebDAV 保存，身份证图片在写入存储前由后端清除元数据并添加水印。登记表
只能由学生提交一次，提交后仅 HR 可以修改。

入职期间，学生可以选择系统允许的线上或线下签到方式、登记未来 14 天内的多个有效
请假日期、撤销符合条件的未来请假，并按月份查看自己的出勤记录。线上地点只能线上
签到；线下地点允许选择线上或线下，选择线下时必须匹配对应办公室 Wi-Fi 的公网出口
IP。系统同时保证每名学生每天最多一条出勤记录、每个浏览器设备标识每天最多用于一次
成功签到，但设备不会与学生永久绑定。

### HR 端

普通 HR 只能查看和管理自己录入的学生；Admin HR 可以查看全部学生并按负责 HR 筛选。
HR 可以连续新增学生、安排或批量安排入职、维护可修改和撤销的工作地点时间线、搜索
筛选和排序学生、修改登记资料及内部备注、管理附件、查看操作日志，并将完整学生资料
导出为 Excel。

考勤后台提供每日出勤、月度汇总和学生个人考勤详情。HR 可以按日期、月份、学生、
地点、签到方式和状态筛选，并在填写原因后人工更正考勤记录。普通 HR 的考勤数据继续
受学生归属范围限制，Admin HR 可以查看全部学生。

### Admin 与系统能力

Admin HR 可以维护普通 HR 的负责地区、全国或地区工作日历例外、办公室公网 IP/CIDR，
并查看 Cron 与按需补算运行状态。共享文档页面支持嵌入配置的腾讯文档，第三方策略禁止
iframe 时仍可在新标签页打开。

后端统一使用 `Asia/Shanghai` 判断学生状态、工作日和考勤时间。`10:01` 前为按时，
`10:01` 至 `10:30` 为迟到，`10:30` 后至 `11:00` 允许登记但记为严重迟到并计缺勤，
`11:00` 后关闭签到并记缺勤。缺勤可以在 HR 查询时幂等补算，也可以通过可选 Cron 在
工作日 `11:01` 主动补算。学生状态按
`candidate -> pending_onboarding -> onboarded -> departed` 自动更新，实习结束日期当天
仍可使用考勤，次日进入已离职状态。

## 项目结构

```text
internonboard/
├── backend/                           # NestJS API
│   ├── config/                        # 办公网络配置模板
│   ├── scripts/                       # 账号、迁移、备份和发布验证脚本
│   ├── src/
│   │   ├── common/
│   │   │   ├── filters/               # 统一异常响应
│   │   │   ├── http/                  # Request ID 中间件
│   │   │   ├── observability/         # Cron/按需任务运行观测
│   │   │   ├── schemas/               # Mongoose 基础字段
│   │   │   ├── security/              # 安全日志和通用安全处理
│   │   │   ├── time/                  # Asia/Shanghai 业务时钟
│   │   │   ├── transforms/            # DTO 数据转换
│   │   │   └── validation/            # 通用字段校验
│   │   ├── config/                    # 环境变量和发布配置校验
│   │   ├── database/                  # MongoDB/Mongoose 连接
│   │   ├── modules/
│   │   │   ├── attendance/            # 签到、请假、汇总、日历、地区和网络
│   │   │   │   ├── access/            # HR/地区数据权限
│   │   │   │   ├── dto/               # 考勤接口 DTO
│   │   │   │   ├── schedulers/        # 缺勤补算 Cron
│   │   │   │   └── schemas/           # 考勤、日历和办公网络模型
│   │   │   ├── auth/                  # HR/学生登录、JWT Cookie 和 Guard
│   │   │   ├── file/                  # 本地/ownCloud 存储抽象与文件处理
│   │   │   ├── health/                # liveness/readiness
│   │   │   ├── hr/                    # HR 学生管理、附件和 Excel 导出
│   │   │   ├── onboarding/            # 入职/离职状态更新任务
│   │   │   ├── operation-log/         # MongoDB 操作审计日志
│   │   │   ├── student/               # 学生主模型和核心业务逻辑
│   │   │   ├── student-form/          # 登记表提交和学生附件接口
│   │   │   └── work-location/         # 工作地点时间线
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                           # 隔离 MongoDB E2E 和关键规则测试
│   ├── .env.example
│   ├── .env.e2e.example
│   └── package.json
├── frontend/                           # Next.js App Router
│   ├── public/                         # 静态资源
│   ├── src/
│   │   ├── app/
│   │   │   ├── hr/                    # HR 登录、学生管理、考勤和设置页面
│   │   │   └── student/               # 学生登录、登记、考勤和结束页面
│   │   ├── components/
│   │   │   ├── hr/                    # HR 学生与考勤业务组件
│   │   │   ├── student/               # 学生登记与考勤业务组件
│   │   │   └── ui/                    # 日期、年份等复用控件
│   │   ├── hooks/                      # Portal、表单和考勤数据 Hooks
│   │   ├── lib/
│   │   │   └── api/                   # Cookie API Client
│   │   ├── test/                       # Vitest/JSDOM 测试配置
│   │   └── types/                      # 前端接口类型
│   ├── .env.example
│   ├── vitest.config.mts
│   └── package.json
├── output/pdf/                         # 使用指南等生成文件
├── ATTENDANCE_DEVELOPMENT_PLAN.md      # 考勤模块完整设计与实施记录
├── PROJECT_PLAN.md                     # 登记系统需求与数据设计
├── USER_GUIDE.md                       # HR 与学生使用指南
└── README.md
```

`prototype/` 是本地早期展示原型，已被 Git 忽略，不属于当前系统的构建或发布内容。
根目录的本地发布检查脚本同样不进入 Git；后端正式维护脚本仍保存在
`backend/scripts/` 中。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16、React 19、TypeScript |
| UI | Ant Design 6、Tailwind CSS 4、Lucide React、Day.js |
| Backend | NestJS 11、Node.js 20+、TypeScript |
| Database | MongoDB、Mongoose 9 |
| Authentication | JWT、HttpOnly Cookie、bcrypt、NestJS Guard/Throttler |
| Validation | class-validator、class-transformer |
| File storage | ownCloud WebDAV；本地测试可切换目录存储 |
| File processing | Sharp 身份证图片纠正、去元数据和水印；ExcelJS 导出 |
| Scheduling | `@nestjs/schedule`，统一 `Asia/Shanghai` 业务时间 |
| Testing | Jest、Supertest、Vitest、Testing Library |

## 本地启动

### 1. 前置依赖

- Node.js 20 或更高版本
- npm
- MongoDB（默认 `127.0.0.1:27017`）
- Docker Desktop（本地运行 ownCloud 时需要）

### 2. 启动 MongoDB 和 ownCloud

先启动本地 MongoDB。首次创建 ownCloud 测试容器：

```bash
docker run \
  --name internonboard-owncloud \
  -d \
  -p 8080:8080 \
  -v internonboard-owncloud-data:/mnt/data \
  owncloud/server
```

已有容器时运行：

```bash
docker start internonboard-owncloud
```

浏览器访问 `http://localhost:8080`，为后端专用账号创建 App Passcode。正式环境必须
使用 HTTPS、最小权限服务账号和受控业务目录，不能使用个人管理员密码。

### 3. 配置并启动后端

```bash
cd backend
npm install
cp .env.example .env
openssl rand -base64 48
```

将随机字符串写入 `JWT_SECRET`，并按本地 ownCloud 账号修改 `.env`：

```env
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/intern_onboarding
JWT_SECRET=replace-with-your-random-secret

FILE_STORAGE_DRIVER=owncloud
WEBDAV_URL=http://localhost:8080/remote.php/dav/files/admin/
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=replace-with-owncloud-app-passcode
WEBDAV_REMOTE_PATH=学生入职登记系统

ID_CARD_WATERMARK_TEXT=仅限学生入职登记使用 · {studentName} · {date}
ATTENDANCE_TIMEZONE=Asia/Shanghai
ATTENDANCE_ON_TIME_BEFORE=10:01
ATTENDANCE_LATE_THROUGH=10:30
ATTENDANCE_CHECK_IN_CLOSE_AFTER=11:00
ATTENDANCE_CRON_ENABLED=false
TRUST_PROXY_HOPS=0
```

启动后端：

```bash
npm run start:dev
```

API 默认地址为 `http://localhost:3001/api`。

### 4. 创建 HR 测试账号

在 `backend` 目录运行：

```bash
npm run create:hr -- \
  --email admin@example.com \
  --password 'TestPass123!' \
  --name '测试管理员' \
  --role admin

npm run create:hr -- \
  --email hr@example.com \
  --password 'TestPass123!' \
  --name '测试 HR'
```

密码也可以通过临时 `HR_PASSWORD` 环境变量传入，避免留在 shell 历史。密码只以 bcrypt
哈希保存。`admin` 可以查看全部学生，普通 `hr` 只能管理自己录入的学生。

### 5. 配置办公室公网 IP

线下签到读取 MongoDB `office_networks` 集合，不读取 `.env`。Admin 可以在
`/hr/attendance/networks` 页面维护，初始化或批量同步可以使用：

```bash
cd backend
cp config/office-networks.example.json config/office-networks.local.json
# 编辑 local 文件中的公网 IP/CIDR、启用状态和 updatedByHrEmail
npm run sync:office-networks
```

正式值必须由公司 IT 提供办公室 Wi-Fi 的公网出口 IP/CIDR，不能填写
`192.168.x.x`、`10.x.x.x` 等内网地址。`config/office-networks.local.json` 被 Git
忽略，不应把真实 IP 写入仓库。

### 6. 配置并启动前端

打开另一个终端：

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

本地配置示例：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_TENCENT_DOC_URL=https://docs.qq.com/your-document
NEXT_PUBLIC_TENCENT_DOC_TITLE=HR 在线文档
```

前端默认地址为 `http://localhost:3000`。

| 入口 | 地址 |
| --- | --- |
| 学生统一入口 | `http://localhost:3000/student/login` |
| HR 登录 | `http://localhost:3000/hr/login` |
| HR 学生管理 | `http://localhost:3000/hr/students` |
| HR 考勤工作台 | `http://localhost:3000/hr/attendance` |
| Admin 工作日历 | `http://localhost:3000/hr/attendance/calendar` |
| Admin 办公网络 | `http://localhost:3000/hr/attendance/networks` |
| HR 共享文档 | `http://localhost:3000/hr/shared-document` |

## 环境配置

后端启动时集中校验环境变量。生产环境会拒绝 HTTP Origin、HTTP WebDAV、本地附件
存储、示例 JWT、`TRUST_PROXY_HOPS=0` 以及错误的考勤时间顺序。配置字段以
`backend/.env.example`、`backend/.env.production.example` 和后端配置校验代码为准；
真实密钥、数据库 URI、ownCloud App Passcode 和办公室公网 IP 不得提交到 Git。

前端 `NEXT_PUBLIC_*` 会在构建时写入浏览器包，只能放公开地址或标题，不能存放密码、
JWT 或 App Passcode；修改后必须重新构建前端。

身份证图片仅接受 JPG/JPEG/PNG。后端在上传到 ownCloud 前纠正方向、移除元数据并添加
平铺水印，原始无水印图片不会保存。修改水印模板只影响之后新上传或替换的文件。

## 主要 API

所有接口使用 `/api` 前缀，登录态通过 HttpOnly Cookie 携带。

### 健康与运行观测

| Method | Path | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 公开 | 兼容健康检查 |
| `GET` | `/api/health/live` | 公开 | Node/NestJS 存活状态 |
| `GET` | `/api/health/ready` | 公开 | MongoDB 与文件存储就绪状态 |
| `GET` | `/api/hr/attendance/operations` | Admin | Cron 与按需补算运行摘要 |

### 登录与 Portal

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/hr/login` | HR 邮箱密码登录 |
| `POST` | `/api/hr/logout` | HR 退出 |
| `GET` | `/api/hr/me` | 当前 HR 和权限摘要 |
| `GET` | `/api/hr/users` | Admin 获取 HR 列表 |
| `POST` | `/api/student/login` | 学生姓名和邮箱登录 |
| `POST` | `/api/student/logout` | 学生退出 |
| `GET` | `/api/student/me` | 当前学生身份 |
| `GET` | `/api/student/portal` | 返回登记、等待、考勤或结束状态 |

### 学生登记与附件

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/api/student/form` | 获取登记表和 HR 安排 |
| `POST` | `/api/student/form/submit` | 一次性提交登记表 |
| `POST` | `/api/student/attachments` | 提交前上传附件 |
| `DELETE` | `/api/student/attachments` | 提交前删除附件 |

### 学生考勤

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/api/student/attendance/today` | 当天安排、可选签到方式和状态 |
| `POST` | `/api/student/attendance/check-in` | 线上或线下签到 |
| `GET` | `/api/student/attendance/records` | 按月份查询个人记录和汇总 |
| `GET` | `/api/student/attendance/leave-options` | 获取未来 14 天可请假日期 |
| `POST` | `/api/student/attendance/leaves` | 批量登记请假 |
| `DELETE` | `/api/student/attendance/leaves/:attendanceDate` | 撤销符合条件的未来请假 |

### HR 学生管理

| Method | Path | 说明 |
| --- | --- | --- |
| `POST` / `GET` | `/api/hr/students` | 新增学生或分页查询学生 |
| `GET` | `/api/hr/students/:id` | 学生完整详情 |
| `GET` | `/api/hr/students/:id/export` | 导出 Excel |
| `PATCH` | `/api/hr/students/:id/profile` | 修改登记信息 |
| `PATCH` | `/api/hr/students/:id/memo` | 保存 100 字以内 HR 备注 |
| `PATCH` | `/api/hr/students/:id/arrangement` | 修改单个学生安排 |
| `PATCH` | `/api/hr/students/batch-arrangement` | 批量安排入职 |
| `POST` / `PATCH` / `DELETE` | `/api/hr/students/:id/work-location-assignments...` | 维护地点时间线 |
| `GET` | `/api/hr/students/:id/work-location-history` | 获取地点历史 |
| `GET` | `/api/hr/students/:id/operation-logs` | 获取操作日志 |
| `POST` / `PUT` / `DELETE` | `/api/hr/students/:id/attachments...` | 上传、替换或删除附件 |
| `GET` | `/api/hr/students/:id/attachments/download` | 下载附件 |
| `DELETE` | `/api/hr/students/:id` | 软删除学生 |

### HR 考勤与 Admin 设置

| Method | Path | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/hr/attendance/daily` | HR/Admin | 每日考勤和统计 |
| `GET` | `/api/hr/attendance/summary` | HR/Admin | 学生月度汇总 |
| `GET` | `/api/hr/attendance/students/:studentId` | HR/Admin | 学生考勤详情 |
| `PATCH` | `/api/hr/attendance/students/:studentId/records/:date` | HR/Admin | 人工更正记录 |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/hr/attendance/calendar...` | 按地区权限 | 工作日历例外 |
| `GET` / `PUT` | `/api/hr/attendance/office-networks...` | Admin | 办公室公网 IP/CIDR |
| `GET` | `/api/hr/admin/users` | Admin | HR 地区权限列表 |
| `PATCH` | `/api/hr/admin/users/:hrUserId/regions` | Admin | 修改普通 HR 负责地区 |

接口 DTO、错误码和完整查询参数以 Controller、DTO 及
[考勤开发文档](./ATTENDANCE_DEVELOPMENT_PLAN.md) 为准。

## 测试与发布检查

日常开发可以分别运行：

```bash
cd backend
npm run lint
npm test -- --runInBand
npm run build

cd ../frontend
npm run lint
npx tsc --noEmit
npm test
npm run build -- --webpack
```

隔离 E2E 使用名称以 `_e2e` 结尾的 MongoDB，并限制本地附件目录和 ownCloud 远程路径，
防止误删开发或正式数据：

```bash
cd backend
cp .env.e2e.example .env.e2e
npm run test:e2e:isolated
npm run test:owncloud:e2e
```

发布前还应在配置好正式环境变量后检查外部服务、数据库索引和部署健康状态：

```bash
cd backend
npm run verify:release
npm run verify:mongodb:production
npm run verify:owncloud:production
npm run verify:post-deploy -- --api-origin https://api.example.com
```

当前技术基线：后端 65 个 Jest 套件、480 项单元/集成测试和 16 项隔离 E2E 通过；
前端 21 个 Vitest 文件、65 项测试以及 20 个 Next.js 路由生产构建通过。代码检查不能
代替业务验收，正式发布前仍需由 Admin HR、普通 HR 和学生代表测试各自的完整流程。

## 运维、迁移与发布脚本

以下命令均在 `backend` 目录执行：

| 命令 | 用途 |
| --- | --- |
| `npm run create:hr` | 创建 Admin 或普通 HR |
| `npm run sync:office-networks` | 校验并同步办公室公网 IP |
| `npm run migrate:student-owners` | 回填旧学生负责人 |
| `npm run migrate:work-location-history` | 回填旧地点时间线 |
| `npm run migrate:work-location-names` | 迁移旧地点名称 |
| `npm run migrate:remove-marital-status` | 删除旧婚姻状况字段 |
| `npm run migrate:attendance-regions` | 回填考勤地区字段 |
| `npm run migrate:owncloud` | 将本地附件复制到 ownCloud |
| `npm run verify:owncloud` | 验证 ownCloud 上传、下载和清理 |
| `npm run verify:release` | 校验正式环境和外部服务配置 |
| `npm run backup:mongodb` | 创建 MongoDB 归档、SHA-256 和集合计数 |
| `npm run verify:mongodb-backup` | 在隔离库验证备份恢复 |
| `npm run verify:mongodb:production` | 检查正式数据库关键索引 |
| `npm run verify:post-deploy` | 验证已部署 liveness/readiness |

迁移前必须确认目标 `MONGODB_URI` 并完成备份。迁移脚本应先在隔离测试库验证，再在
维护窗口由部署人员执行；完成后需检查关键集合数量、索引、附件下载和健康接口。

## 文档

- [项目设计](./PROJECT_PLAN.md)
- [考勤系统开发计划](./ATTENDANCE_DEVELOPMENT_PLAN.md)
- [HR 与学生使用指南](./USER_GUIDE.md)
- [使用指南 PDF](./output/pdf/student-onboarding-user-guide.pdf)
