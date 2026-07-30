# 备婚协同管理平台 - 部署指南

## 第一部分：部署到 GitHub Pages（免费，微信可直接打开）

### 前置条件
- 注册一个 GitHub 账号（https://github.com）
- 如已有账号，跳过此步

### 步骤 1：安装并配置 Git（如已安装跳过）

下载地址：https://git-scm.com/downloads

安装后，打开终端（或 Git Bash），执行：
```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

### 步骤 2：在 GitHub 上创建仓库

1. 登录 https://github.com
2. 点右上角 **+** → **New repository**
3. Repository name 填：`wedding-planner`（或任意名字，不要用中文）
4. 选 **Public**（必须公开，否则 Pages 不可用）
5. **不要**勾选 "Add a README file"
6. 点 **Create repository**

### 步骤 3：本地初始化并推送

在项目目录下执行（将 `你的用户名` 替换为你的 GitHub 用户名）：

```bash
cd C:/Users/Fancy/WorkBuddy/2026-07-30-18-01-03

# 初始化 Git
git init
git add .
git commit -m "婚礼备婚协同管理平台"

# 关联远程仓库并推送
git branch -M main
git remote add origin https://github.com/你的用户名/wedding-planner.git
git push -u origin main
```

> 首次推送时会弹出 GitHub 登录窗口，按提示授权即可。

### 步骤 4：开启 GitHub Pages

1. 打开你的仓库页面 `https://github.com/你的用户名/wedding-planner`
2. 点 **Settings** → 左侧菜单找到 **Pages**
3. Source 选 **Deploy from a branch**
4. Branch 选 **main**，文件夹选 **/ (root)**
5. 点 **Save**

等待 1-2 分钟，刷新页面会看到提示：
```
Your site is live at https://你的用户名.github.io/wedding-planner/
```

### 步骤 5：在微信中打开

- 直接将 `https://你的用户名.github.io/wedding-planner/` 发到微信
- 点击链接即可在微信内置浏览器中打开
- 建议收藏到微信「我的收藏」方便随时访问

> ⚠️ GitHub Pages 域名偶尔会被微信拦截提示「非微信官方网页」，点「继续访问」即可。

---

## 第二部分：连接 Supabase 数据库（实现多人实时同步）

### 为什么要连数据库？
- 不连数据库：数据只存在当前浏览器，换设备/换浏览器数据不互通
- 连了数据库：所有人看到同一份数据，一人修改全员实时同步

### 步骤 1：注册 Supabase

1. 打开 https://supabase.com
2. 点 **Start your project** → 用 GitHub 账号登录（最方便）
3. 授权后进入控制台

### 步骤 2：创建项目

1. 点 **New Project**
2. Name 填：`wedding-db`（任意）
3. Database Password：设一个密码并**记下来**（后续不常用，但别丢）
4. Region 选 **Southeast Asia (Singapore)**（离国内最近，速度最快）
5. 点 **Create new project**，等待约 2 分钟初始化完成

### 步骤 3：执行数据库初始化 SQL

1. 在项目左侧菜单点 **SQL Editor**
2. 点 **New query**
3. 打开本项目的 `supabase-setup.sql` 文件，**全选复制**内容
4. 粘贴到 SQL Editor 中
5. 点 **Run**（运行），等待执行完成

> 执行成功后会看到 "Success. No rows returned" 字样。

### 步骤 4：获取 API 连接信息

1. 左侧菜单点 **Project Settings**（齿轮图标）
2. 点 **API**
3. 找到以下两项，复制下来：
   - **Project URL**：形如 `https://xxxxxxx.supabase.co`
   - **anon public key**：一长串 `eyJhbGciOi...` 开头的字符串

### 步骤 5：填入配置文件

打开项目中的 `js/config.js`，找到这两行：

```javascript
SUPABASE_URL: '',        // 替换为你的 Project URL
SUPABASE_ANON_KEY: '',   // 替换为你的 anon public key
```

填入你的信息，例如：
```javascript
SUPABASE_URL: 'https://xxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
```

### 步骤 6：重新推送到 GitHub

```bash
cd C:/Users/Fancy/WorkBuddy/2026-07-30-18-01-03
git add .
git commit -m "配置 Supabase 数据库连接"
git push
```

推送后等 1-2 分钟，GitHub Pages 自动更新。刷新网页，顶部「预览模式」提示消失即表示数据库连接成功。

---

## 验证清单

- [ ] GitHub Pages 地址能在浏览器打开
- [ ] 能用 `wedding_admin` / `Wedding2026!` 登录
- [ ] 页面顶部不再显示「预览模式」
- [ ] 新增一条宾客数据后，用另一个设备打开能看到（实时同步生效）
- [ ] 微信中点击链接能正常打开

## 常见问题

**Q: 推送时提示 "Permission denied"？**
A: 检查 GitHub 登录是否过期，或改用 SSH 方式推送。

**Q: Pages 打开后白屏？**
A: 检查仓库是否为 Public，以及 Pages 设置的分支是否正确。

**Q: Supabase 连不上？**
A: 确认 config.js 中的 URL 不含末尾斜杠，anon key 完整复制（很长）。

**Q: 微信打不开提示拦截？**
A: 点「继续访问」即可；如仍不行，可用短链接工具转换后再发。
