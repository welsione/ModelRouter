import React, { useState, useEffect } from 'react';
import { Activity, Bot, FileText, Settings, LayoutDashboard, Moon, Sun, MessageCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Strategies from './pages/Strategies';
import Logs from './pages/Logs';
import SettingsPage from './pages/Settings';
import ChatTest from './pages/ChatTest';
import ModelDetail from './pages/ModelDetail';
import StrategyDetail from './pages/StrategyDetail';

function App() {
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
  const [appConfig, setAppConfig] = useState({ name: 'ModelRouter', description: 'Smart Model Router' });

  useEffect(() => {
    fetch('/api/app/settings')
      .then(res => res.json())
      .then(data => {
        if (data.defaults) {
          setAppConfig({
            name: data.defaults.name || 'ModelRouter',
            description: data.defaults.description || 'Smart Model Router'
          });
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const detectTheme = () => {
      if (window.electronAPI) {
        window.electronAPI.getTheme().then(t => {
          setTheme(t);
          document.documentElement.classList.toggle('dark', t === 'dark');
        });
        window.electronAPI.onThemeChanged((isDark) => {
          const newTheme = isDark ? 'dark' : 'light';
          setTheme(newTheme);
          document.documentElement.classList.toggle('dark', isDark);
        });
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const detected = prefersDark ? 'dark' : 'light';
        setTheme(detected);
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };
    detectTheme();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const menuItems = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
    { id: 'chat', label: '对话测试', icon: MessageCircle },
    { id: 'models', label: '模型管理', icon: Bot },
    { id: 'strategies', label: '路由策略', icon: Activity },
    { id: 'logs', label: '请求日志', icon: FileText },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  const renderContent = () => {
    if (selectedModelId) {
      return <ModelDetail modelId={selectedModelId} onBack={() => setSelectedModelId(null)} />;
    }
    if (selectedStrategyId) {
      return <StrategyDetail strategyId={selectedStrategyId} onBack={() => setSelectedStrategyId(null)} />;
    }
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'chat': return <ChatTest />;
      case 'models': return <Models onSelectModel={setSelectedModelId} />;
      case 'strategies': return <Strategies onSelectStrategy={setSelectedStrategyId} />;
      case 'logs': return <Logs />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <aside className={`w-56 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-r ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} flex flex-col`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            {appConfig.name}
          </h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {appConfig.description}
          </p>
        </div>
        
        <nav className="flex-1 p-2 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedModelId(null); setSelectedStrategyId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                activeTab === item.id
                  ? 'bg-primary text-white'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg w-full ${
              theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
