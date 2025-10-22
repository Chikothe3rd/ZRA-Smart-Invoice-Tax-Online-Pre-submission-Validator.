import { useState, useEffect } from 'react';
import { ValidationHistory } from '@/types';

const STORAGE_KEY = 'zra_validation_history';
const MAX_HISTORY_ITEMS = 50;

export function useValidationHistory() {
  const [history, setHistory] = useState<ValidationHistory[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load validation history:', error);
    }
  }, []);

  // Save to localStorage whenever history changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save validation history:', error);
    }
  }, [history]);

  const addToHistory = (item: Omit<ValidationHistory, 'id' | 'timestamp'>) => {
    const newItem: ValidationHistory = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev];
      return updated.slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  return {
    history,
    addToHistory,
    clearHistory,
    removeItem,
  };
}
