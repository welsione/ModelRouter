import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, Bot, AlertCircle, Play, CheckCircle, XCircle, Globe, Plus, Trash2, Edit2, X } from 'lucide-react';

function SettingsPage() {
  const [settings, setSettings] = useState({
    serverPort: '8080',
    logLevel: 'DEBUG',
    cacheExpireMinutes: 5,
    defaultFallbackModelId: '',
    providerConfigs: {},
    routerModelType: 'openai',
    routerModelBaseUrl: 'https://api.openai.com/v1',
    routerModelApiKey: '',
    routerModelName: 'gpt-4o-mini',
    routerModelTemperature: 0.7
  });
  const [providerTemplates, setProviderTemplates] = useState([]);
  const [models, setModels] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState(null);
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderTesting, setNewProviderTesting] = useState(false);
  const [newProviderTestResult, setNewProviderTestResult] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [routerModelTested, setRouterModelTested] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [aboutInfo, setAboutInfo] = useState({ version: '1.0.0', build: '', database: '' });
  const [restarting, setRestarting] = useState(false);
  const [serverDefaults, setServerDefaults] = useState({});
  const [routerDefaults, setRouterDefaults] = useState({});
  const [options, setOptions] = useState({});
  const dropdownRef = useRef(null);

  const filteredModels = modelSearch
    ? availableModels.filter(m => 
        m.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : availableModels;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const settingsRes = await fetch('/api/config/settings');
      const modelsRes = await fetch('/api/config/models');
      const appSettingsRes = await fetch('/static.json');
      
      if (!settingsRes.ok || !modelsRes.ok || !appSettingsRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const settingsData = await settingsRes.json();
      const modelsData = await modelsRes.json();
      const appSettings = await appSettingsRes.json();
      
      const templates = appSettings.providerTemplates || [];
      setProviderTemplates(templates);
      
      const providerConfigs = settingsData.providerConfigs || {};
      const defaults = appSettings.defaults || {};
      const routerDefaults = defaults.router || {};
      const serverDefaults = defaults.server || {};
      const appOptions = appSettings.options || {};
      setServerDefaults(serverDefaults);
      setRouterDefaults(routerDefaults);
      setOptions(appOptions);
      
      setSettings({
        serverPort: serverDefaults.port || 8080,
        logLevel: serverDefaults.logLevel || 'DEBUG',
        cacheExpireMinutes: 5,
        defaultFallbackModelId: settingsData.defaultFallbackModelId || '',
        providerConfigs: providerConfigs,
        routerModelType: settingsData.routerModelType || routerDefaults.modelType || 'openai',
        routerModelBaseUrl: settingsData.routerModelBaseUrl || '',
        routerModelApiKey: settingsData.routerModelApiKey || '',
        routerModelName: settingsData.routerModelName || routerDefaults.modelName || 'gpt-4o-mini',
        routerModelTemperature: settingsData.routerModelTemperature || routerDefaults.temperature || 0.7
      });
      setModels(modelsData);
      setAboutInfo(appSettings.about || {});
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setProviderTemplates([
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyPrefix: 'sk-' },
        { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKeyPrefix: '' }
      ]);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };

  // 自动保存设置
  useEffect(() => {
    if (!initialLoaded || loading) return;
    
    const autoSave = async () => {
      try {
        await fetch('/api/config/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'default',
            providerConfigs: settings.providerConfigs,
            routerModelType: settings.routerModelType,
            routerModelBaseUrl: settings.routerModelBaseUrl,
            routerModelApiKey: settings.routerModelApiKey,
            routerModelName: settings.routerModelName,
            routerModelTemperature: settings.routerModelTemperature
          })
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (err) {
        console.error('Failed to auto save settings:', err);
      }
    };

    const timeoutId = setTimeout(autoSave, 1000);
    return () => clearTimeout(timeoutId);
  }, [settings.providerConfigs, settings.routerModelType, settings.routerModelBaseUrl, settings.routerModelApiKey, settings.routerModelName, settings.routerModelTemperature]);

  const handleSave = async () => {
    try {
      await fetch('/api/config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'default',
          defaultFallbackModelId: settings.defaultFallbackModelId,
          providerConfigs: settings.providerConfigs,
          routerModelType: settings.routerModelType,
          routerModelBaseUrl: settings.routerModelBaseUrl,
          routerModelApiKey: settings.routerModelApiKey,
          routerModelName: settings.routerModelName,
          routerModelTemperature: settings.routerModelTemperature
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const testProviderConnection = async (providerId, config) => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      if (response.ok) {
        setTestResult({ success: true, message: `${providerId} 连接成功` });
      } else {
        setTestResult({ success: false, message: `连接失败: ${response.status}` });
      }
    } catch (err) {
      setTestResult({ success: false, message: `连接失败: ${err.message}` });
    }
    setTesting(false);
  };

  const fetchAvailableModels = async (providerType) => {
    const template = providerTemplates.find(t => t.id === providerType);
    const config = settings.providerConfigs[providerType];
    
    if (!config?.apiKey || !template) {
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
        const models = data.data?.map(m => m.id) || [];
        setAvailableModels(models);
      } else {
        setAvailableModels([]);
      }
    } catch (err) {
      setAvailableModels([]);
    }
    setLoadingModels(false);
  };

  const updateProviderConfig = (providerId, field, value) => {
    setSettings(prev => ({
      ...prev,
      providerConfigs: {
        ...prev.providerConfigs,
        [providerId]: {
          ...prev.providerConfigs[providerId],
          [field]: value
        }
      }
    }));
  };

  const getProviderIcon = (provider) => {
    if (provider.icon) {
      return <img src={provider.icon} alt={provider.name} className="w-6 h-6 object-contain" />;
    }
    return <Globe className="w-6 h-6 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">设置</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
            <CheckCircle size={18} />
            {saved ? '已自动保存' : '自动保存中...'}
          </div>
          <button
            onClick={() => setSettings({
              serverPort: serverDefaults?.port || 8080,
              logLevel: serverDefaults?.logLevel || 'DEBUG',
              cacheExpireMinutes: 5,
              defaultFallbackModelId: '',
              providerConfigs: {},
              routerModelType: routerDefaults?.modelType || 'openai',
              routerModelBaseUrl: '',
              routerModelApiKey: '',
              routerModelName: routerDefaults?.modelName || 'gpt-4o-mini',
              routerModelTemperature: routerDefaults?.temperature || 0.7
            })}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RotateCcw size={18} />
            重置
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('确定要重启服务吗？')) return;
              setRestarting(true);
              try {
                await fetch('/api/system/restart', { method: 'POST' });
              } catch (e) {}
              setTimeout(() => {
                window.location.reload();
              }, 3000);
            }}
            disabled={restarting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            <RotateCcw size={18} className={restarting ? 'animate-spin' : ''} />
            {restarting ? '重启中...' : '重启服务'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">模型提供商配置</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            配置各提供商的API Key和请求地址，添加模型时可选择使用
          </p>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} />
                新增提供商
              </button>
            </div>
            {Object.keys(settings.providerConfigs || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                暂无已配置的提供商，点击上方按钮添加
              </div>
            )}
            {providerTemplates.filter(template => {
              const config = settings.providerConfigs[template.id];
              return config && (config.apiKey || config.baseUrl);
            }).map(template => {
              const config = settings.providerConfigs[template.id];
              
              return (
                <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getProviderIcon(template)}
                      <span className="font-medium text-gray-800 dark:text-white">{template.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">已配置</span>
                    </div>
                    <button
                      onClick={() => setEditingProvider(editingProvider === template.id ? null : template.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {editingProvider === template.id ? '收起' : '编辑'}
                    </button>
                  </div>
                  
                  {editingProvider === template.id && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
                        <input
                          type="text"
                          value={config.baseUrl || template.baseUrl}
                          onChange={e => updateProviderConfig(template.id, 'baseUrl', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                        <input
                          type="password"
                          value={config.apiKey || ''}
                          onChange={e => updateProviderConfig(template.id, 'apiKey', e.target.value)}
                          placeholder={template.apiKeyPrefix ? `${template.apiKeyPrefix}...` : '输入API Key'}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-3">
                        <button
                          onClick={() => testProviderConnection(template.id, { baseUrl: config.baseUrl || template.baseUrl, apiKey: config.apiKey })}
                          disabled={testing || !config.apiKey}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                          <Play size={14} />
                          测试连接
                        </button>
                        {testResult && testResult.message.includes(template.id) && (
                          <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.message.replace(`${template.id} `, '')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">AI提示词生成模型</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            配置用于自动生成路由策略提示词和候选模型描述的模型
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">选择提供商</label>
              <select
                value={settings.routerModelType}
                onChange={e => {
                  const type = e.target.value;
                  const template = providerTemplates.find(t => t.id === type);
                  const config = settings.providerConfigs[type];
                  setSettings({
                    ...settings,
                    routerModelType: type,
                    routerModelBaseUrl: config?.baseUrl || template?.baseUrl || '',
                    routerModelApiKey: config?.apiKey || '',
                    routerModelName: ''
                  });
                  setAvailableModels([]);
                  setRouterModelTested(false);
                  if (config?.apiKey) {
                    fetchAvailableModels(type);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">选择提供商</option>
                {providerTemplates.filter(p => settings.providerConfigs[p.id]?.apiKey).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {(!settings.routerModelType || !settings.providerConfigs[settings.routerModelType]?.apiKey) && (
                <p className="text-xs text-yellow-600 mt-1">请先在「模型提供商配置」中添加并配置提供商</p>
              )}
            </div>

            {settings.routerModelType && settings.providerConfigs[settings.routerModelType]?.apiKey && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型名称</label>
                  <div className="relative" ref={dropdownRef}>
                    <input
                      type="text"
                      value={modelSearch || settings.routerModelName}
                      onChange={e => {
                        const value = e.target.value;
                        setModelSearch(value);
                        setShowModelDropdown(true);
                        setSettings({...settings, routerModelName: value});
                        setRouterModelTested(false);
                      }}
                      onFocus={() => setShowModelDropdown(true)}
                      placeholder={loadingModels ? "加载模型中..." : "搜索或输入模型名称"}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                    {showModelDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {loadingModels ? (
                          <div className="px-3 py-2 text-gray-500 text-sm">加载中...</div>
                        ) : modelSearch ? (
                          filteredModels.length > 0 ? (
                            filteredModels.map(m => (
                              <button
                                key={m}
                                onClick={() => {
                                  setSettings({...settings, routerModelName: m});
                                  setModelSearch(m);
                                  setShowModelDropdown(false);
                                  setRouterModelTested(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                              >
                                {m}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">未找到匹配模型</div>
                          )
                        ) : (
                          availableModels.slice(0, 20).map(m => (
                            <button
                              key={m}
                              onClick={() => {
                                setSettings({...settings, routerModelName: m});
                                setModelSearch(m);
                                setShowModelDropdown(false);
                                setRouterModelTested(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              {m}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    共 {availableModels.length} 个模型，输入关键词搜索
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature</label>
                    <input
                      type="number"
                      step={options.temperatureRange?.step || 0.1}
                      min={options.temperatureRange?.min || 0}
                      max={options.temperatureRange?.max || 2}
                      value={settings.routerModelTemperature}
                      onChange={e => setSettings({...settings, routerModelTemperature: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={async () => {
                        if (!settings.routerModelName || !settings.routerModelBaseUrl || !settings.routerModelApiKey) return;
                        setTesting(true);
                        setTestResult(null);
                        try {
                          const response = await fetch(`${settings.routerModelBaseUrl}/chat/completions`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${settings.routerModelApiKey}`
                            },
                            body: JSON.stringify({
                              model: settings.routerModelName,
                              messages: [{ role: 'user', content: 'Hi' }],
                              max_tokens: 5
                            })
                          });
                          if (response.ok) {
                            setTestResult({ success: true, message: '测试成功' });
                            setRouterModelTested(true);
                          } else {
                            setTestResult({ success: false, message: `测试失败: ${response.status}` });
                          }
                        } catch (err) {
                          setTestResult({ success: false, message: `测试失败: ${err.message}` });
                        }
                        setTesting(false);
                      }}
                      disabled={testing || !settings.routerModelName}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      {testing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div> : <Play size={16} />}
                      测试
                    </button>
                    {testResult && (
                      <span className={`ml-3 flex items-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {settings.routerModelType && settings.routerModelApiKey && !routerModelTested && settings.routerModelName && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  请点击测试按钮验证配置是否正确
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">服务配置</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">服务端口</label>
              <input
                type="number"
                value={settings.serverPort}
                onChange={e => setSettings({...settings, serverPort: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">重启应用后生效</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日志级别</label>
              <select
                value={settings.logLevel}
                onChange={e => setSettings({...settings, logLevel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {(options.logLevels || ['DEBUG', 'INFO', 'WARN', 'ERROR']).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">缓存过期时间（分钟）</label>
              <input
                type="number"
                value={settings.cacheExpireMinutes}
                onChange={e => setSettings({...settings, cacheExpireMinutes: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">关于</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><span className="font-medium">版本:</span> {aboutInfo.version || '1.0.0'}</p>
            <p><span className="font-medium">构建:</span> {aboutInfo.build || '-'}</p>
            <p><span className="font-medium">数据库:</span> {aboutInfo.database || '-'}</p>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-white">新增模型提供商</h3>
              <button onClick={() => { setShowAddModal(false); setNewProvider(null); setNewProviderApiKey(''); setNewProviderTestResult(null); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            {!newProvider ? (
              <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">选择要添加的提供商：</p>
                <div className="grid grid-cols-3 gap-3">
                  {providerTemplates.filter(t => !settings.providerConfigs[t.id]?.apiKey).map(template => (
                    <button
                      key={template.id}
                      onClick={() => setNewProvider(template)}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 transition-all"
                    >
                      {getProviderIcon(template)}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{template.name}</span>
                    </button>
                  ))}
                </div>
                {providerTemplates.filter(t => !settings.providerConfigs[t.id]?.apiKey).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    所有提供商已配置
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  {getProviderIcon(newProvider)}
                  <span className="font-medium text-gray-800 dark:text-white">{newProvider.name}</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={newProvider.baseUrl}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                  <input
                    type="password"
                    value={newProviderApiKey}
                    onChange={e => setNewProviderApiKey(e.target.value)}
                    placeholder={newProvider.apiKeyPrefix ? `${newProvider.apiKeyPrefix}...` : '输入API Key'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (!newProviderApiKey) return;
                      setNewProviderTesting(true);
                      setNewProviderTestResult(null);
                      try {
                        const response = await fetch(`${newProvider.baseUrl}/models`, {
                          headers: { 'Authorization': `Bearer ${newProviderApiKey}` }
                        });
                        if (response.ok) {
                          setNewProviderTestResult({ success: true, message: '连接成功' });
                        } else {
                          setNewProviderTestResult({ success: false, message: `连接失败: ${response.status}` });
                        }
                      } catch (err) {
                        setNewProviderTestResult({ success: false, message: `连接失败: ${err.message}` });
                      }
                      setNewProviderTesting(false);
                    }}
                    disabled={newProviderTesting || !newProviderApiKey}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Play size={14} />
                    测试连接
                  </button>
                  {newProviderTestResult && (
                    <span className={`text-sm ${newProviderTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {newProviderTestResult.message}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => { setNewProvider(null); setNewProviderApiKey(''); setNewProviderTestResult(null); }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    返回
                  </button>
                  <button
                    onClick={() => {
                      setSettings(prev => ({
                        ...prev,
                        providerConfigs: {
                          ...prev.providerConfigs,
                          [newProvider.id]: {
                            baseUrl: newProvider.baseUrl,
                            apiKey: newProviderApiKey
                          }
                        }
                      }));
                      setShowAddModal(false);
                      setNewProvider(null);
                      setNewProviderApiKey('');
                      setNewProviderTestResult(null);
                    }}
                    disabled={!newProviderApiKey || (newProviderTestResult && !newProviderTestResult.success)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
