/**
 * Database Module - 数据库模块
 * 使用 lowdb (基于 JSON 文件的数据存储)
 * 
 * 数据结构:
 * - config.json: models, strategies, candidates, settings
 * - logs.json: 请求日志
 * - static.json: 静态配置 (providerTemplates, defaults)
 */

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const logger = require('./logger');

// 数据目录和文件路径
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'config.json');     // 主配置文件
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');       // 日志文件
const EXAMPLE_FILE = path.join(DATA_DIR, 'config.example.json'); // 示例配置

/**
 * 确保数据目录存在
 */
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 验证数据结构完整性
 * @param {Object} data - 待验证的数据对象
 * @returns {boolean} - 是否有效
 */
function validateData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.models)) return false;
  if (!Array.isArray(data.strategies)) return false;
  if (!Array.isArray(data.candidates)) return false;
  if (!data.settings || typeof data.settings !== 'object') return false;
  return true;
}

/**
 * 从示例文件恢复数据
 * @returns {Object} - 恢复的数据或初始化数据
 */
function restoreFromExample() {
  try {
    if (fs.existsSync(EXAMPLE_FILE)) {
      const exampleData = JSON.parse(fs.readFileSync(EXAMPLE_FILE, 'utf-8'));
      if (validateData(exampleData)) {
        logger.info('Restored data from config.example.json');
        return exampleData;
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error restoring from example');
  }
  return initData();
}

/**
 * 初始化默认数据
 * @returns {Object} - 默认数据结构
 */
function initData() {
  const data = {
    models: [],
    strategies: [],
    candidates: [],
    settings: {
      id: 'default',
      providerConfigs: {},
      routerModelType: '',
      routerModelBaseUrl: '',
      routerModelApiKey: '',
      routerModelName: '',
      routerModelTemperature: 0.7
    }
  };
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
  return data;
}

// 初始化数据目录
ensureDir();

// 数据库实例
let db = null;
let logsDb = null;

/**
 * 初始化数据库连接
 * 使用 lowdb 的 FileSync 适配器
 */
function initDb() {
  // 初始化主数据库
  const adapter = new FileSync(DATA_FILE);
  db = low(adapter);
  db.defaults({
    models: [],
    strategies: [],
    candidates: [],
    settings: {
      id: 'default',
      providerConfigs: {},
      routerModelType: '',
      routerModelBaseUrl: '',
      routerModelApiKey: '',
      routerModelName: '',
      routerModelTemperature: 0.7
    }
  }).write();

  // 检查数据文件有效性
  if (!fs.existsSync(DATA_FILE)) {
    restoreFromExample();
    db.read();
  } else {
    const data = db.getState();
    if (!validateData(data)) {
      logger.warn('Invalid data format, restoring from example');
      restoreFromExample();
      db.read();
    }
  }

  // 初始化日志数据库
  const logsAdapter = new FileSync(LOGS_FILE);
  logsDb = low(logsAdapter);
  logsDb.defaults([]).write();

  if (!fs.existsSync(LOGS_FILE)) {
    logsDb.write();
  }
}

/**
 * 获取主数据
 * @returns {Object} - 当前数据状态
 */
function getData() {
  if (!db) initDb();
  return db.getState();
}

/**
 * 设置主数据
 * @param {Object} data - 数据对象
 * @returns {boolean} - 是否成功
 */
function setData(data) {
  if (!db) initDb();
  db.setState(data).write();
  return true;
}

/**
 * 获取日志数据
 * @returns {Array} - 日志数组
 */
function getLogs() {
  if (!logsDb) initDb();
  return logsDb.getState() || [];
}

/**
 * 设置日志数据
 * @param {Array} logs - 日志数组
 * @returns {boolean} - 是否成功
 */
function setLogs(logs) {
  if (!logsDb) initDb();
  logsDb.setState(logs).write();
  return true;
}

/**
 * 读取静态配置文件 (static.json)
 * @returns {Object} - 静态配置
 */
function readSettings() {
  const STATIC_FILE = path.join(DATA_DIR, 'static.json');
  try {
    if (!fs.existsSync(STATIC_FILE)) {
      return { providerTemplates: [], defaults: {} };
    }
    const data = fs.readFileSync(STATIC_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    logger.error({ err }, 'Error reading static settings');
    return { providerTemplates: [], defaults: {} };
  }
}

module.exports = {
  getData,
  setData,
  getLogs,
  setLogs,
  readSettings,
  initDb
};
