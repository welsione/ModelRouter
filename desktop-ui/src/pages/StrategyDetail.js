import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, Plus, Save, X, Copy, Check, Zap, Hash, DollarSign, ToggleLeft, ToggleRight, AlertCircle, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

function StrategyDetail({ strategyId, onBack }) {
  const [strategy, setStrategy] = useState(null);
  const [models, setModels] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [settings, setSettings] = useState(null);
  const [candidateForm, setCandidateForm] = useState({
    modelConfigId: '',
    description: '',
    priority: 50,
    weight: 1.0,
    enabled: true,
    price: ''
  });
  const [copiedField, setCopiedField] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);

  useEffect(() => {
    fetchData();
  }, [strategyId]);

  const fetchData = async () => {
    try {
      const [strategyRes, modelsRes, candidatesRes, logsRes, settingsRes] = await Promise.all([
        fetch(`/api/config/strategies/${strategyId}`),
        fetch('/api/config/models'),
        fetch(`/api/config/strategies/${strategyId}/candidates`),
        fetch('/api/config/logs'),
        fetch('/api/config/settings')
      ]);
      
      const strategyData = await strategyRes.json();
      const modelsData = await modelsRes.json();
      const candidatesData = await candidatesRes.json();
      const logsData = await logsRes.json();
      const settingsData = await settingsRes.json();
      
      setStrategy(strategyData);
      setModels(modelsData);
      setCandidates(candidatesData);
      setSettings(settingsData);
      
      const strategyLogs = logsData.filter(l => l.strategyId === strategyId);
      setLogs(strategyLogs);
      
      setFormData({
        name: strategyData.name || '',
        promptTemplate: strategyData.promptTemplate || '',
        routerModelId: strategyData.routerModelId || '',
        fallbackModelId: strategyData.fallbackModelId || '',
        isDefault: strategyData.isDefault || false,
        enabled: strategyData.enabled !== false,
        maxContextTokens: strategyData.maxContextTokens || 4096,
        temperature: strategyData.temperature || 0.7,
        enableStream: strategyData.enableStream !== false,
        timeoutSeconds: strategyData.timeoutSeconds || 120
      });
    } catch (err) {
      console.error('Failed to fetch strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/config/strategies/${strategyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setEditing(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save strategy:', err);
    }
  };

  const getModelTokens = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model ? (model.totalTokens || 0) : 0;
  };

  const generatePrompt = async (type, candidateId = null) => {
    if (!settings?.routerModelApiKey || !settings?.routerModelName) {
      alert('请先在设置中配置AI提示词生成模型');
      return;
    }
    
    setGeneratingPrompt(true);
    try {
      if (type === 'strategy') {
        const response = await fetch(`${settings.routerModelBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.routerModelApiKey}`
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `请帮我生成一个高质量的路由策略提示词模板。这个模板用于帮助AI在多个模型中选择最合适的一个。请根据以下候选模型生成一个专业、清晰的提示词模板，只需要返回提示词模板内容，不要其他解释。模板应该包含对候选模型的描述和选择规则。请用中文返回。`
            }],
            model: settings.routerModelName,
            temperature: settings.routerModelTemperature || 0.7
          })
        });
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          setFormData(prev => ({ ...prev, promptTemplate: data.choices[0].message.content }));
        }
      } else if (type === 'candidate' && candidateId) {
        const candidate = candidates.find(c => c.id === candidateId);
        if (!candidate) return;
        const model = models.find(m => m.id === candidate.modelConfigId);
        
        const response = await fetch(`${settings.routerModelBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.routerModelApiKey}`
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `请帮我为模型 "${model?.name || candidate.modelConfigId}" 生成一段简洁的描述（不超过200字），用于帮助AI路由决策时理解该模型的特点和适用场景。请用中文返回，只需要返回描述内容，不要其他解释。`
            }],
            model: settings.routerModelName,
            temperature: settings.routerModelTemperature || 0.7
          })
        });
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          const generatedDescription = data.choices[0].message.content;
          if (editingCandidate && editingCandidate.id === candidateId) {
            setEditingCandidate(prev => ({ ...prev, description: generatedDescription }));
          } else {
            handleUpdateCandidate({ ...candidate, description: generatedDescription });
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate prompt:', err);
      alert('生成提示词失败: ' + err.message);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个策略吗？此操作不可恢复。')) return;
    try {
      await fetch(`/api/config/strategies/${strategyId}`, { method: 'DELETE' });
      onBack();
    } catch (err) {
      console.error('Failed to delete strategy:', err);
    }
  };

  const handleAddCandidate = async () => {
    if (!candidateForm.modelConfigId) return;
    try {
      await fetch('/api/config/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...candidateForm,
          strategyId
        })
      });
      setShowCandidateForm(false);
      setCandidateForm({
        modelConfigId: '',
        description: '',
        priority: 50,
        weight: 1.0,
        enabled: true,
        price: ''
      });
      fetchData();
    } catch (err) {
      console.error('Failed to add candidate:', err);
    }
  };

  const handleUpdateCandidate = async (candidate) => {
    try {
      await fetch(`/api/config/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate)
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update candidate:', err);
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('确定要删除这个候选模型吗？')) return;
    try {
      await fetch(`/api/config/candidates/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete candidate:', err);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getModelName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  const getModelUsage = (modelId) => {
    return logs.filter(l => l.selectedModelId === modelId).length;
  };

  const getAllModelIdsFromLogs = () => {
    const modelIds = new Set();
    logs.forEach(log => {
      if (log.selectedModelId) {
        modelIds.add(log.selectedModelId);
      }
    });
    return Array.from(modelIds);
  };

  const activeModelIds = new Set(candidates.map(c => c.modelConfigId));
  const historicalModelIds = getAllModelIdsFromLogs().filter(id => !activeModelIds.has(id));
  
  const modelUsageData = getAllModelIdsFromLogs().map(modelId => ({
    id: modelId,
    name: getModelName(modelId),
    requests: getModelUsage(modelId),
    isHistorical: historicalModelIds.includes(modelId)
  })).sort((a, b) => b.requests - a.requests);

  const COLORS = ['#4285f4', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white mb-4"
      >
        <ArrowLeft size={18} />
        返回策略列表
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 rounded-xl flex items-center justify-center shadow-sm">
            <Zap className="text-white" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{strategy?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {strategy?.isDefault && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  默认策略
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${strategy?.enabled !== false ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700'}`}>
                {strategy?.enabled !== false ? '启用' : '禁用'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit size={16} />
                编辑
              </button>
              {!strategy?.isDefault && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                  删除
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
              >
                <Save size={16} />
                保存
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4">策略配置</h3>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">提示词模板</label>
                  {settings?.routerModelApiKey && settings?.routerModelName && (
                    <button
                      onClick={() => generatePrompt('strategy')}
                      disabled={generatingPrompt}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      <Sparkles size={12} />
                      {generatingPrompt ? '生成中...' : 'AI生成'}
                    </button>
                  )}
                </div>
                <textarea
                  value={formData.promptTemplate}
                  onChange={e => setFormData({...formData, promptTemplate: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">路由模型</label>
                  <select
                    value={formData.routerModelId}
                    onChange={e => setFormData({...formData, routerModelId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  >
                    <option value="">选择模型</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">备用模型</label>
                  <select
                    value={formData.fallbackModelId}
                    onChange={e => setFormData({...formData, fallbackModelId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  >
                    <option value="">选择模型</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">最大上下文Token</label>
                  <input
                    type="number"
                    value={formData.maxContextTokens}
                    onChange={e => setFormData({...formData, maxContextTokens: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">超时秒数</label>
                  <input
                    type="number"
                    value={formData.timeoutSeconds}
                    onChange={e => setFormData({...formData, timeoutSeconds: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({...formData, enabled: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">启用策略</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enableStream}
                    onChange={e => setFormData({...formData, enableStream: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">启用流式响应</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">路由模型</span>
                <span className="text-gray-800 dark:text-white">{getModelName(strategy?.routerModelId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">备用模型</span>
                <span className="text-gray-800 dark:text-white">{getModelName(strategy?.fallbackModelId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">最大上下文</span>
                <span className="text-gray-800 dark:text-white">{strategy?.maxContextTokens || 4096} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">超时时间</span>
                <span className="text-gray-800 dark:text-white">{strategy?.timeoutSeconds || 120}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">流式响应</span>
                <span className="text-gray-800 dark:text-white">{strategy?.enableStream !== false ? '启用' : '禁用'}</span>
              </div>
              <div>
                <span className="text-gray-500">提示词模板</span>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-300 text-xs max-h-32 overflow-y-auto">
                  {strategy?.promptTemplate || '-'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4">使用统计</h3>
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Zap size={16} />
                <span className="text-sm">总请求数</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{logs.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Hash size={16} />
                <span className="text-sm">候选模型数</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{candidates.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <AlertCircle size={16} />
                <span className="text-sm">历史使用模型</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{historicalModelIds.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-white">候选模型</h3>
          <button
            onClick={() => setShowCandidateForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            添加模型
          </button>
        </div>
        
        {showCandidateForm && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
                <select
                  value={candidateForm.modelConfigId}
                  onChange={e => setCandidateForm({...candidateForm, modelConfigId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  <option value="">选择模型</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
                <input
                  type="number"
                  value={candidateForm.priority}
                  onChange={e => setCandidateForm({...candidateForm, priority: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">价格</label>
                <input
                  type="text"
                  value={candidateForm.price}
                  onChange={e => setCandidateForm({...candidateForm, price: e.target.value})}
                  placeholder="如: ¥2/1M tokens"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
                <textarea
                  value={candidateForm.description}
                  onChange={e => setCandidateForm({...candidateForm, description: e.target.value})}
                  rows={2}
                  placeholder="模型描述（用于路由决策）..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div className="flex gap-2 md:col-span-2 lg:col-span-3">
                <button
                  onClick={() => setShowCandidateForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleAddCandidate}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {candidates.map(candidate => (
            <div key={candidate.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${candidate.enabled !== false ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="font-medium text-gray-800 dark:text-white">{getModelName(candidate.modelConfigId)}</span>
                  {candidate.price && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      {candidate.price}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>优先级: {candidate.priority || 50}</span>
                  <span>调用: {getModelUsage(candidate.modelConfigId)}</span>
                  <span>Token: {(getModelTokens(candidate.modelConfigId) || 0).toLocaleString()}</span>
                  <button
                    onClick={() => setEditingCandidate(candidate)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                  >
                    <Edit size={12} />
                    编辑
                  </button>
                </div>
              </div>
            </div>
          ))}
          {candidates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无候选模型，点击上方添加按钮
            </div>
          )}
        </div>
      </div>

      {editingCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-white">编辑候选模型</h3>
              <button onClick={() => setEditingCandidate(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-white">
                  {getModelName(editingCandidate.modelConfigId)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">价格</label>
                  <input
                    type="text"
                    value={editingCandidate.price || ''}
                    onChange={e => setEditingCandidate({...editingCandidate, price: e.target.value})}
                    placeholder="如: ¥2/1M"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级 (1-100)</label>
                  <input
                    type="number"
                    value={editingCandidate.priority || 50}
                    onChange={e => setEditingCandidate({...editingCandidate, priority: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">权重</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingCandidate.weight || 1.0}
                  onChange={e => setEditingCandidate({...editingCandidate, weight: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingCandidate.enabled !== false}
                    onChange={e => setEditingCandidate({...editingCandidate, enabled: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">启用</span>
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">模型描述</label>
                  {settings?.routerModelApiKey && settings?.routerModelName && (
                    <button
                      onClick={() => generatePrompt('candidate', editingCandidate.id)}
                      disabled={generatingPrompt}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      <Sparkles size={12} />
                      AI生成
                    </button>
                  )}
                </div>
                <textarea
                  value={editingCandidate.description || ''}
                  onChange={e => setEditingCandidate({...editingCandidate, description: e.target.value})}
                  placeholder="模型描述（用于路由决策）..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => { setEditingCandidate(null); handleDeleteCandidate(editingCandidate.id); }}
                className="flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 size={16} />
                删除
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCandidate(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={() => { handleUpdateCandidate(editingCandidate); setEditingCandidate(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                >
                  <Save size={16} />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modelUsageData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">模型调用分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelUsageData}
                    dataKey="requests"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {modelUsageData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        opacity={entry.isHistorical ? 0.4 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {historicalModelIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                * 灰色显示的模型为历史使用但已从候选中移除
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">调用排行</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelUsageData}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                    {modelUsageData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        opacity={entry.isHistorical ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StrategyDetail;
