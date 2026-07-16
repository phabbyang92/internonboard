# 当前方案静态原型

直接打开 `index.html`。这是根据当前 `PROJECT_PLAN.md` 重建的单入口交互演示。

当前入口包含：

- 学生姓名 + 邮箱登录
- HR 预先安排工作地点和入职开始时间
- 学生一次性提交登记表与附件
- HR 学生列表、筛选、详情修改和附件下载
- HR 批量安排与操作日志展示

页面使用模拟数据，不连接后端或数据库。

以下旧页面仅保留作为早期讨论记录：

- `student-register.html`：学生登记表页面
- `register-success.html`：学生提交成功页
- `hr-login.html`：HR 登录页
- `hr-students.html`：HR 学生列表页
- `hr-student-detail.html`：HR 学生详情页

旧页面说明：

- 这是纯前端 HTML/CSS/JS 原型，不连接数据库。
- 表单提交、附件上传、附件下载、创建链接、导出 Excel 都是模拟交互。
- 旧学生登记页仍展示早期 token 链接方案。
- 旧 HR 详情页仍展示早期 token、invite 和 studentCode 关系。
- 后续进入真实开发时，可按 `PROJECT_PLAN.md` 中的技术栈和数据模型实现。
