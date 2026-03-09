const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8080;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 读取数据
function readData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      return initData();
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading data:', err);
    return initData();
  }
}

// 写入数据
function writeData(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing data:', err);
    return false;
  }
}

// 读取日志
function readLogs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOGS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading logs:', err);
    return [];
  }
}

// 写入日志
function writeLogs(logs) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing logs:', err);
    return false;
  }
}

// 初始化数据
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
  writeData(data);
  writeLogs([]);
  return data;
}

// ============ Models API ============

app.get('/api/config/models', (req, res) => {
  const data = readData();
  res.json(data.models || []);
});

app.get('/api/config/models/:id', (req, res) => {
  const data = readData();
  const model = (data.models || []).find(m => m.id === req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  res.json(model);
});

app.post('/api/config/models', (req, res) => {
  const data = readData();
  const model = req.body;
  model.id = model.id || uuidv4();
  model.createTime = new Date().toISOString();
  model.requestCount = model.requestCount || 0;
  model.totalTokens = model.totalTokens || 0;
  model.totalLatency = model.totalLatency || 0;
  model.avgLatency = model.avgLatency || 0;
  
  if (!data.models) data.models = [];
  data.models.push(model);
  writeData(data);
  
  res.json(model);
});

app.put('/api/config/models/:id', (req, res) => {
  const data = readData();
  const index = (data.models || []).findIndex(m => m.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  data.models[index] = { ...data.models[index], ...req.body };
  writeData(data);
  
  res.json(data.models[index]);
});

app.delete('/api/config/models/:id', (req, res) => {
  const data = readData();
  data.models = (data.models || []).filter(m => m.id !== req.params.id);
  writeData(data);
  
  res.json({ success: true });
});

app.post('/api/config/models/:id/test', async (req, res) => {
  const data = readData();
  const model = (data.models || []).find(m => m.id === req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      },
      body: JSON.stringify({
        model: model.models,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      
      const index = (data.models || []).findIndex(m => m.id === req.params.id);
      if (index !== -1) {
        data.models[index].requestCount = (data.models[index].requestCount || 0) + 1;
        data.models[index].lastLatency = latency;
        const totalLatency = (data.models[index].totalLatency || 0) + latency;
        data.models[index].totalLatency = totalLatency;
        data.models[index].avgLatency = Math.round(totalLatency / data.models[index].requestCount);
        writeData(data);
      }
      
      res.json({
        success: true,
        message: 'Test successful',
        response: result.choices?.[0]?.message?.content || 'OK',
        latency
      });
    } else {
      res.json({
        success: false,
        message: `Test failed: ${response.status}`,
        latency
      });
    }
  } catch (err) {
    const latency = Date.now() - startTime;
    res.json({
      success: false,
      message: `Test failed: ${err.message}`,
      latency
    });
  }
});

app.get('/api/config/models/:id/stats', (req, res) => {
  const data = readData();
  const model = (data.models || []).find(m => m.id === req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const allLogs = readLogs();
  const modelLogs = allLogs.filter(l => l.selectedModelId === req.params.id);
  
  const byStrategy = {};
  let totalTokensFromLogs = 0;
  let totalLatency = 0;
  modelLogs.forEach(log => {
    const strategyId = log.strategyId || 'unknown';
    byStrategy[strategyId] = (byStrategy[strategyId] || 0) + 1;
    totalTokensFromLogs += log.tokens || 0;
    totalLatency += log.latency || 0;
  });
  
  res.json({
    config: model,
    requestCount: modelLogs.length,
    totalTokens: totalTokensFromLogs,
    totalRequests: modelLogs.length,
    avgLatency: modelLogs.length > 0 ? Math.round(totalLatency / modelLogs.length) : 0,
    byStrategy,
    recentLogs: modelLogs.slice(0, 50)
  });
});

// ============ Router Config API (Legacy) ============

app.get('/api/config/router', (req, res) => {
  const data = readData();
  res.json(data.router || { id: 1, systemPrompt: 'Default Router Prompt' });
});

app.post('/api/config/router', (req, res) => {
  const data = readData();
  data.router = { ...data.router, ...req.body, id: 1 };
  writeData(data);
  res.json(data.router);
});

// ============ Strategies API ============

app.get('/api/config/strategies', (req, res) => {
  const data = readData();
  res.json(data.strategies || []);
});

app.get('/api/config/strategies/:id', (req, res) => {
  const data = readData();
  const strategy = (data.strategies || []).find(s => s.id === req.params.id);
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  res.json(strategy);
});

app.post('/api/config/strategies', (req, res) => {
  const data = readData();
  const strategy = req.body;
  strategy.id = strategy.id || uuidv4();
  strategy.createTime = new Date().toISOString();
  
  if (!data.strategies) data.strategies = [];
  data.strategies.push(strategy);
  writeData(data);
  
  res.json(strategy);
});

app.put('/api/config/strategies/:id', (req, res) => {
  const data = readData();
  const index = (data.strategies || []).findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  
  data.strategies[index] = { ...data.strategies[index], ...req.body };
  writeData(data);
  
  res.json(data.strategies[index]);
});

app.delete('/api/config/strategies/:id', (req, res) => {
  const data = readData();
  data.strategies = (data.strategies || []).filter(s => s.id !== req.params.id);
  data.candidates = (data.candidates || []).filter(c => c.strategyId !== req.params.id);
  writeData(data);
  
  res.json({ success: true });
});

app.get('/api/config/strategies/:strategyId/candidates', (req, res) => {
  const data = readData();
  const candidates = (data.candidates || []).filter(c => c.strategyId === req.params.strategyId);
  res.json(candidates);
});

// ============ Candidates API ============

app.post('/api/config/candidates', (req, res) => {
  const data = readData();
  const candidate = req.body;
  candidate.id = candidate.id || uuidv4();
  candidate.createTime = new Date().toISOString();
  
  if (!data.candidates) data.candidates = [];
  data.candidates.push(candidate);
  writeData(data);
  
  res.json(candidate);
});

app.put('/api/config/candidates/:id', (req, res) => {
  const data = readData();
  const index = (data.candidates || []).findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  
  data.candidates[index] = { ...data.candidates[index], ...req.body };
  writeData(data);
  
  res.json(data.candidates[index]);
});

app.delete('/api/config/candidates/:id', (req, res) => {
  const data = readData();
  data.candidates = (data.candidates || []).filter(c => c.id !== req.params.id);
  writeData(data);
  
  res.json({ success: true });
});

// ============ Logs API ============

app.get('/api/config/logs', (req, res) => {
  const logs = readLogs();
  logs.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  res.json(logs);
});

// ============ App Settings API (static) ============

const STATIC_FILE = path.join(DATA_DIR, 'static.json');

function readSettings() {
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

app.get('/api/app/settings', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// 合并静态配置和用户配置
app.get('/api/config/settings', (req, res) => {
  const data = readData();
  const appSettings = readSettings();
  
  const merged = {
    ...appSettings.defaults,
    ...data.settings,
    providerConfigs: data.settings?.providerConfigs || {}
  };
  res.json(merged);
});

app.post('/api/config/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  
  res.json(data.settings);
});

// ============ Helper Functions ============

// 简单token估算
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// 构建候选模型上下文
function buildCandidateContext(candidates, models) {
  return candidates.map(c => {
    const model = models.find(m => m.id === c.modelConfigId);
    const modelName = model?.name || c.modelConfigId;
    return `- ID: ${c.modelConfigId}, Name: ${modelName}, Description: ${c.description || '无描述'}, Priority: ${c.priority || 50}, Weight: ${c.weight || 1.0}`;
  }).join('\n');
}

// AI路由选择模型
async function routeWithAI(strategy, candidates, models, settings) {
  if (!settings.routerModelApiKey || !settings.routerModelName || !settings.routerModelBaseUrl) {
    throw new Error('Router model not configured');
  }

  const candidateContext = buildCandidateContext(candidates, models);
  
  const systemPrompt = strategy.promptTemplate || `你是一个智能模型路由器。根据用户查询，从候选模型中选择最合适的一个。`;
  
  const response = await fetch(`${settings.routerModelBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.routerModelApiKey}`
    },
    body: JSON.stringify({
      model: settings.routerModelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `候选模型:\n${candidateContext}\n\n请根据以上候选模型信息，为用户查询选择最合适的模型，并说明理由。\n\n请以JSON格式返回，格式如下：\n{"selected_model_id": "模型ID", "reason": "选择理由"}` }
      ],
      temperature: settings.routerModelTemperature || 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Router request failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  
  // 解析JSON响应
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse router response:', e);
  }
  
  // 尝试从内容中提取模型ID
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('selected_model_id') || line.includes('model') || line.includes('ID')) {
      const idMatch = line.match(/["']?([a-zA-Z0-9_-]+)["']?\s*:/);
      if (idMatch) {
        const modelId = idMatch[1];
        if (candidates.find(c => c.modelConfigId === modelId)) {
          return { selected_model_id: modelId, reason: '从响应中提取' };
        }
      }
    }
  }
  
  // 默认返回第一个候选
  return { 
    selected_model_id: candidates[0]?.modelConfigId, 
    reason: '默认选择第一个候选模型' 
  };
}

// 选择候选模型（简单策略：优先级+权重）
function selectCandidateSimple(candidates) {
  if (!candidates || candidates.length === 0) return null;
  
  // 按优先级和权重排序
  const sorted = [...candidates].sort((a, b) => {
    const priorityA = a.priority || 50;
    const priorityB = b.priority || 50;
    const weightA = a.weight || 1.0;
    const weightB = b.weight || 1.0;
    return (priorityB * weightB) - (priorityA * weightA);
  });
  
  return sorted[0];
}

// ============ Chat API (OpenAI Compatible) ============

app.post('/v1/chat/completions', async (req, res) => {
  const data = readData();
  const settings = data.settings || {};
  
  const {
    messages,
    model: requestedModel,
    temperature = 0.7,
    max_tokens = 2048,
    stream = false,
    strategyId
  } = req.body;
  
  // 确定策略
  let strategy = null;
  if (strategyId) {
    strategy = (data.strategies || []).find(s => s.id === strategyId);
  }
  if (!strategy) {
    strategy = (data.strategies || []).find(s => s.isDefault);
  }
  if (!strategy) {
    strategy = (data.strategies || [])[0];
  }
  
  // 获取候选模型
  let candidates = [];
  if (strategy) {
    candidates = (data.candidates || []).filter(c => c.strategyId === strategy.id && c.enabled !== false);
  }
  
  // 如果没有候选，从所有模型中选择
  if (candidates.length === 0) {
    candidates = (data.models || []).filter(m => m.enabled !== false).map(m => ({
      modelConfigId: m.id,
      description: m.name
    }));
  }
  
  if (candidates.length === 0) {
    return res.status(400).json({ 
      error: { message: 'No available models', type: 'invalid_request_error' }
    });
  }
  
  // 路由选择模型
  let selectedCandidate = null;
  let routeReason = '';
  
  try {
    // 尝试AI路由
    const models = data.models || [];
    const routeResult = await routeWithAI(strategy, candidates, models, settings);
    selectedCandidate = candidates.find(c => c.modelConfigId === routeResult.selected_model_id);
    routeReason = routeResult.reason || 'AI路由';
  } catch (e) {
    console.log('AI routing failed, using simple strategy:', e.message);
    // 回退到简单策略
    selectedCandidate = selectCandidateSimple(candidates);
    routeReason = '简单路由（AI路由失败）';
  }
  
  // 如果仍未选择，使用第一个
  if (!selectedCandidate) {
    selectedCandidate = candidates[0];
    routeReason = '默认选择';
  }
  
  // 获取模型配置
  const modelConfig = (data.models || []).find(m => m.id === selectedCandidate.modelConfigId);
  if (!modelConfig) {
    return res.status(400).json({ 
      error: { message: 'Model not found', type: 'invalid_request_error' }
    });
  }
  
  // 准备请求到目标模型
  const modelMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return msg;
    }
    // 处理多模态消息
    return msg;
  });
  
  const startTime = Date.now();
  
  // 如果请求流式响应
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
      const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${modelConfig.apiKey}`
        },
        body: JSON.stringify({
          model: modelConfig.models,
          messages: modelMessages,
          temperature: strategy?.temperature ?? temperature,
          max_tokens: strategy?.maxContextTokens ?? max_tokens,
          stream: true
        })
      });
      
      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ error: { message: `Model request failed: ${response.status}` } })}\n\n`);
        res.end();
        return;
      }
      
      const reader = response.body.getReader();
      const encoder = new TextEncoder();
      let fullContent = '';
      let firstChunk = true;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // 记录日志
              const latency = Date.now() - startTime;
              const log = {
                id: uuidv4(),
                strategyId: strategy?.id,
                selectedModelId: modelConfig.id,
                userPrompt: messages[messages.length - 1]?.content || '',
                systemPrompt: strategy?.promptTemplate || '',
                createTime: new Date().toISOString(),
                latency,
                tokens: estimateTokens(fullContent)
              };
              
      const logs = readLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs = logs.slice(-10000);
      }
      writeLogs(logs);
              
              const modelIndex = (data.models || []).findIndex(m => m.id === modelConfig.id);
              if (modelIndex !== -1) {
                data.models[modelIndex].requestCount = (data.models[modelIndex].requestCount || 0) + 1;
                data.models[modelIndex].lastLatency = latency;
                const totalLatency = (data.models[modelIndex].totalLatency || 0) + latency;
                data.models[modelIndex].totalLatency = totalLatency;
                data.models[modelIndex].avgLatency = Math.round(totalLatency / data.models[modelIndex].requestCount);
              }
              
              writeData(data);
              
              res.write(`data: ${JSON.stringify({ 
                id: `chatcmpl-${log.id}`, 
                object: 'chat.completion.chunk', 
                created: Math.floor(Date.now() / 1000),
                model: modelConfig.models,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                routing: {
                  strategyId: strategy?.id,
                  selectedModelId: modelConfig.id,
                  selectedModelName: modelConfig.name,
                  reason: '流式响应'
                }
              })}\n\n`);
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                fullContent += parsed.choices[0].delta.content;
              }
              
              if (firstChunk) {
                res.write(`data: ${JSON.stringify({
                  id: `chatcmpl-${uuidv4()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: modelConfig.models,
                  choices: [{
                    index: 0,
                    delta: {
                      role: 'assistant',
                      content: parsed.choices?.[0]?.delta?.content || ''
                    },
                    finish_reason: null
                  }],
                  routing: {
                    strategyId: strategy?.id,
                    selectedModelId: modelConfig.id,
                    selectedModelName: modelConfig.name,
                    reason: '流式响应'
                  }
                })}\n\n`);
                firstChunk = false;
              } else {
                res.write(`data: ${JSON.stringify({
                  id: `chatcmpl-${uuidv4()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: modelConfig.models,
                  choices: [{
                    index: 0,
                    delta: {
                      content: parsed.choices?.[0]?.delta?.content || ''
                    },
                    finish_reason: null
                  }]
                })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
      res.end();
    }
    return;
  }
  
  // 非流式响应
  try {
    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.models,
        messages: modelMessages,
        temperature: strategy?.temperature ?? temperature,
        max_tokens: strategy?.maxContextTokens ?? max_tokens,
        stream: false
      })
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      const reply = result.choices?.[0]?.message?.content || '';
      const usage = result.usage || {};
      
      // 记录日志
      const log = {
        id: uuidv4(),
        strategyId: strategy?.id,
        selectedModelId: modelConfig.id,
        userPrompt: messages[messages.length - 1]?.content || '',
        systemPrompt: strategy?.promptTemplate || '',
        createTime: new Date().toISOString(),
        latency,
        tokens: usage.total_tokens || estimateTokens(reply)
      };
      
      const logs = readLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs.slice(-10000);
      }
      writeLogs(logs);
      
      // 更新模型统计
      const modelIndex = (data.models || []).findIndex(m => m.id === modelConfig.id);
      if (modelIndex !== -1) {
        data.models[modelIndex].requestCount = (data.models[modelIndex].requestCount || 0) + 1;
        data.models[modelIndex].totalTokens = (data.models[modelIndex].totalTokens || 0) + (usage.total_tokens || 0);
        data.models[modelIndex].lastLatency = latency;
        const totalLatency = (data.models[modelIndex].totalLatency || 0) + latency;
        data.models[modelIndex].totalLatency = totalLatency;
        data.models[modelIndex].avgLatency = Math.round(totalLatency / data.models[modelIndex].requestCount);
      }
      
      writeData(data);
      
      // 返回响应
      res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelConfig.models,
        choices: result.choices,
        usage: usage,
        routing: {
          strategyId: strategy?.id,
          selectedModelId: modelConfig.id,
          selectedModelName: modelConfig.name,
          reason: routeReason
        }
      });
    } else {
      const errorText = await response.text();
      res.status(response.status).json({ 
        error: { message: `Model request failed: ${errorText}`, type: 'api_error' }
      });
    }
  } catch (err) {
    res.status(500).json({ 
      error: { message: err.message, type: 'server_error' }
    });
  }
});

// 简单的聊天接口（遗留）
app.post('/api/chat', async (req, res) => {
  const { message, strategyId } = req.body;
  
  const data = readData();
  
  let strategy = null;
  if (strategyId) {
    strategy = (data.strategies || []).find(s => s.id === strategyId);
  }
  if (!strategy) {
    strategy = (data.strategies || []).find(s => s.isDefault);
  }
  
  let candidates = [];
  if (strategy) {
    candidates = (data.candidates || []).filter(c => c.strategyId === strategy.id && c.enabled !== false);
  }
  
  if (candidates.length === 0) {
    candidates = (data.models || []).filter(m => m.enabled !== false).slice(0, 1).map(m => ({
      modelConfigId: m.id,
      description: m.name
    }));
  }
  
  if (candidates.length === 0) {
    return res.status(400).json({ error: 'No available models' });
  }
  
  const selectedCandidate = selectCandidateSimple(candidates);
  const model = (data.models || []).find(m => m.id === selectedCandidate.modelConfigId);
  
  if (!model) {
    return res.status(400).json({ error: 'Model not found' });
  }
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      },
      body: JSON.stringify({
        model: model.models,
        messages: [{ role: 'user', content: message }],
        temperature: model.temperature || 0.7
      })
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      const reply = result.choices?.[0]?.message?.content || '';
      
      const log = {
        id: uuidv4(),
        strategyId: strategy?.id,
        selectedModelId: model.id,
        userPrompt: message,
        systemPrompt: strategy?.promptTemplate || '',
        createTime: new Date().toISOString(),
        latency,
        tokens: estimateTokens(reply)
      };
      
      const logs = readLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs.slice(-10000);
      }
      writeLogs(logs);
      
      const modelIndex = (data.models || []).findIndex(m => m.id === model.id);
      if (modelIndex !== -1) {
        data.models[modelIndex].requestCount = (data.models[modelIndex].requestCount || 0) + 1;
        data.models[modelIndex].totalTokens = (data.models[modelIndex].totalTokens || 0) + (log.tokens || 0);
        data.models[modelIndex].lastLatency = latency;
        const totalLatency = (data.models[modelIndex].totalLatency || 0) + latency;
        data.models[modelIndex].totalLatency = totalLatency;
        data.models[modelIndex].avgLatency = Math.round(totalLatency / data.models[modelIndex].requestCount);
      }
      
      writeData(data);
      
      res.json({
        message: reply,
        model: model.name,
        latency,
        tokens: log.tokens
      });
    } else {
      res.status(response.status).json({ error: 'Model request failed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ System API ============

app.post('/api/system/restart', (req, res) => {
  console.log('Restart requested...');
  res.json({ message: 'Server restarting...' });
  
  setTimeout(() => {
    const child = require('child_process').spawn(
      process.execPath,
      [__filename],
      { cwd: process.cwd(), detached: true, stdio: 'ignore' }
    );
    child.unref();
    process.exit(0);
  }, 1000);
});

// ============ 启动服务器 ============

app.listen(PORT, () => {
  console.log(`Gateway Core API Server running on http://localhost:${PORT}`);
});
