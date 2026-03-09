import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, Play, CheckCircle, XCircle, Loader, Copy, Clock, Zap, Hash, Activity, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

function ModelDetail({ modelId, onBack }) {
  const [model, setModel] = useState(null);
  const [stats, setStats] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [providerTemplates, setProviderTemplates] = useState([]);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelTested, setModelTested] = useState(false);

  useEffect(() => {
    fetchData();
  }, [modelId]);

  const fetchData = async () => {
    try {
      const [statsRes, strategiesRes, settingsRes, templatesRes] = await Promise.all([
        fetch(`/api/config/models/${modelId}/stats`),
        fetch('/api/config/strategies'),
        fetch('/api/config/settings'),
        fetch('/settings.json')
      ]);
      
      if (!statsRes.ok) {
        console.error('Failed to fetch model stats:', statsRes.status);
        setLoading(false);
        return;
      }
      
      const statsData = await statsRes.json();
      const strategiesData = await strategiesRes.json();
      const settingsData = await settingsRes.json();
      const templatesData = await templatesRes.json();
      
      setStats(statsData);
      setModel(statsData.config);
      setStrategies(strategiesData);
      setProviderTemplates(templatesData.providerTemplates || []);
      setProviderConfigs(settingsData.providerConfigs || {});
      
      const configType = statsData.config?.type;
      setFormData({
        name: statsData.config?.name || '',
        type: configType || '',
        baseUrl: statsData.config?.baseUrl || '',
        apiKey: statsData.config?.apiKey || '',
        models: statsData.config?.models || '',
        temperature: statsData.config?.temperature || 0.7
      });
      
      if (configType && providerConfigs[configType]?.apiKey) {
        fetchAvailableModels(configType, settingsData.providerConfigs?.[configType]);
      }
    } catch (err) {
      console.error('Failed to fetch model:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModels = async (providerType, config) => {
    if (!config?.apiKey) {
      setAvailableModels([]);
      return;
    }

    setLoadingModels(true);
    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.data?.map(m => m.id) || []);
      } else {
        setAvailableModels([]);
      }
    } catch (err) {
      setAvailableModels([]);
    }
    setLoadingModels(false);
  };

  const handleProviderChange = (providerType) => {
    const config = providerConfigs[providerType];
    setFormData({
      ...formData,
      type: providerType,
      baseUrl: config?.baseUrl || '',
      apiKey: config?.apiKey || '',
      models: ''
    });
    setAvailableModels([]);
    setModelTested(false);
    if (config?.apiKey) {
      fetchAvailableModels(providerType, config);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个模型吗？此操作不可恢复。')) return;
    try {
      await fetch(`/api/config/models/${modelId}`, { method: 'DELETE' });
      onBack();
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const handleSave = async () => {
    if (!modelTested && editing) {
      alert('请先测试连接');
      return;
    }
    try {
      await fetch(`/api/config/models/${modelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setEditing(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save model:', err);
    }
  };

  const testModel = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/config/models/${modelId}/test`, { method: 'POST' });
      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
    setTesting(false);
  };

  const handleTestInEdit = async () => {
    if (!formData.models || !formData.baseUrl || !formData.apiKey) return;
    
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${formData.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formData.apiKey}`
        },
        body: JSON.stringify({
          model: formData.models,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      });
      if (response.ok) {
        setTestResult({ success: true, message: '测试成功' });
        setModelTested(true);
      } else {
        setTestResult({ success: false, message: `失败: ${response.status}` });
      }
    } catch (err) {
      setTestResult({ success: false, message: `失败: ${err.message}` });
    }
    setTesting(false);
  };

  const getProviderIcon = (providerId) => {
    const provider = providerTemplates.find(p => p.id === providerId);
    if (provider?.icon) {
      return <img src={provider.icon} alt={provider.name} className="w-8 h-8 object-contain" />;
    }
    return <Zap className="text-blue-600 dark:text-blue-400" size={28} />;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'openai': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'ollama': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'cloud': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatLatency = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms) => {
    if (ms < 1000) return 'text-green-600';
    if (ms < 3000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-primary" size={32} />
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
        返回模型列表
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
            {getProviderIcon(model?.type)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{model?.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(model?.type)}`}>
              {providerTemplates.find(p => p.id === model?.type)?.name || model?.type}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={testModel}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {testing ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                测试
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit size={16} />
                编辑
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={16} />
                删除
              </button>
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </>
          )}
        </div>
      </div>

      {testResult && (
        <div className={`mb-6 p-4 rounded-xl ${
          testResult.success 
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            {testResult.success ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <XCircle className="text-red-600" size={20} />
            )}
            <div className="flex-1">
              <p className={`font-medium ${testResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                {testResult.message}
              </p>
              {testResult.success && testResult.response && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  回复: {testResult.response}
                </p>
              )}
            </div>
            {testResult.latency && (
              <div className={`flex items-center gap-1 ${getLatencyColor(testResult.latency)}`}>
                <Clock size={14} />
                <span className="text-sm font-medium">{formatLatency(testResult.latency)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {['overview', 'stats', 'logs'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'overview' ? '概览' : tab === 'stats' ? '统计分析' : '请求日志'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">模型配置</h3>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">提供商</label>
                  <select
                    value={formData.type}
                    onChange={e => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  >
                    <option value="">选择提供商</option>
                    {providerTemplates.filter(p => providerConfigs[p.id]?.apiKey).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {formData.type && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
                      <div className="flex gap-2">
                        <select
                          value={availableModels.includes(formData.models) ? formData.models : ''}
                          onChange={e => {
                            setFormData({...formData, models: e.target.value});
                            setModelTested(false);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                        >
                          <option value="">选择模型</option>
                          {loadingModels ? (
                            <option>加载中...</option>
                          ) : (
                            availableModels.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))
                          )}
                        </select>
                        <input
                          type="text"
                          value={availableModels.includes(formData.models) ? '' : formData.models}
                          onChange={e => {
                            setFormData({...formData, models: e.target.value});
                            setModelTested(false);
                          }}
                          placeholder="或手动输入"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestInEdit}
                        disabled={testing || !formData.models}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
                      >
                        {testing ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                        测试
                      </button>
                      {testResult && (
                        <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResult.message}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">类型</span>
                  <span className="text-gray-800 dark:text-white">{model?.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">模型</span>
                  <span className="text-gray-800 dark:text-white">{model?.models}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base URL</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 dark:text-white truncate max-w-[200px]">{model?.baseUrl}</span>
                    <button onClick={() => copyToClipboard(model?.baseUrl)} className="text-gray-400 hover:text-gray-600">
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Temperature</span>
                  <span className="text-gray-800 dark:text-white">{model?.temperature}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4">使用统计</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Zap size={16} />
                    <span className="text-sm">请求次数</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats?.requestCount || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Hash size={16} />
                    <span className="text-sm">Token用量</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{(stats?.totalTokens || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock size={16} />
                    <span className="text-sm">平均延迟</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">
                    {model?.avgLatency ? `${Math.round(model.avgLatency)}ms` : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Activity size={16} />
                    <span className="text-sm">上次延迟</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">
                    {model?.lastLatency ? `${model.lastLatency}ms` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">请求量与Token趋势</h3>
            {stats?.totalRequests > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-48">
                  <p className="text-sm text-gray-500 mb-2">请求次数</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { name: '请求次数', value: stats.requestCount || 0 }
                    ]}>
                      <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                      <YAxis tick={{fill: '#9ca3af'}} />
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}}
                        labelStyle={{color: '#fff'}}
                      />
                      <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{fill: '#22c55e'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48">
                  <p className="text-sm text-gray-500 mb-2">Token用量</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { name: 'Token用量', value: stats.totalTokens || 0 }
                    ]}>
                      <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                      <YAxis tick={{fill: '#9ca3af'}} />
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}}
                        labelStyle={{color: '#fff'}}
                      />
                      <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={{fill: '#a855f7'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无数据，请通过对话测试产生请求</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">延迟统计</h3>
            {model?.lastLatency ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: '上次延迟', value: model.lastLatency, color: model.lastLatency < 1000 ? '#22c55e' : model.lastLatency < 3000 ? '#eab308' : '#ef4444' },
                    { name: '平均延迟', value: Math.round(model.avgLatency || 0), color: '#3b82f6' }
                  ]}>
                    <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                    <YAxis tick={{fill: '#9ca3af'}} />
                    <Tooltip 
                      contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px'}}
                      labelStyle={{color: '#fff'}}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {[
                        { name: '上次延迟', value: model.lastLatency, color: model.lastLatency < 1000 ? '#22c55e' : model.lastLatency < 3000 ? '#eab308' : '#ef4444' },
                        { name: '平均延迟', value: Math.round(model.avgLatency || 0), color: '#3b82f6' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无延迟数据，请进行测试</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">按策略统计</h3>
            {stats?.byStrategy && Object.keys(stats.byStrategy).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">策略</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">调用次数</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byStrategy).map(([strategyId, count]) => (
                      <tr key={strategyId} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 px-4 text-gray-800 dark:text-white">
                          {getStrategyName(strategyId)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-800 dark:text-white">{count}</td>
                        <td className="py-3 px-4 text-right text-gray-500">
                          {((count / stats.totalRequests) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无统计数据</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white">最近请求</h3>
          </div>
          {stats?.recentLogs && stats.recentLogs.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[500px] overflow-y-auto">
              {stats.recentLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-white truncate">
                        {log.userPrompt?.substring(0, 100)}...
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>策略: {getStrategyName(log.strategyId)}</span>
                        <span>时间: {new Date(log.createTime).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                      {log.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              暂无请求日志
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelDetail;
