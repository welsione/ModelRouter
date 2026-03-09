import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, RefreshCw, Copy, Check } from 'lucide-react';

function ChatTest() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的 AI 助手。有什么可以帮你的吗？', model: null, reason: null }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const [renderKey, setRenderKey] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    if (!input.trim() || loading) return;
    e.preventDefault();
    
    const userMessage = input.trim();
    setInput('');
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.filter(m => m.role !== 'assistant' || m.content).map(m => ({
            role: m.role,
            content: m.content
          })).concat([{ role: 'user', content: userMessage }]),
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: `错误: ${response.status} - ${errorText}`,
          model: null,
          reason: null
        }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullContent = '';
      let currentModel = null;
      let currentReason = null;

      setMessages(prev => [...prev, { role: 'assistant', content: '', model: null, reason: null }]);

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

          if (dataStr === '[DONE]' || dataStr === '"[DONE]"') {
            return;
          }

          try {
            const data = JSON.parse(dataStr);

            if (!currentModel && data.model) {
              currentModel = data.model;
            }

            if (!currentReason && data.routing && data.routing.selectedModelId) {
              currentReason = `路由原因: ${data.routing.reason || 'N/A'}`;
            }

            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              fullContent += data.choices[0].delta.content;
              
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  return [
                    ...newMsgs.slice(0, -1),
                    { ...lastMsg, content: fullContent, model: currentModel, reason: currentReason }
                  ];
                }
                return newMsgs;
              });
              
              // Force update to show streaming
              setRenderKey(k => k + 1);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `网络错误: ${error.message}`,
        model: null,
        reason: null
      }]);
    }
  };

  const clearChat = () => {
    if (window.confirm('确定要清空对话历史吗？')) {
      setMessages([{ role: 'assistant', content: '对话已清空。请问有什么可以帮您？', model: null, reason: null }]);
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
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">对话测试</h2>
        <button
          onClick={clearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <Trash2 size={16} />
          清空对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900" key={renderKey}>
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
