/**
 * Gateway Core API Server
 * 智能模型路由后端服务
 * 
 * 功能:
 * - 模型配置管理
 * - 路由策略配置
 * - AI智能路由
 * - 请求日志记录
 * 
 * 端口: 8080 (可通过环境变量 PORT 修改)
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS 中间件 - 允许跨域请求
app.use(cors());

// JSON 解析中间件 - 支持最大 10MB 的请求体
app.use(express.json({ limit: '10mb' }));

/**
 * 请求日志中间件
 * 记录每个 HTTP 请求的方法、URL、状态码和响应时间
 */
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

// 初始化数据库
db.initDb();

logger.info(`Server starting on port ${PORT}`);

// ============ Models API ============

app.get('/api/config/models', (req, res) => {
  const data = db.getData();
  res.json(data.models || []);
});

app.get('/api/config/models/:id', (req, res) => {
  const data = db.getData();
  const model = (data.models || []).find(m => m.id === req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  res.json(model);
});

app.post('/api/config/models', (req, res) => {
  const data = db.getData();
  const model = req.body;
  model.id = model.id || uuidv4();
  model.createTime = new Date().toISOString();
  model.requestCount = model.requestCount || 0;
  model.totalTokens = model.totalTokens || 0;
  model.totalLatency = model.totalLatency || 0;
  model.avgLatency = model.avgLatency || 0;
  
  if (!data.models) data.models = [];
  data.models.push(model);
  db.setData(data);
  
  res.json(model);
});

app.put('/api/config/models/:id', (req, res) => {
  const data = db.getData();
  const index = (data.models || []).findIndex(m => m.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  data.models[index] = { ...data.models[index], ...req.body };
  db.setData(data);
  
  res.json(data.models[index]);
});

app.delete('/api/config/models/:id', (req, res) => {
  const data = db.getData();
  data.models = (data.models || []).filter(m => m.id !== req.params.id);
  db.setData(data);
  
  res.json({ success: true });
});

app.post('/api/config/models/:id/test', async (req, res) => {
  const data = db.getData();
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
        db.setData(data);
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
  const data = db.getData();
  const model = (data.models || []).find(m => m.id === req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const allLogs = db.getLogs();
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
  const data = db.getData();
  res.json(data.router || { id: 1, systemPrompt: 'Default Router Prompt' });
});

app.post('/api/config/router', (req, res) => {
  const data = db.getData();
  data.router = { ...data.router, ...req.body, id: 1 };
  db.setData(data);
  res.json(data.router);
});

// ============ Strategies API ============

app.get('/api/config/strategies', (req, res) => {
  const data = db.getData();
  res.json(data.strategies || []);
});

app.get('/api/config/strategies/:id', (req, res) => {
  const data = db.getData();
  const strategy = (data.strategies || []).find(s => s.id === req.params.id);
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  res.json(strategy);
});

app.post('/api/config/strategies', (req, res) => {
  const data = db.getData();
  const strategy = req.body;
  strategy.id = strategy.id || uuidv4();
  strategy.createTime = new Date().toISOString();
  
  if (!data.strategies) data.strategies = [];
  data.strategies.push(strategy);
  db.setData(data);
  
  res.json(strategy);
});

app.put('/api/config/strategies/:id', (req, res) => {
  const data = db.getData();
  const index = (data.strategies || []).findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  
  data.strategies[index] = { ...data.strategies[index], ...req.body };
  db.setData(data);
  
  res.json(data.strategies[index]);
});

app.delete('/api/config/strategies/:id', (req, res) => {
  const data = db.getData();
  data.strategies = (data.strategies || []).filter(s => s.id !== req.params.id);
  data.candidates = (data.candidates || []).filter(c => c.strategyId !== req.params.id);
  db.setData(data);
  
  res.json({ success: true });
});

app.get('/api/config/strategies/:strategyId/candidates', (req, res) => {
  const data = db.getData();
  const candidates = (data.candidates || []).filter(c => c.strategyId === req.params.strategyId);
  res.json(candidates);
});

// ============ Candidates API ============

app.post('/api/config/candidates', (req, res) => {
  const data = db.getData();
  const candidate = req.body;
  candidate.id = candidate.id || uuidv4();
  candidate.createTime = new Date().toISOString();
  
  if (!data.candidates) data.candidates = [];
  data.candidates.push(candidate);
  db.setData(data);
  
  res.json(candidate);
});

app.put('/api/config/candidates/:id', (req, res) => {
  const data = db.getData();
  const index = (data.candidates || []).findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  
  data.candidates[index] = { ...data.candidates[index], ...req.body };
  db.setData(data);
  
  res.json(data.candidates[index]);
});

app.delete('/api/config/candidates/:id', (req, res) => {
  const data = db.getData();
  data.candidates = (data.candidates || []).filter(c => c.id !== req.params.id);
  db.setData(data);
  
  res.json({ success: true });
});

// ============ Logs API ============

app.get('/api/config/logs', (req, res) => {
  const logs = db.getLogs();
  logs.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  res.json(logs);
});

// ============ App Settings API (static) ============

app.get('/api/app/settings', (req, res) => {
  const settings = db.readSettings();
  res.json(settings);
});

// 合并静态配置和用户配置
app.get('/api/config/settings', (req, res) => {
  const data = db.getData();
  const appSettings = db.readSettings();
  
  const merged = {
    ...appSettings.defaults,
    ...data.settings,
    providerConfigs: data.settings?.providerConfigs || {}
  };
  res.json(merged);
});

app.post('/api/config/settings', (req, res) => {
  const data = db.getData();
  data.settings = { ...data.settings, ...req.body };
  db.setData(data);
  
  res.json(data.settings);
});

// ============ Helper Functions ============

/**
 * 简单token估算函数
 * 估算公式: 字符数 / 4 (中文约等于1个字符=1个token)
 * @param {string} text - 待估算的文本
 * @returns {number} - 估算的token数量
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * 构建候选模型上下文
 * 将候选模型列表格式化为AI路由可理解的文本描述
 * @param {Array} candidates - 候选模型列表
 * @param {Array} models - 所有模型配置
 * @returns {string} - 格式化的候选模型描述
 */
function buildCandidateContext(candidates, models) {
  return candidates.map(c => {
    const model = models.find(m => m.id === c.modelConfigId);
    const modelName = model?.name || c.modelConfigId;
    return `- ID: ${c.modelConfigId}, Name: ${modelName}, Description: ${c.description || '无描述'}, Priority: ${c.priority || 50}, Weight: ${c.weight || 1.0}`;
  }).join('\n');
}

/**
 * AI路由选择模型
 * 使用大语言模型根据用户查询智能选择最合适的模型
 * @param {Object} strategy - 路由策略配置
 * @param {Array} candidates - 候选模型列表
 * @param {Array} models - 所有模型配置
 * @param {Object} settings - 系统设置
 * @returns {Object} - { selected_model_id, reason }
 */
async function routeWithAI(strategy, candidates, models, settings) {
  // 检查路由模型是否已配置
  if (!settings.routerModelApiKey || !settings.routerModelName || !settings.routerModelBaseUrl) {
    throw new Error('Router model not configured');
  }

  const candidateContext = buildCandidateContext(candidates, models);
  
  // 组合提示词: 选择规则 + 候选模型列表 + 输出格式
  const systemPrompt = strategy.promptTemplate || '你是一个智能模型路由器，根据用户问题从候选模型中选择最合适的一个。';
  
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
        { role: 'user', content: `候选模型:\n${candidateContext}\n\n请根据上述候选模型信息，为用户选择最合适的模型。\n\n输出格式（必须严格遵守）：{"selected_model_id": "模型ID", "reason": "选择理由"}` }
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
    logger.error({ err: e }, 'Failed to parse router response');
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

/**
 * 简单路由选择策略
 * 根据候选模型的 priority (优先级) 和 weight (权重) 计算得分进行排序
 * 得分公式: priority * weight
 * 
 * @param {Array} candidates - 候选模型列表
 * @returns {Object|null} - 选中的候选模型
 */
function selectCandidateSimple(candidates) {
  if (!candidates || candidates.length === 0) return null;
  
  // 按优先级和权重计算得分排序 (得分越高越优先)
  const sorted = [...candidates].sort((a, b) => {
    const priorityA = a.priority || 50;
    const priorityB = b.priority || 50;
    const weightA = a.weight || 1.0;
    const weightB = b.weight || 1.0;
    return (priorityB * weightB) - (priorityA * weightA);
  });
  
  return sorted[0];
}

/**
 * Chat API - OpenAI 兼容的聊天接口
 * 
 * 支持功能:
 * - AI智能路由 (routeWithAI)
 * - 简单路由 (selectCandidateSimple)
 * - 流式响应 (Server-Sent Events)
 * - 请求日志记录
 * 
 * 请求参数:
 * - messages: 消息数组
 * - model: 指定模型ID (可选)
 * - temperature: 温度参数
 * - max_tokens: 最大token数
 * - stream: 是否流式响应
 * - strategyId: 指定策略ID (可选)
 */

// ============ Chat API (OpenAI Compatible) ============

app.post('/v1/chat/completions', async (req, res) => {
  const data = db.getData();
  const settings = data.settings || {};
  
  // 解析请求参数
  const {
    messages,
    model: requestedModel,
    temperature = 0.7,
    max_tokens = 2048,
    stream = false,
    strategyId
  } = req.body;
  
  // 确定使用的策略 (优先级: 指定ID > 默认标记 > 第一个)
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
    logger.warn({ err: e }, 'AI routing failed, using simple strategy');
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
            const streamData = line.slice(6);
            if (streamData === '[DONE]') {
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
              
      const logs = db.getLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs.splice(0, logs.length - 10000);
      }
      db.setLogs(logs);
              
              const modelData = db.getData();
              const modelIndex = (modelData.models || []).findIndex(m => m.id === modelConfig.id);
              if (modelIndex !== -1) {
                modelData.models[modelIndex].requestCount = (modelData.models[modelIndex].requestCount || 0) + 1;
                modelData.models[modelIndex].lastLatency = latency;
                const totalLatency = (modelData.models[modelIndex].totalLatency || 0) + latency;
                modelData.models[modelIndex].totalLatency = totalLatency;
                modelData.models[modelIndex].avgLatency = Math.round(totalLatency / modelData.models[modelIndex].requestCount);
              }
              
              db.setData(modelData);
              
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
              const parsed = JSON.parse(streamData);
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
      
      const logs = db.getLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs.slice(-10000);
      }
      db.setLogs(logs);
      
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
      
      db.setData(data);
      
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
  
  const data = db.getData();
  
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
      
      const logs = db.getLogs();
      logs.push(log);
      if (logs.length > 10000) {
        logs.slice(-10000);
      }
      db.setLogs(logs);
      
      const modelIndex = (data.models || []).findIndex(m => m.id === model.id);
      if (modelIndex !== -1) {
        data.models[modelIndex].requestCount = (data.models[modelIndex].requestCount || 0) + 1;
        data.models[modelIndex].totalTokens = (data.models[modelIndex].totalTokens || 0) + (log.tokens || 0);
        data.models[modelIndex].lastLatency = latency;
        const totalLatency = (data.models[modelIndex].totalLatency || 0) + latency;
        data.models[modelIndex].totalLatency = totalLatency;
        data.models[modelIndex].avgLatency = Math.round(totalLatency / data.models[modelIndex].requestCount);
      }
      
      db.setData(data);
      
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
  logger.warn('Restart requested via API');
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

// ============ 全局异常处理 ============

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason }, 'Unhandled rejection');
});

// ============ 启动服务器 ============

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
