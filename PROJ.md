# Gateway Core 项目文档

## 项目概述

Gateway Core 是一个智能模型路由网关，用于自动将用户请求路由到最适合的大语言模型（LLM）。支持多种模型（OpenAI、Ollama、自定义 API），并提供智能路由策略选择。

---

## 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Spring Boot 3.2.4 |
| AI 框架 | Spring AI 0.8.1 |
| 数据库 | MySQL / H2 (嵌入式) |
| 缓存 | Caffeine |
| 前端 | React 18 + TailwindCSS |
| 桌面 | Electron 28 |
| 构建 | Maven + electron-builder |

### 项目结构

```
gateway-core/
├── src/main/java/cn/welsione/modelauto/gateway/
│   ├── GatewayApplication.java          # Web 启动入口
│   ├── DesktopApplication.java         # 桌面模式启动入口
│   ├── api/
│   │   ├── controller/
│   │   │   ├── ChatController.java     # Chat API (OpenAI 兼容)
│   │   │   └── ConfigController.java   # 配置管理 API
│   │   └── config/
│   │       ├── CacheConfig.java       # 缓存配置
│   │       └── CorsConfig.java        # 跨域配置
│   └── core/
│       ├── router/
│       │   └── SmartModelRouter.java   # 智能路由核心逻辑
│       ├── factory/
│       │   └── ChatClientFactory.java  # ChatClient 工厂
│       ├── service/
│       │   ├── ContextPruner.java      # Token 裁剪
│       │   └── MetricsService.java    # 指标收集
│       ├── repository/
│       │   ├── ConfigRepository.java   # 数据仓库接口
│       │   └── impl/
│       │       ├── MysqlConfigRepository.java  # MySQL 实现
│       │       └── JsonFileConfigRepository.java # JSON 文件实现
│       ├── entity/                     # 实体类
│       ├── dto/                        # 数据传输对象
│       └── mapper/                     # MyBatis Plus Mapper
├── desktop-ui/                         # React 管理界面
│   ├── src/
│   │   ├── App.js                    # 主应用
│   │   └── pages/
│   │       ├── Dashboard.js           # 仪表盘
│   │       ├── Models.js              # 模型管理
│   │       ├── Strategies.js          # 路由策略
│   │       ├── Logs.js                # 请求日志
│   │       └── Settings.js            # 设置
│   └── public/
├── electron/                          # Electron 桌面应用
│   ├── src/
│   │   ├── main.js                   # 主进程
│   │   └── preload.js                 # 预加载脚本
│   └── package.json
└── pom.xml
```

---

## 核心功能

### 1. 智能路由 (SmartModelRouter)

根据配置的路由策略，自动选择最适合的模型处理用户请求。

**工作流程：**
1. 接收用户请求
2. 根据策略选择路由模型
3. 调用路由模型，让其分析请求并选择最佳模型
4. 将请求转发到选中的模型
5. 返回响应

**特性：**
- 支持非流式和流式响应
- 路由失败自动降级到备用模型
- 路由决策重试机制（最多 3 次）
- 异步日志记录

### 2. 模型管理

支持多种模型类型：
- **OpenAI**: GPT-4, GPT-3.5 等
- **Ollama**: 本地部署的模型
- **Cloud**: 兼容 OpenAI API 的第三方服务

**配置参数：**
| 参数 | 说明 |
|------|------|
| name | 显示名称 |
| type | 模型类型 (openai/ollama/cloud) |
| baseUrl | API 地址 |
| apiKey | API 密钥 |
| models | 模型名称 |
| temperature | 温度参数 |

### 3. 路由策略

定义如何选择模型的策略：

| 字段 | 说明 |
|------|------|
| name | 策略名称 |
| routerModelId | 路由使用的模型 ID |
| fallbackModelId | 备用模型 ID |
| promptTemplate | 自定义提示词模板 |
| isDefault | 是否默认策略 |

### 4. API 接口

#### Chat API (OpenAI 兼容)

```
POST /v1/chat/completions
```

请求体：
```json
{
  "model": "可选",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### 配置 API

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/config/models | GET | 获取所有模型 |
| /api/config/models | POST | 添加模型 |
| /api/config/models/{id} | DELETE | 删除模型 |
| /api/config/models/{id}/test | POST | 测试模型连接 |
| /api/config/strategies | GET | 获取所有策略 |
| /api/config/strategies | POST | 添加策略 |
| /api/config/strategies/{id} | DELETE | 删除策略 |
| /api/config/logs | GET | 获取路由日志 |

---

## 本地开发

### 1. 启动后端

```bash
cd gateway-core
mvn spring-boot:run
```

或运行 JAR：
```bash
java -jar target/gateway-core-1.0.0-SNAPSHOT.jar
```

后端地址：http://localhost:8080

### 2. 启动前端开发服务器

```bash
cd desktop-ui
npm start
```

前端地址：http://localhost:3000

### 3. 启动 Electron（可选）

```bash
cd electron
npm run dev
```

---

## 桌面应用构建

### macOS

```bash
cd electron
npm install electron@28 --save-dev
npx electron-builder --mac
```

输出：`dist/Gateway Core-1.0.0-arm64.dmg`

### Windows

```bash
cd electron
npm install electron@28 --save-dev
npx electron-builder --win
```

输出：`dist/Gateway Core Setup.exe`

---

## 配置说明

### 数据库配置 (application.properties)

```properties
# H2 嵌入式数据库（桌面版默认）
spring.datasource.url=jdbc:h2:file:./data/gateway-db
spring.datasource.driver-class-name=org.h2.Driver

# MySQL（生产环境）
spring.datasource.url=jdbc:mysql://localhost:3306/model_auto
spring.datasource.username=root
spring.datasource.password=12345678
```

### 缓存配置

- 模型配置缓存：5 分钟过期
- 策略缓存：5 分钟过期
- 候选模型缓存：5 分钟过期

---

## 性能优化

| 优化项 | 说明 |
|--------|------|
| ObjectMapper 单例 | 避免重复创建 |
| ChatClient 缓存 | 复用 HTTP 连接 |
| 异步日志 | 不阻塞请求 |
| Caffeine 缓存 | 减少数据库查询 |

---

## 待完成功能

- [x] 策略候选模型管理（前端页面）
- [x] 模型测试功能（前端页面 + API）
- [x] 路由策略高级配置（上下文限制、温度、超时、流式开关）
- [x] 请求日志详情查看
- [ ] 健康检查完善
- [ ] 监控指标面板
