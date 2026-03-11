import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, RefreshCw, Copy, Check, History, X } from 'lucide-react';

const STORAGE_KEY = 'modelrouter_chat_history';

function ChatTest() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的 AI 助手。有什么可以帮你的吗？', model: null, reason: null }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveSessions = (newSessions) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
    setSessions(newSessions);
  };

  const updateCurrentSession = (newMessages) => {
    if (!currentSessionId) return;
    const newSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        const title = newMessages.find(m => m.role === 'user')?.content?.substring(0, 20) || '新对话';
        return { ...s, messages: newMessages, title: s.title === '新对话' ? title + '...' : s.title };
      }
      return s;
    });
    saveSessions(newSessions);
  };

  const createNewSession = () => {
    const newSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [{ role: 'assistant', content: '你好！我是你的 AI 助手。有什么可以帮你的吗？', model: null, reason: null }],
      createdAt: new Date().toISOString()
    };
    const newSessions = [newSession, ...sessions];
    saveSessions(newSessions);
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
  };

  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const deleteSession = (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这个会话吗？')) return;
    const newSessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(newSessions);
    if (currentSessionId === sessionId) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
        setMessages(newSessions[0].messages);
      } else {
        createNewSession();
      }
    }
  };

  const sendMessage = async (e) => {
    if (!input.trim() || loading) return;
    e.preventDefault();
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
    const userMsg = { role: 'user', content: userMessage };
    const assistantMsg = { role: 'assistant', content: '', model: null, reason: null, isStreaming: true };
    
    const newMessages = [...messagesRef.current, userMsg, assistantMsg];
    setMessages(newMessages);
    updateCurrentSession(newMessages);

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesRef.current.filter(m => m.role !== 'assistant' || m.content).map(m => ({
            role: m.role,
            content: m.content
          })).concat([{ role: 'user', content: userMessage }]),
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const currentMsgs = messagesRef.current;
        const errorMessages = [...currentMsgs, { 
          role: 'system', 
          content: `错误: ${response.status} - ${errorText}`,
          model: null,
          reason: null
        }];
        setMessages(errorMessages);
        updateCurrentSession(errorMessages);
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullContent = '';
      let currentModel = null;
      let currentReason = null;
      let routingInfoSet = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const sepIndex = buffer.indexOf('\n\n');
          if (sepIndex === -1) break;

          const eventBlock = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          if (!eventBlock.trim()) continue;

          const dataLines = eventBlock.split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.substring(5).trimStart());

          if (dataLines.length === 0) continue;
          const dataStr = dataLines.join('\n').trim();

          // Skip [DONE] marker if present
          if (dataStr === '[DONE]' || dataStr === '"[DONE]"') {
            continue;
          }

          try {
            const data = JSON.parse(dataStr);

            if (!currentModel && data.model) {
              currentModel = data.model;
            }

            if (!routingInfoSet && data.routing && data.routing.selectedModelId) {
              currentReason = data.routing.reason || 'AI路由';
              routingInfoSet = true;
            }

            if (data.choices && data.choices[0]) {
              const delta = data.choices[0].delta;
              const finishReason = data.choices[0].finish_reason;
              
              if (delta && delta.content) {
                fullContent += delta.content;
                
                const currentMsgs = messagesRef.current;
                const updatedMessages = currentMsgs.map((m, i) => {
                  if (i === currentMsgs.length - 1 && m.role === 'assistant') {
                    return { 
                      ...m, 
                      content: fullContent, 
                      model: currentModel, 
                      reason: currentReason ? `路由: ${currentReason}` : null,
                      isStreaming: finishReason !== 'stop'
                    };
                  }
                  return m;
                });
                setMessages(updatedMessages);
              }
              
              if (finishReason === 'stop') {
                const currentMsgs = messagesRef.current;
                const finalMessages = currentMsgs.map((m, i) => {
                  if (i === currentMsgs.length - 1 && m.role === 'assistant') {
                    return { 
                      ...m, 
                      content: fullContent,
                      isStreaming: false,
                      model: currentModel,
                      reason: currentReason ? `路由: ${currentReason}` : null
                    };
                  }
                  return m;
                });
                setMessages(finalMessages);
                updateCurrentSession(finalMessages);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
      
      const currentMsgs = messagesRef.current;
      const completedMessages = currentMsgs.map((m, i) => {
        if (i === currentMsgs.length - 1) {
          return { ...m, isStreaming: false };
        }
        return m;
      });
      setMessages(completedMessages);
      updateCurrentSession(completedMessages);
      setLoading(false);
    } catch (error) {
      const currentMsgs = messagesRef.current;
      const errorMessages = currentMsgs.map((m, i) => {
        if (i === currentMsgs.length - 1) {
          return { 
            role: 'system', 
            content: `网络错误: ${error.message}`,
            model: null,
            reason: null
          };
        }
        return m;
      });
      setMessages(errorMessages);
      updateCurrentSession(errorMessages);
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('确定要清空当前对话吗？')) {
      const clearedMessages = [{ role: 'assistant', content: '对话已清空。请问有什么可以帮您？', model: null, reason: null }];
      setMessages(clearedMessages);
      updateCurrentSession(clearedMessages);
    }
  };

  const copyMessage = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatContent = (content) => {
    if (!content) return '';
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">对话测试</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <History size={16} />
            历史
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={createNewSession}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <RefreshCw size={16} />
            新建会话
          </button>
          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Trash2 size={16} />
            清空
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">会话历史</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">暂无会话记录</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                    currentSessionId === session.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(e, session.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : msg.role === 'system'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
              />
              
              {msg.role === 'assistant' && (msg.model || msg.reason) && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs space-y-1">
                  {msg.model && (
                    <p className="text-gray-500 dark:text-gray-400">
                      <span className="font-medium">模型:</span> {msg.model}
                    </p>
                  )}
                  {msg.reason && (
                    <p className="text-gray-500 dark:text-gray-400">
                      <span className="font-medium">路由:</span> {msg.reason}
                    </p>
                  )}
                </div>
              )}

              {msg.content && msg.role !== 'user' && (
                <button
                  onClick={() => copyMessage(msg.content, idx)}
                  className="mt-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {copiedId === idx ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500">
                <RefreshCw size={16} className="animate-spin" />
                <span>思考中...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={sendMessage} className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            placeholder="请输入消息... (回车发送，Shift+Enter 换行)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
            rows={2}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatTest;
