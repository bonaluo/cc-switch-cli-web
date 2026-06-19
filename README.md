# CC Switch Web

一个基于 Web 的 cc-switch-cli 管理界面，让你可以通过浏览器可视化地管理 Claude Code 等 AI 工具的 Provider 配置。

## 功能特性

- 🔌 **Provider 管理** - 查看所有配置的 Provider，一键切换
- 📊 **实时状态** - WebSocket 实时连接状态显示
- 💬 **Session 查看** - 查看和管理会话
- 🔧 **环境检查** - 检查本地环境工具状态
- 🌐 **响应式设计** - 深色主题，支持移动端

## 技术架构

```
┌──────────────────────────────────────┐
│         React + Vite + Tailwind       │
│              (Frontend)                │
├──────────────────────────────────────┤
│      FastAPI + WebSocket               │
│      (API Server)                      │
├──────────────────────────────────────┤
│      cc-switch-cli (subprocess)       │
│      (Core Logic)                      │
├──────────────────────────────────────┤
│      ~/.config/cc-switch/ (SQLite)    │
│      (Data Storage)                    │
└──────────────────────────────────────┘
```

## 快速开始

### 前提条件

- Python 3.10+
- Node.js 18+
- cc-switch-cli (已安装)
- pip install fastapi uvicorn websockets

### 一键启动

```bash
./start.sh
```

### 手动启动

```bash
# 启动后端 (端口 8765)
cd server
python3 main.py

# 或者使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8765
```

然后访问: http://localhost:8765

### 前端开发

```bash
cd web
npm install
npm run dev       # 开发模式
npm run build     # 生产构建
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers` | 获取所有 Provider |
| POST | `/api/providers/{id}/switch` | 切换到指定 Provider |
| GET | `/api/sessions?all=true/false` | 获取会话列表 |
| GET | `/api/env/tools` | 获取环境工具状态 |
| WS | `/ws` | WebSocket 实时通信 |

## 项目结构

```
cc-switch-cli-web/
├── server/
│   ├── main.py          # FastAPI 后端
│   └── pyproject.toml   # Python 依赖
├── web/
│   ├── src/
│   │   ├── App.tsx           # 主组件
│   │   ├── main.tsx          # 入口
│   │   ├── index.css         # 全局样式
│   │   └── components/
│   │       ├── Header.tsx       # 顶部导航
│   │       ├── ProviderList.tsx # Provider 列表
│   │       ├── SessionList.tsx  # 会话列表
│   │       ├── EnvTools.tsx     # 环境工具
│   │       └── StatusBar.tsx  # 底部状态栏
│   ├── index.html       # HTML 模板
│   ├── package.json     # npm 依赖
│   └── vite.config.ts   # Vite 配置
├── start.sh             # 启动脚本
└── README.md
```

## 截图

![Provider List](screenshots/providers.png)

## License

MIT

## 致谢

- [cc-switch-cli](https://github.com/SaladDay/cc-switch-cli) - 核心 CLI 工具
- [cc-switch](https://github.com/farion1231/cc-switch) - 原始桌面应用
