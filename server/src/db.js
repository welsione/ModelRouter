const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const EXAMPLE_FILE = path.join(DATA_DIR, 'config.example.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function validateData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.models)) return false;
  if (!Array.isArray(data.strategies)) return false;
  if (!Array.isArray(data.candidates)) return false;
  if (!data.settings || typeof data.settings !== 'object') return false;
  return true;
}

function restoreFromExample() {
  try {
    if (fs.existsSync(EXAMPLE_FILE)) {
      const exampleData = JSON.parse(fs.readFileSync(EXAMPLE_FILE, 'utf-8'));
      if (validateData(exampleData)) {
        console.log('Restored data from config.example.json');
        return exampleData;
      }
    }
  } catch (err) {
    console.error('Error restoring from example:', err);
  }
  return initData();
}

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

ensureDir();

let db = null;
let logsDb = null;

function initDb() {
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

  if (!fs.existsSync(DATA_FILE)) {
    restoreFromExample();
    db.read();
  } else {
    const data = db.getState();
    if (!validateData(data)) {
      console.warn('Invalid data format, restoring from example...');
      restoreFromExample();
      db.read();
    }
  }

  const logsAdapter = new FileSync(LOGS_FILE);
  logsDb = low(logsAdapter);
  logsDb.defaults([]).write();

  if (!fs.existsSync(LOGS_FILE)) {
    logsDb.write();
  }
}

function getData() {
  if (!db) initDb();
  return db.getState();
}

function setData(data) {
  if (!db) initDb();
  db.setState(data).write();
  return true;
}

function getLogs() {
  if (!logsDb) initDb();
  return logsDb.getState() || [];
}

function setLogs(logs) {
  if (!logsDb) initDb();
  logsDb.setState(logs).write();
  return true;
}

function readSettings() {
  const STATIC_FILE = path.join(DATA_DIR, 'static.json');
  try {
    if (!fs.existsSync(STATIC_FILE)) {
      return { providerTemplates: [], defaults: {} };
    }
    const data = fs.readFileSync(STATIC_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading static settings:', err);
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
