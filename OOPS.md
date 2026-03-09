# OOPS - 代码问题清单

## 严重问题

### 1. 日志数量限制未生效
**位置**: `server/src/index.js` 第 656, 783, 901 行

**问题**: 日志限制使用 `logs.slice(-10000)` 但没有赋值回去，导致日志无限增长

```javascript
// 错误代码
if (logs.length > 10000) {
  logs.slice(-10000);  // 没有赋值！
}
```

**修复**: 
```javascript
if (logs.length > 10000) {
  logs = logs.slice(-10000);
}
```

---

### 2. App.js 读取静态配置的路径错误
**位置**: `desktop-ui/src/App.js` 第 23-26 行

**问题**: App.js 期望 `data.defaults.name`，但 `static.json` 中是 `defaults.app.name`

```javascript
// 当前代码 (错误)
if (data.defaults) {
  setAppConfig({
    name: data.defaults.name || 'ModelRouter',
    description: data.defaults.description || 'Smart Model Router'
  });
}
```

**修复**:
```javascript
if (data.defaults?.app) {
  setAppConfig({
    name: data.defaults.app.name || 'ModelRouter',
    description: data.defaults.app.description || 'Smart Model Router'
  });
}
```

---

### 3. server/data/config.json 不在 git 但会被意外覆盖
**位置**: `server/src/index.js`

**问题**: 服务重启或异常时 config.json 可能被清空或覆盖为无效数据

**修复**: 添加文件完整性检查，数据损坏时从 config.example.json 恢复

---

## 中等问题

### 4. 前端 fetch 错误处理不完整
**位置**: 多个 pages 文件

**问题**: 部分 fetch 没有正确处理网络错误，导致页面显示异常

---

### 5. 模型统计未持久化到 config.json
**位置**: `server/src/index.js`

**问题**: 模型用量统计只在内存中计算，重启后请求次数等统计数据会重置

---

## 待优化

### 6. ESLint 警告
- 多个页面有未使用的变量导入
- useEffect 缺少依赖数组

### 7. 服务重启自动拉起功能
**位置**: `server/src/index.js` 第 932-940 行

**问题**: 子进程启动方式可能不稳定，建议使用 PM2 等进程管理器

---

## 修复优先级
1. **高**: 问题 1, 2 (影响功能)
2. **中**: 问题 3 (数据安全)
3. **低**: 问题 4-7 (改进)
