import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ChatContext = createContext(null);
const STORAGE_KEY = 'neuromarket_ai_chat_v1';

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
      return null;
    } catch {
      return null;
    }
  });

  const value = useMemo(
    () => ({
      messages: messages || [{ role: 'bot', text: 'Hello! I am your NeuroMarket AI Assistant. How can I help you today?' }],
      setMessages,
      clear: () => setMessages([{ role: 'bot', text: 'Hello! I am your NeuroMarket AI Assistant. How can I help you today?' }]),
    }),
    [messages]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value.messages));
    } catch {}
  }, [value.messages]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};

