# 代码规范指南 (GF - Guide File)

> 本规范定义项目的代码编写标准，适用于 ModelRouter 项目
> 
> **版本: 1.0**
> **最后更新: 2026-03-10**

---

## 一、项目技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + React Router 6 |
| UI组件 | Tailwind CSS + lucide-react |
| 图表 | Recharts |
| 后端 | Express.js 4.x |
| 数据库 | lowdb (JSON文件存储) |
| 桌面端 | Electron |

---

## 二、后端规范 (server/)

### 2.1 项目结构

```
server/
├── src/
│   ├── index.js          # 入口文件 (禁止超过500行)
│   ├── db.js             # 数据库操作
│   ├── routes/           # 路由模块 (待创建)
│   ├── middleware/       # 中间件 (待创建)
│   ├── services/         # 业务逻辑 (待创建)
│   └── utils/           # 工具函数 (待创建)
├── data/                 # 数据存储目录
├── logs/                 # 日志目录
├── package.json
└── README.md
```

### 2.2 日志规范

#### 2.2.1 日志库选择

| 层级 | 日志库 | 状态 |
|------|--------|------|
| 后端 | pino | ✅ 已集成 |
| Electron | electron-log | ✅ 已集成 |
| 前端 | console (开发用) | - |

#### 2.2.2 日志级别

| 级别 | 用途 | 说明 |
|------|------|------|
| `logger.fatal` | 致命错误 | 导致服务停止的错误 |
| `logger.error` | 错误 | 需要关注的错误 |
| `logger.warn` | 警告 | 潜在问题但不影响功能 |
| `logger.info` | 信息 | 重要业务事件 |
| `logger.debug` | 调试 | 开发环境调试信息 |

#### 2.2.3 日志使用示例

```javascript
const logger = require('./logger');

// ✅ 正确：结构化日志
logger.info({ method: req.method, url: req.url }, 'HTTP Request');
logger.error({ err: error }, 'Failed to parse router response');
logger.warn({ reason: 'AI routing failed' }, 'Using fallback strategy');

// ❌ 错误：字符串拼接
console.log('User ' + userId + ' logged in');
console.error('Error: ' + error.message);
```

#### 2.2.4 日志目录结构

```
server/
├── logs/
│   ├── app.log        # 应用日志
│   └── error.log      # 错误日志
```

#### 2.2.5 请求日志中间件

```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }, 'HTTP Request');
  });
  next();
});
```

#### 2.2.6 全局异常处理

```javascript
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason }, 'Unhandled rejection');
});
```

### 2.3 API 设计规范

#### 2.2.1 URL 命名

| 规则 | 示例 |
|------|------|
| 使用RESTful风格 | `/api/config/models` |
| 资源名称用复数 | `/api/config/strategies` |
| 嵌套资源用单数 | `/api/config/models/:id/stats` |
| 动作用HTTP方法 | POST /api/config/models |

#### 2.2.2 响应格式

```javascript
// 成功响应
res.json({ success: true, data: { ... } })
res.json([...])

// 错误响应
res.status(400).json({ 
  success: false, 
  error: { 
    code: 'INVALID_REQUEST',
    message: '错误描述' 
  } 
})

// 分页响应
res.json({
  success: true,
  data: [...],
  pagination: { page: 1, limit: 20, total: 100 }
})
```

#### 2.2.3 HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功获取/更新 |
| 201 | Created | 成功创建 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Error | 服务器错误 |

### 2.3 路由定义规范

```javascript
// ✅ 正确示例
app.get('/api/config/models', async (req, res) => {
  try {
    const data = db.getData();
    res.json({ success: true, data: data.models || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ❌ 错误示例
app.get('/api/config/models', (req, res) => {
  const data = db.getData();
  res.json(data.models || []);  // 无错误处理
});
```

### 2.4 中间件规范

```javascript
// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: { message: 'Internal server error' } });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Not found' } });
});
```

### 2.5 数据库操作规范

```javascript
// ✅ 正确：使用try-catch
function getData() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return data;
  } catch (err) {
    console.error('Read error:', err);
    return getDefaultData();
  }
}

// ❌ 错误：直接访问无验证
function getData() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
```

### 2.6 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 文件 | kebab-case | `db-helper.js`, `auth-middleware.js` |
| 函数 | camelCase | `getUserData()`, `validateInput()` |
| 常量 | UPPER_SNAKE | `MAX_LOG_SIZE`, `DEFAULT_TIMEOUT` |
| 类 | PascalCase | `UserService`, `AuthMiddleware` |

### 2.7 后端需要优化的点

| 序号 | 位置 | 问题 | 优化建议 |
|------|------|------|----------|
| 1 | `src/index.js` | 850+行单一文件 | 拆分为 routes/, services/, middleware/ |
| 2 | 所有API | 无输入验证 | 引入 Joi 或 Zod |
| 3 | fetch调用 | 无超时控制 | 添加 AbortController timeout |
| 4 | 文件操作 | 同步阻塞 | 改用异步 fs.promisify |
| 5 | 并发处理 | 无锁机制 | 引入轻量锁或队列 |
| 6 | 无日志 | console直接输出 | 引入 winston/pino |

---

## 三、前端规范 (desktop-ui/)

### 3.1 项目结构

```
desktop-ui/
├── src/
│   ├── components/       # 公共组件
│   │   ├── Loading.js
│   │   ├── Modal.js
│   │   ├── Toast.js
│   │   └── ErrorBoundary.js
│   ├── hooks/            # 自定义Hooks
│   │   ├── useFetch.js
│   │   ├── useDebounce.js
│   │   └── useLocalStorage.js
│   ├── utils/            # 工具函数
│   │   ├── api.js
│   │   ├── constants.js
│   │   └── helpers.js
│   ├── pages/            # 页面组件
│   │   ├── Dashboard/
│   │   ├── Models/
│   │   └── ...
│   ├── App.js
│   └── index.js
├── public/
├── package.json
└── README.md
```

### 3.2 React 组件规范

#### 3.2.1 组件结构

```javascript
// ✅ 正确：清晰的组件结构
import React, { useState, useEffect } from 'react';
import { Icon1, Icon2 } from 'lucide-react';

function ComponentName({ prop1, prop2, onAction }) {
  // 1. State
  const [state, setState] = useState(null);
  
  // 2. Effects
  useEffect(() => {
    // 副作用逻辑
  }, [dep]);
  
  // 3. Handlers
  const handleClick = () => {
    onAction?.(state);
  };
  
  // 4. Render
  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}

export default ComponentName;

// ❌ 错误：逻辑混乱
function BadComponent({ data }) {
  const [state, setState] = useState(null);
  useEffect(() => { /* 大量逻辑 */ }, []);
  
  // 渲染中夹杂业务逻辑
  return (
    <div>
      {(() => {
        // 避免在渲染中执行复杂逻辑
      })()}
    </div>
  );
}
```

#### 3.2.2 Props 规范

```javascript
// ✅ 正确：使用解构和默认值
function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  onClick 
}) {
  return <button disabled={disabled} onClick={onClick}>{children}</button>;
}

// ❌ 错误：使用this或arguments
function OldButton() {
  return <button>{arguments[0]}</button>;
}
```

#### 3.2.3 条件渲染

```javascript
// ✅ 正确：清晰的条件渲染
if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (data.length === 0) return <EmptyState />;

return (
  <div>
    {data.map(item => <Item key={item.id} item={item} />)}
  </div>
);

// ❌ 错误：复杂的条件渲染
return (
  <div>
    {loading ? !error ? data.length ? <List /> : <Empty /> : <Error /> : <Spinner />}
  </div>
);
```

### 3.3 自定义 Hooks

```javascript
// ✅ 正确：提取公共逻辑
// hooks/useFetch.js
import { useState, useEffect } from 'react';

export function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(response.statusText);
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [url]);

  return { data, loading, error };
}
```

### 3.4 API 请求规范

```javascript
// ✅ 正确：统一的API封装
// utils/api.js
const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (url) => request(url, { method: 'DELETE' }),
};
```

### 3.5 样式规范

```javascript
// ✅ 正确：使用 Tailwind CSS
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <span className="text-gray-800 dark:text-white">内容</span>
</div>

// ❌ 错误：内联样式混合
<div style={{ padding: '16px' }} className="flex">
  内容
</div>
```

### 3.6 事件处理

```javascript
// ✅ 正确：防抖处理
import { useCallback } from 'react';

function SearchComponent() {
  const [query, setQuery] = useState('');
  
  // 使用 useCallback 缓存函数
  const handleSearch = useCallback(
    debounce((value) => {
      // 搜索逻辑
    }, 300),
    []
  );
  
  return (
    <input onChange={(e) => handleSearch(e.target.value)} />
  );
}
```

### 3.7 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `Dashboard.js`, `ModelCard.js` |
| 组件名称 | PascalCase | `function Dashboard() {}` |
| Hooks | camelCase, use前缀 | `useFetch()`, `useDebounce()` |
| 工具函数 | camelCase | `formatDate()`, `validateForm()` |
| CSS类 | kebab-class | `flex items-center`, `p-4` |
| 常量 | UPPER_SNAKE | `MAX_FILE_SIZE` |

### 3.8 前端需要优化的点

| 序号 | 位置 | 问题 | 优化建议 |
|------|------|------|----------|
| 1 | 多处 | fetchData重复定义 | 创建 `hooks/useFetch.js` |
| 2 | `Settings.js` | 739行过大 | 拆分为 ProviderSettings, RouterSettings 等 |
| 3 | `Models.js` | 530行过大 | 拆分为 ModelCard, ModelModal 等 |
| 4 | `Strategies.js` | 517行过大 | 拆分为 StrategyCard, CandidateModal |
| 5 | 多处 | 颜色逻辑重复 | 创建 `utils/colors.js` |
| 6 | `ChatTest.js` | XSS风险 | 使用 DOMPurify 或纯文本渲染 |
| 7 | `App.js` | IPC监听未清理 | useEffect 返回 cleanup |
| 8 | 全局 | 无错误边界 | 创建 `ErrorBoundary.js` |
| 9 | 全局 | 无Toast组件 | 创建 `Toast.js` 统一提示 |
| 10 | `Logs.js` | index作为key | 使用 log.id |

---

## 四、Git 提交规范

### 4.1 提交信息格式

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

### 4.2 类型说明

| 类型 | 含义 |
|------|------|
| feat | 新功能 |
| fix | Bug修复 |
| docs | 文档更新 |
| style | 格式调整 |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具 |

### 4.3 示例

```
feat(models): 添加模型批量删除功能

fix(api): 修复日志截断无效的bug

refactor(settings): 拆分设置页面组件
```

---

## 五、文件命名规范

### 5.1 后端文件

| 文件类型 | 命名规则 | 示例 |
|----------|----------|------|
| 路由文件 | {resource}.routes.js | models.routes.js |
| 中间件 | {name}.middleware.js | auth.middleware.js |
| 服务类 | {name}.service.js | user.service.js |
| 工具函数 | {name}.util.js 或 {name}.helper.js | date.util.js |
| 配置文件 | config.{env}.js | config.development.js |

### 5.2 前端文件

| 文件类型 | 命名规则 | 示例 |
|----------|----------|------|
| 页面组件 | {Name}.js | Dashboard.js |
| 公共组件 | {Name}.js | Modal.js, Button.js |
| Hooks | use{Name}.js | useFetch.js |
| 工具函数 | {name}.js | format.js, validate.js |
| 常量 | {name}.constants.js | api.constants.js |
| 类型定义 | {Name}.types.js | Model.types.js |

---

## 六、注释规范

### 6.1 需要注释的场景

| 场景 | 说明 |
|------|------|
| 复杂业务逻辑 | 解释"为什么"而非"是什么" |
| 魔法数字 | 所有硬编码数值需说明含义 |
| TODO | 标记待完成项 |
| API接口 | 说明接口用途和参数 |

### 6.2 注释示例

```javascript
// ✅ 正确：解释为什么
// 使用 splice 而非 slice，因为需要原地修改数组
logs.splice(0, logs.length - MAX_LOG_SIZE);

// TODO: 优化 - 添加缓存层
async function getData() { ... }

// ❌ 错误：解释显而易见的事情
// 设置 name 为 value
setName(value);
```

---

## 七、测试规范

### 7.1 测试文件命名

```
{filename}.test.js      // 单元测试
{filename}.e2e.js       // 端到端测试
__mocks__/              // Mock 文件目录
```

### 7.2 测试覆盖

| 层级 | 测试内容 |
|------|----------|
| 工具函数 | 输入输出正确性 |
| API接口 | 响应格式、错误处理 |
| 组件 | 渲染、交互、状态 |

---

## 八、Electron 规范

### 8.1 项目结构

```
electron/
├── src/
│   ├── main.js          # 主进程
│   ├── preload.js       # 预加载脚本
│   ├── ipc/             # IPC处理
│   └── utils/           # 工具函数
├── package.json
└── build/               # 构建资源
```

### 8.2 进程通信规范

```javascript
// preload.js - 暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
    // 返回清理函数供 useEffect cleanup 使用
    return () => ipcRenderer.removeAllListeners('theme-changed');
  }
});

// renderer.js - 正确使用
useEffect(() => {
  const cleanup = window.electronAPI?.onThemeChanged?.((isDark) => {
    setTheme(isDark ? 'dark' : 'light');
  });
  return cleanup; // 组件卸载时清理
}, []);
```

### 8.3 Electron需要优化的点

| 序号 | 位置 | 问题 | 优化建议 |
|------|------|------|----------|
| 1 | `main.js:20,29` | 硬编码 gateway-core 路径 | 使用相对路径 `../server` |
| 2 | `main.js` | 215行过于庞大 | 拆分为 main/, ipc/, window/ 等模块 |
| 3 | `main.js:185` | 硬编码8000ms等待 | 实现健康检查轮询 |

---

## 九、配置规范

### 9.1 敏感配置

```
# ✅ 正确：使用环境变量
API_KEY=${OPENAI_API_KEY}
DB_PATH=./data/config.json

# ❌ 错误：硬编码敏感信息
API_KEY=sk-xxx123456789
```

### 9.2 配置文件

```javascript
// config/default.js
module.exports = {
  server: {
    port: process.env.PORT || 8080,
    timeout: 30000,
  },
  database: {
    path: process.env.DB_PATH || './data/config.json',
    maxLogs: 10000,
  },
  api: {
    retry: 3,
    timeout: 10000,
  }
};
```

---

## 十、检查清单

### 新增代码时检查

- [ ] 遵循本规范的命名规则
- [ ] 组件不超过300行
- [ ] 函数不超过50行
- [ ] 有适当的错误处理
- [ ] 无硬编码的敏感信息
- [ ] 使用 Tailwind 而非内联样式
- [ ] 使用自定义 Hook 提取重复逻辑

### 代码审查检查

- [ ] 无 console.log (调试用)
- [ ] 无 console.error (生产环境)
- [ ] 无未使用的变量
- [ ] React key 使用唯一ID
- [ ] useEffect 依赖数组完整
- [ ] API 响应有错误处理

---

*规范结束*
