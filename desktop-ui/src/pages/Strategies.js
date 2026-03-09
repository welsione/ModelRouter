import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

function Strategies({ onSelectStrategy }) {
  const [strategies, setStrategies] = useState([]);
  const [models, setModels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    promptTemplate: '',
    routerModelId: '',
    fallbackModelId: '',
    isDefault: false,
    enabled: true,
    maxContextTokens: 4096,
    temperature: 0.7,
    enableStream: true,
    timeoutSeconds: 120
  });

  useEffect(() => {
    fetchStrategies();
    fetchModels();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/config/strategies');
      const data = await response.json();
      setStrategies(data);
    } catch (err) {
      console.error('Failed to fetch strategies:', err);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/config/models');
      const data = await response.json();
      setModels(data);
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  const fetchCandidates = async (strategyId) => {
    try {
      const response = await fetch(`/api/config/strategies/${strategyId}/candidates`);
      const data = await response.json();
      setCandidates(data);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingStrategy ? 'PUT' : 'POST';
      const url = editingStrategy 
        ? `/api/config/strategies/${editingStrategy.id}`
        : '/api/config/strategies';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const savedStrategy = await response.json();
      
      setShowModal(false);
      setEditingStrategy(null);
      resetFormData();
      fetchStrategies();
      
      if (!editingStrategy && onSelectStrategy) {
        onSelectStrategy(savedStrategy.id);
      }
    } catch (err) {
      console.error('Failed to save strategy:', err);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      promptTemplate: '',
      routerModelId: '',
      fallbackModelId: '',
      isDefault: false,
      enabled: false,
      maxContextTokens: 4096,
      temperature: 0.7,
      enableStream: true,
      timeoutSeconds: 120
    });
  };

  const handleEdit = (strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      name: strategy.name || '',
      promptTemplate: strategy.promptTemplate || '',
      routerModelId: strategy.routerModelId || '',
      fallbackModelId: strategy.fallbackModelId || '',
      isDefault: strategy.isDefault || false,
      enabled: strategy.enabled !== false,
      maxContextTokens: strategy.maxContextTokens || 4096,
      temperature: strategy.temperature || 0.7,
      enableStream: strategy.enableStream !== false,
      timeoutSeconds: strategy.timeoutSeconds || 120
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个策略吗？')) return;
    try {
      await fetch(`/api/config/strategies/${id}`, { method: 'DELETE' });
      fetchStrategies();
    } catch (err) {
      console.error('Failed to delete strategy:', err);
    }
  };

  const openCandidateModal = (strategyId) => {
    setSelectedStrategyId(strategyId);
    fetchCandidates(strategyId);
    setShowCandidateModal(true);
  };

  const handleSaveCandidates = async () => {
    for (const candidate of candidates) {
      await fetch('/api/config/candidates', {
        method: candidate.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...candidate, strategyId: selectedStrategyId})
      });
    }
    setShowCandidateModal(false);
  };

  const addCandidate = () => {
    setCandidates([...candidates, {
      id: null,
      strategyId: selectedStrategyId,
      modelConfigId: '',
      description: '',
      priority: 50,
      enabled: true,
      weight: 1.0,
      price: ''
    }]);
  };

  const updateCandidate = (index, field, value) => {
    const newCandidates = [...candidates];
    newCandidates[index][field] = value;
    setCandidates(newCandidates);
  };

  const deleteCandidate = async (id) => {
    if (id) {
      await fetch(`/api/config/candidates/${id}`, { method: 'DELETE' });
    }
    fetchCandidates(selectedStrategyId);
  };

  const getModelName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : '-';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">路由策略</h2>
        <button
          onClick={() => { setShowModal(true); setEditingStrategy(null); resetFormData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          添加策略
        </button>
      </div>

      <div className="space-y-4">
        {strategies.map(strategy => (
          <div 
            key={strategy.id} 
            onClick={() => onSelectStrategy && onSelectStrategy(strategy.id)}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800 dark:text-white group-hover:text-primary transition-colors">{strategy.name}</h3>
                  {strategy.isDefault && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">默认</span>
                  )}
                  {strategy.enabled !== false ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">启用</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">禁用</span>
                  )}
                  {strategy.enableStream !== false ? (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">流式</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">非流式</span>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>路由模型: {getModelName(strategy.routerModelId)}</span>
                  <span>备用: {getModelName(strategy.fallbackModelId)}</span>
                  <span>上下文: {strategy.maxContextTokens || 4096}</span>
                  <span>超时: {strategy.timeoutSeconds || 120}s</span>
                </div>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={async () => {
                    try {
                      await fetch(`/api/config/strategies/${strategy.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...strategy, enabled: !strategy.enabled })
                      });
                      fetchStrategies();
                    } catch (err) {
                      console.error('Failed to toggle strategy:', err);
                    }
                  }}
                  className={`p-2 rounded-lg ${strategy.enabled !== false ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  title={strategy.enabled !== false ? '禁用' : '启用'}
                >
                  {strategy.enabled !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
              </div>
            </div>
            {strategy.promptTemplate && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">提示模板:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{strategy.promptTemplate}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 策略编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              {editingStrategy ? '编辑策略' : '添加策略'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">策略名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  required
                  placeholder="输入策略名称"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={e => setFormData({...formData, enabled: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">启用策略</label>
              </div>

              <p className="text-xs text-gray-500">
                其他配置可在策略详情中设置
              </p>

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
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                >
                  {editingStrategy ? '保存' : '创建并编辑'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 候选模型管理弹窗 */}
      {showCandidateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              候选模型管理
            </h3>
            
            <div className="mb-4">
              <button
                onClick={addCandidate}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                <Plus size={16} /> 添加候选模型
              </button>
            </div>

            <div className="space-y-3">
              {candidates.map((candidate, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">模型</label>
                      <select
                        value={candidate.modelConfigId}
                        onChange={e => updateCandidate(index, 'modelConfigId', e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        <option value="">选择模型</option>
                        {models.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">价格</label>
                      <input
                        type="text"
                        value={candidate.price || ''}
                        onChange={e => updateCandidate(index, 'price', e.target.value)}
                        placeholder="如: ¥2/1M"
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">优先级(1-100)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={candidate.priority || 50}
                        onChange={e => updateCandidate(index, 'priority', parseInt(e.target.value))}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">权重</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={candidate.weight || 1.0}
                        onChange={e => updateCandidate(index, 'weight', parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={candidate.enabled !== false}
                        onChange={e => updateCandidate(index, 'enabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">启用</span>
                      <button
                        onClick={() => deleteCandidate(candidate.id)}
                        className="ml-auto text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <input
                      type="text"
                      value={candidate.description || ''}
                      onChange={e => updateCandidate(index, 'description', e.target.value)}
                      placeholder="模型描述（用于路由决策）..."
                      className="w-full px-2 py-1 text-sm border rounded"
                    />
                  </div>
                </div>
              ))}
            </div>

            {candidates.length === 0 && (
              <p className="text-center text-gray-500 py-8">暂无候选模型，点击上方添加按钮</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCandidateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                关闭
              </button>
              <button
                onClick={handleSaveCandidates}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Strategies;
