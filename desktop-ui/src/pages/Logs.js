import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Eye, X, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [models, setModels] = useState([]);
  const [filterStrategy, setFilterStrategy] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
    fetchMeta();
  }, []);

  const fetchMeta = async () => {
    try {
      const [stratRes, modelRes] = await Promise.all([
        fetch('/api/config/strategies'),
        fetch('/api/config/models')
      ]);
      setStrategies(await stratRes.json());
      setModels(await modelRes.json());
    } catch (err) {
      console.error('Failed to fetch meta:', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config/logs');
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
    setLoading(false);
  };

  const getStrategyName = (id) => {
    const s = strategies.find(x => x.id === id);
    return s ? s.name : '-';
  };

  const getModelName = (id) => {
    const m = models.find(x => x.id === id);
    return m ? m.name : '-';
  };

  const filteredLogs = logs.filter(log => {
    const matchSearch = searchTerm === '' || 
      (log.selectedModelId && log.selectedModelId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.userPrompt && log.userPrompt.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStrategy = filterStrategy === '' || log.strategyId === filterStrategy;
    const matchModel = filterModel === '' || log.selectedModelId === filterModel;
    return matchSearch && matchStrategy && matchModel;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">请求日志</h2>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索模型、原因或内容..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            />
          </div>
          <select
            value={filterStrategy}
            onChange={e => { setFilterStrategy(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
          >
            <option value="">所有策略</option>
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterModel}
            onChange={e => { setFilterModel(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
          >
            <option value="">所有模型</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>共 {filteredLogs.length} 条日志</span>
          {totalPages > 1 && (
            <span>第 {currentPage}/{totalPages} 页</span>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">策略</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">选中模型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">原因</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">用户输入</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log, idx) => (
                <tr key={idx} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {log.createTime ? new Date(log.createTime).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                    {getStrategyName(log.strategyId)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {getModelName(log.selectedModelId)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {log.routeReason || log.reason || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[300px]">
                    {log.userPrompt || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg ${currentPage === pageNum ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            暂无日志数据
          </div>
        )}
      </div>

      {/* 日志详情弹窗 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">日志详情</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">时间</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {selectedLog.createTime ? new Date(selectedLog.createTime).toLocaleString() : '-'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">选中的模型</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{getModelName(selectedLog.selectedModelId)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">策略</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{getStrategyName(selectedLog.strategyId)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">路由原因</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{selectedLog.routeReason || '-'}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">用户输入</p>
                  <button
                    onClick={() => copyToClipboard(selectedLog.userPrompt || '', 'userPrompt')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'userPrompt' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedLog.userPrompt || '-'}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">路由响应</p>
                  <button
                    onClick={() => copyToClipboard(selectedLog.routerResponse || '', 'routerResponse')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {copiedField === 'routerResponse' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {selectedLog.routerResponse || '-'}
                  </pre>
                </div>
              </div>

              {selectedLog.systemPrompt && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">系统提示词</p>
                    <button
                      onClick={() => copyToClipboard(selectedLog.systemPrompt || '', 'systemPrompt')}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {copiedField === 'systemPrompt' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {selectedLog.systemPrompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Logs;
