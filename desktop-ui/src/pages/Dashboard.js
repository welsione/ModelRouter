import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Zap, Hash, Bot, Activity, Clock, TrendingUp } from 'lucide-react';

function Dashboard() {
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalTokens: 0,
    activeModels: 0,
    totalLatency: 0,
    avgLatency: 0
  });
  const [models, setModels] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [modelUsage, setModelUsage] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modelsRes, logsRes, strategiesRes] = await Promise.all([
        fetch('/api/config/models'),
        fetch('/api/config/logs'),
        fetch('/api/config/strategies')
      ]);
      
      const modelsData = await modelsRes.json();
      const logsData = await logsRes.json();
      const strategiesData = await strategiesRes.json();
      
      setModels(modelsData);
      setStrategies(strategiesData);
      
      let totalRequests = 0;
      let totalTokens = 0;
      let totalLatency = 0;
      
      const usageMap = {};
      
      modelsData.forEach(m => {
        if (m.requestCount) totalRequests += m.requestCount;
        if (m.totalTokens) totalTokens += m.totalTokens;
        if (m.totalLatency) totalLatency += m.totalLatency;
        
        usageMap[m.id] = { name: m.name, requests: m.requestCount || 0, tokens: m.totalTokens || 0 };
      });
      
      logsData.forEach(log => {
        if (usageMap[log.selectedModelId]) {
          usageMap[log.selectedModelId].requests += 1;
        }
      });
      
      const avgLatency = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
      
      setStats({ 
        totalRequests, 
        totalTokens, 
        activeModels: modelsData.length,
        totalLatency,
        avgLatency
      });
      
      const hourlyMap = {};
      const now = new Date();
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 3600000).getHours();
        hourlyMap[hour] = { hour: `${hour}:00`, requests: 0, tokens: 0 };
      }
      
      logsData.forEach(log => {
        const logHour = new Date(log.createTime).getHours();
        if (hourlyMap[logHour]) {
          hourlyMap[logHour].requests += 1;
        }
      });
      
      setHourlyData(Object.values(hourlyMap));
      
      const usageData = Object.values(usageMap)
        .filter(m => m.requests > 0)
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 5);
      
      setModelUsage(usageData);
      setRecentLogs(logsData.slice(0, 10));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const COLORS = ['#4285f4', '#22c55e', '#a855f7', '#f59e0b', '#ef4444'];

  const StatCard = ({ title, value, subtitle, color, icon: Icon }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100').replace('700', '100')} dark:bg-opacity-20`}>
          <Icon className={color} size={24} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">仪表盘</h2>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <TrendingUp size={16} />
          刷新
        </button>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="总请求数" value={stats.totalRequests} color="text-blue-600" icon={Zap} />
        <StatCard title="Token用量" value={stats.totalTokens} color="text-green-600" icon={Hash} />
        <StatCard title="活跃模型" value={stats.activeModels} color="text-purple-600" icon={Bot} />
        <StatCard title="策略数量" value={strategies.length} color="text-orange-600" icon={Activity} />
        <StatCard 
          title="平均延迟" 
          value={stats.avgLatency > 0 ? `${stats.avgLatency}ms` : '-'} 
          subtitle={stats.totalRequests > 0 ? `${stats.totalRequests}次请求` : ''}
          color="text-cyan-600" 
          icon={Clock} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">小时请求趋势</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line type="monotone" dataKey="requests" stroke="#4285f4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">模型使用分布</h3>
          {modelUsage.length > 0 ? (
            <div className="h-48 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelUsage}
                    dataKey="requests"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {modelUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              暂无数据
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">模型请求排行</h3>
          {modelUsage.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="requests" fill="#4285f4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              暂无数据
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Token用量排行</h3>
          {modelUsage.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...modelUsage].sort((a, b) => b.tokens - a.tokens).slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="tokens" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              暂无数据
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">最近请求</h3>
        </div>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">策略</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">模型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">原因</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log, idx) => (
                <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {log.createTime ? new Date(log.createTime).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {strategies.find(s => s.id === log.strategyId)?.name || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {models.find(m => m.id === log.selectedModelId)?.name || log.selectedModelId || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300 truncate max-w-xs">{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
