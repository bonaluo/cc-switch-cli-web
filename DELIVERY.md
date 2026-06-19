# CC Switch Web - 项目交付文档

## 项目概述

**CC Switch Web** 是一个基于 Web 的 cc-switch-cli 管理界面，通过浏览器可视化地管理 Claude Code 等 AI 工具的 Provider 配置。

## 项目结构

```
cc-switch-cli-web/
├── server/
│   ├── main.py          # FastAPI 后端服务器
│   └── pyproject.toml   # Python 项目配置
├── web/
│   ├── dist/            # 生产构建产物
│   ├── src/
│   │   ├── App.tsx           # 主应用组件
│   │   ├── main.tsx          # React 入口
│   │   ├── index.css         # 全局样式 (Tailwind + 自定义)
│   │   └── components/
│   │       ├── Header.tsx       # 顶部标题栏
│   │       ├── ProviderList.tsx # Provider 管理
│   │       ├── SessionList.tsx  # 会话一览
│   │       ├── EnvTools.tsx     # 环境工具检查
│   │       └── StatusBar.tsx   # 底部状态栏
│   ├── index.html       # HTML 入口
│   ├── package.json     # npm 依赖
│   └── vite.config.ts   # Vite 构建配置
├── start.sh             # 一键启动脚本
└── README.md            # 项目说明
```

## 技术栈

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + Python 3.12 + uvicorn
- **通信**: RESTful API + WebSocket
- **核心依赖**: cc-switch-cli (通过子进程调用)

## 已实现功能

### 1. Provider 管理
- ✅ 查看所有配置的 Provider（16 个）
- ✅ 一键切换 Provider
- ✅ 搜索过滤
- ✅ 当前 Provider 高亮显示
- ✅ WebSocket 实时状态更新

### 2. 会话查看
- ✅ 查看当前会话
- ✅ 查看所有历史会话
- ✅ 表格形式展示

### 3. 环境工具
- ✅ 检查本地 CLI 工具状态（Claude, Codex, Gemini 等）
- ✅ 版本信息展示

### 4. 其他
- ✅ 深色主题界面
- ✅ 响应式设计
- ✅ 底部状态栏显示
- ✅ 错误提示

## API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/providers` | 获取所有 Provider |
| POST | `/api/providers/{id}/switch` | 切换 Provider |
| GET | `/api/sessions` | 获取会话列表 |
| GET | `/api/env/tools` | 检查环境工具 |
| WS | `/ws` | WebSocket 通信 |

## 启动方式

### 方式一：一键启动（推荐）

```bash
cd /home/xfy/.hermes/repo/bonaluo/cc-switch-cli-web
./start.sh
```

### 方式二：手动启动

```bash
# 后端
cd server
python3 main.py

# 前端（开发模式）
cd web
npm run dev
```

## 访问地址

- **Web UI**: http://localhost:8765
- **API Docs**: http://localhost:8765/docs (Swagger UI)

## 验证状态

- ✅ 后端 FastAPI 服务正常启动（端口 8765）
- ✅ 前端 React 应用已构建完成
- ✅ API `/api/providers` - 返回 16 个 Provider
- ✅ API `/api/providers/{id}/switch` - 切换功能正常（测试切换 ModelScope 成功）
- ✅ API `/api/sessions` - 返回会话数据
- ✅ API `/api/env/tools` - 返回环境状态（Claude v2.1.181 已安装）
- ✅ WebSocket 连接正常
- ✅ 前端 SPA 路由正常

## 使用说明

1. 确保 cc-switch-cli 已安装且可用
2. 运行 `./start.sh` 启动服务
3. 打开浏览器访问 http://localhost:8765
4. 在 Providers 页面查看和管理 Provider
5. 点击 "Switch" 按钮切换到其他 Provider
6. 根据需要查看 Sessions 和 Environment

## 后续可扩展功能

- MCP 服务器管理
- Provider 添加/编辑/删除
- 使用情况统计
- 多语言支持
- 登录认证

## 版本信息

- CC Switch Web: v1.0.0
- cc-switch-cli: v5.8.3
- Python: 3.12.3
- React: 18.2.0
- FastAPI: 0.137.2
