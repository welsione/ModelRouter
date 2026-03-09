/**
 * Logger Module - 日志模块
 * 使用 pino 进行结构化日志记录
 * 
 * 日志级别: fatal > error > warn > info > debug > trace
 * 输出: 控制台 + 文件 (app.log, error.log)
 */

const pino = require('pino');
const path = require('path');
const fs = require('fs');

// 日志目录和文件路径
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERROR_FILE = path.join(LOG_DIR, 'error.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 创建 pino 日志实例
const logger = pino({
  // 日志级别: 从环境变量读取，默认为 info
  level: process.env.LOG_LEVEL || 'info',
  
  // 传输配置 - 同时输出到控制台和文件
  transport: {
    targets: [
      // 控制台输出 (info级别及以上)
      {
        target: 'pino/file',
        level: 'info',
        options: { destination: 1 } // stdout
      },
      // 文件输出 - 错误日志单独存储
      {
        target: 'pino/file',
        level: 'error',
        options: { dest: ERROR_FILE, mkdir: true }
      },
      // 文件输出 - 全部日志
      {
        target: 'pino/file', 
        level: 'info',
        options: { dest: LOG_FILE, mkdir: true }
      }
    ]
  },
  
  // 自定义时间戳格式 (ISO 8601)
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  
  // 基础元数据
  base: { pid: process.pid }
});

module.exports = logger;
