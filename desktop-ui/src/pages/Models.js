import React, { useState, useEffect } from 'react';
import { Plus, Server, Play, CheckCircle, XCircle, Loader, Clock, Zap, Hash, ChevronRight, Globe, X } from 'lucide-react';

function Models({ onSelectModel }) {
  const [models, setModels] = useState([]);
  const [providerTemplates, setProviderTemplates] = useState([]);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    providerType: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    temperature: 0.7
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelTested, setModelTested] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modelsRes, settingsRes, appSettingsRes] = await Promise.all([
        fetch('/api/config/models'),
        fetch('/api/config/settings'),
        fetch('/api/app/settings')
      ]);
      const modelsData = await modelsRes.json();
      const settingsData = await settingsRes.json();
      const appSettings = await appSettingsRes.json();
      
      setModels(modelsData);
      setProviderTemplates(appSettings.providerTemplates || []);
      setProviderConfigs(settingsData.providerConfigs || {});
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const fetchAvailableModels = async (providerType) => {
    const config = providerConfigs[providerType];
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

  const handleOpenModal = (model = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        name: model.name || '',
        providerType: model.type || '',
        baseUrl: model.baseUrl || '',
        apiKey: model.apiKey || '',
        modelId: model.models || '',
        temperature: model.temperature || 0.7
      });
      setAvailableModels([]);
      setModelTested(false);
      if (model.type && providerConfigs[model.type]?.apiKey) {
        fetchAvailableModels(model.type);
      }
    } else {
      setEditingModel(null);
      setFormData({
        name: '',
        providerType: '',
        baseUrl: '',
        apiKey: '',
        modelId: '',
        temperature: 0.7
      });
      setAvailableModels([]);
      setModelTested(false);
    }
    setShowModal(true);
  };

  const handleProviderChange = (providerType) => {
    const config = providerConfigs[providerType];
    setFormData({
      ...formData,
      providerType,
      baseUrl: config?.baseUrl || '',
      apiKey: config?.apiKey || '',
      modelId: ''
    });
    setAvailableModels([]);
    setModelTested(false);
    if (config?.apiKey) {
      fetchAvailableModels(providerType);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modelTested) {
      alert('请先测试连接');
      return;
    }
    
    try {
      const method = editingModel ? 'PUT' : 'POST';
      const url = editingModel 
        ? `/api/config/models/${editingModel.id}`
        : '/api/config/models';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: formData.providerType,
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey,
          models: formData.modelId,
          temperature: formData.temperature
        })
      });
      
      setShowModal(false);
      setEditingModel(null);
      setFormData({ name: '', providerType: '', baseUrl: '', apiKey: '', modelId: '', temperature: 0.7 });
      fetchData();
    } catch (err) {
      console.error('Failed to save model:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这个模型吗？')) return;
    try {
      await fetch(`/api/config/models/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const testModel = async (id, e) => {
    e.stopPropagation();
    setTestingId(id);
    setTestResult(prev => ({ ...prev, [id]: { loading: true } }));
    
    try {
      const response = await fetch(`/api/config/models/${id}/test`, { method: 'POST' });
      const result = await response.json();
      setTestResult(prev => ({ ...prev, [id]: { loading: false, ...result } }));
    } catch (err) {
      setTestResult(prev => ({ ...prev, [id]: { loading: false, success: false, message: err.message } }));
    }
    
    setTestingId(null);
  };

  const handleCardClick = (modelId) => {
    if (onSelectModel) {
      onSelectModel(modelId);
    }
  };

  const getProviderIcon = (providerId) => {
    const provider = providerTemplates.find(p => p.id === providerId);
    if (provider?.icon) {
      return <img src={provider.icon} alt={provider.name} className="w-8 h-8 object-contain" />;
    }
    return <Globe className="w-8 h-8 text-gray-500" />;
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
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms) => {
    if (!ms) return 'text-gray-400';
    if (ms < 1000) return 'text-green-500';
    if (ms < 3000) return 'text-yellow-500';
    return 'text-red-500';
  };

  const configuredProviders = providerTemplates.filter(p => providerConfigs[p.id]?.apiKey);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">模型管理</h2>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          添加模型
        </button>
      </div>

      {configuredProviders.length === 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            请先在「设置」-「模型提供商配置」中添加提供商
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => (
          <div 
            key={model.id} 
            onClick={() => handleCardClick(model.id)}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  {getProviderIcon(model.type)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-lg">{model.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(model.type)}`}>
                    {providerTemplates.find(p => p.id === model.type)?.name || model.type}
                  </span>
                </div>
              </div>
              <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" size={20} />
            </div>
            
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">模型:</span> {model.models || '-'}
              </p>
              <p className="text-gray-600 dark:text-gray-400 truncate">
                <span className="font-medium">地址:</span> {model.baseUrl || 'api.openai.com'}
              </p>
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">{model.requestCount || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash size={14} className="text-purple-500" />
                  <span className="text-purple-600 dark:text-purple-400 font-medium">{(model.totalTokens || 0).toLocaleString()}</span>
                </div>
                {model.lastLatency > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className={getLatencyColor(model.lastLatency)} />
                    <span className={`font-medium ${getLatencyColor(model.lastLatency)}`}>
                      {formatLatency(model.lastLatency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {testResult[model.id] && !testResult[model.id].loading && (
              <div className={`mt-3 p-2.5 rounded-lg text-sm ${
                testResult[model.id].success 
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {testResult[model.id].success ? (
                      <CheckCircle size={16} className="flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="flex-shrink-0" />
                    )}
                    <span className="truncate text-xs">{testResult[model.id].message}</span>
                  </div>
                  {testResult[model.id].latency && (
                    <div className={`flex items-center gap-1 flex-shrink-0 ${getLatencyColor(testResult[model.id].latency)}`}>
                      <Clock size={12} />
                      <span className="text-xs font-medium">{formatLatency(testResult[model.id].latency)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={(e) => testModel(model.id, e)}
                disabled={testingId === model.id}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
              >
                {testingId === model.id ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                <span className="font-medium">测试连接</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                {editingModel ? '编辑模型' : '添加模型'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            {configuredProviders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">请先在「设置」中添加模型提供商</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-primary text-white rounded-lg"
                >
                  去设置
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="给模型起个名字"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择提供商</label>
                  <select
                    value={formData.providerType}
                    onChange={e => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    required
                  >
                    <option value="">选择提供商</option>
                    {configuredProviders.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {formData.providerType && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
                      <div className="flex gap-2">
                        <select
                          value={availableModels.includes(formData.modelId) ? formData.modelId : ''}
                          onChange={e => {
                            setFormData({...formData, modelId: e.target.value});
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
                          value={availableModels.includes(formData.modelId) ? '' : formData.modelId}
                          onChange={e => {
                            setFormData({...formData, modelId: e.target.value});
                            setModelTested(false);
                          }}
                          placeholder="或手动输入"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={formData.temperature}
                          onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.modelId || !formData.baseUrl || !formData.apiKey) return;
                            
                            setTestingId('modal');
                            try {
                              const response = await fetch(`${formData.baseUrl}/chat/completions`, {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${formData.apiKey}`
                                },
                                body: JSON.stringify({
                                  model: formData.modelId,
                                  messages: [{ role: 'user', content: 'Hi' }],
                                  max_tokens: 5
                                })
                              });
                              if (response.ok) {
                                setTestResult(prev => ({ ...prev, modal: { success: true, message: '测试成功' } }));
                                setModelTested(true);
                                // 测试成功后自动保存
                                setTimeout(async () => {
                                  try {
                                    const method = editingModel ? 'PUT' : 'POST';
                                    const url = editingModel 
                                      ? `/api/config/models/${editingModel.id}`
                                      : '/api/config/models';
                                    await fetch(url, {
                                      method,
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        name: formData.name,
                                        type: formData.providerType,
                                        baseUrl: formData.baseUrl,
                                        apiKey: formData.apiKey,
                                        models: formData.modelId,
                                        temperature: formData.temperature
                                      })
                                    });
                                    setShowModal(false);
                                    setEditingModel(null);
                                    setFormData({ name: '', providerType: '', baseUrl: '', apiKey: '', modelId: '', temperature: 0.7 });
                                    fetchData();
                                  } catch (err) {
                                    console.error('Failed to auto save model:', err);
                                  }
                                }, 500);
                              } else {
                                setTestResult(prev => ({ ...prev, modal: { success: false, message: `失败: ${response.status}` } }));
                              }
                            } catch (err) {
                              setTestResult(prev => ({ ...prev, modal: { success: false, message: `失败: ${err.message}` } }));
                            }
                            setTestingId(null);
                          }}
                          disabled={testingId === 'modal' || !formData.modelId}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
                        >
                          {testingId === 'modal' ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                          测试
                        </button>
                        {testResult.modal && (
                          <span className={`ml-2 text-sm ${testResult.modal.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.modal.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!modelTested}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    保存
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Models;
