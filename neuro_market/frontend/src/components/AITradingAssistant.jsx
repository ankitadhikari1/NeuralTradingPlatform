import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, MessageSquare, Loader2 } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';
import { useChat } from '../context/ChatContext';

const AITradingAssistant = () => {
  const { emotion } = useEmotion();
  const { messages, setMessages } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const hasBriefRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (hasBriefRef.current) return;
    if (!Array.isArray(messages) || messages.length > 1) return;
    hasBriefRef.current = true;

    const run = async () => {
      try {
        const resp = await axios.get('/ai/brief');
        const b = resp.data || {};
        const gainers = (b.top_gainers || [])
          .map((x) => `${x.symbol} ${Number(x.change_percent).toFixed(2)}%`)
          .join(' • ');
        const losers = (b.top_losers || [])
          .map((x) => `${x.symbol} ${Number(x.change_percent).toFixed(2)}%`)
          .join(' • ');
        const headlines = (b.headlines || []).slice(0, 5).map((h) => `- ${h}`).join('\n');

        const text = [
          `Market Brief (${String(b.sentiment || 'Neutral')})`,
          `Breadth: ${b?.breadth?.gainers ?? 0} gainers / ${b?.breadth?.losers ?? 0} losers`,
          gainers ? `Top gainers: ${gainers}` : null,
          losers ? `Top losers: ${losers}` : null,
          headlines ? `News:\n${headlines}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        setMessages((prev) => [...prev, { role: 'bot', text }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: 'Market Brief is unavailable right now. Try again in a moment.' },
        ]);
      }
    };

    run();
  }, [messages, setMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const resp = await axios.post('/ai/chat', { message: userMsg });
      setMessages(prev => [...prev, { role: 'bot', text: resp.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm sorry, I'm having trouble connecting to the brain center right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-[400px] flex flex-col p-0 overflow-hidden bg-slate-900/40 backdrop-blur-xl border-slate-700/50">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-xl text-blue-500">
            <Bot size={20} />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Start new chat"
            onClick={() => setMessages([{ role: 'bot', text: 'Hello! I am your NeuroMarket AI Assistant. How can I help you today?' }])}
          >
            New Chat
          </button>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${emotion?.state === 'Calm' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
            Emotion Guard: {emotion?.state || 'OFFLINE'}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-xl h-fit shrink-0 ${msg.role === 'user' ? 'bg-blue-600/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm font-medium shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50'}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="p-2 rounded-xl h-fit bg-slate-800 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50">
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-slate-500 animate-bounce"></div>
                  <div className="w-1 h-1 rounded-full bg-slate-500 animate-bounce delay-100"></div>
                  <div className="w-1 h-1 rounded-full bg-slate-500 animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-slate-950/40 border-t border-slate-800">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for trading advice or about your emotions..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 transition-all outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400 disabled:text-slate-700 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AITradingAssistant;
