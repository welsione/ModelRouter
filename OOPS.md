# OOPS - 代码问题清单

## 已修复

### ✅ 问题1: 日志数量限制未生效
**位置**: `server/src/index.js` 第 656, 783, 901 行
**状态**: 已修复

### ✅ 问题2: App.js 读取静态配置的路径错误
**位置**: `desktop-ui/src/App.js`
**状态**: 已修复

### ✅ 问题3: config.json 数据安全
**位置**: `server/src/index.js`
**状态**: 已修复 - 添加了 validateData() 和 restoreFromExample() 函数

---

## 待处理

### 6. ESLint 警告
- 多个页面有未使用的变量导入（不影响功能，可忽略）
- useEffect 缺少依赖数组（可忽略）

### 7. 服务重启自动拉起功能
**位置**: `server/src/index.js`

**问题**: 子进程启动方式可能不稳定，建议使用 PM2 等进程管理器

### 8. ChatTest 页面流式响应不生效
**位置**: `desktop-ui/src/pages/ChatTest.js`

**问题**: 前端接收到流式数据，但展示时不是流式的，而是一次性展示

**原因**: React 18 的自动批量更新 (Automatic Batching) 导致多个 setState 调用被合并，即使数据是逐个收到的，React 也会等到下一个事件周期才批量更新 UI

**尝试的解决方案**:
1. 使用 useRef 存储流式内容
2. 使用 flushSync 强制同步更新
3. 使用 setTimeout 延迟更新
4. 使用 requestAnimationFrame
5. 使用递归处理 chunk
6. 使用 forceUpdate (setRenderKey)
7. 直接操作 DOM

**状态**: 暂未解决

---

## 修复记录
- 2026-03-09: 修复问题 1, 2, 3
- 问题 4, 5 已有基本错误处理
- 问题 6, 7 可选优化
