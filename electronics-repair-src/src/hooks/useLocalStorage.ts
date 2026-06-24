import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const getStored = useCallback((): T => {
    try {
      const item = localStorage.getItem(key);
      if (item) return JSON.parse(item);
    } catch {}
    return initialValue;
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(getStored);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {}
  }, [key, storedValue]);

  const setValue = (value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = value instanceof Function ? value(prev) : value;
      return next;
    });
  };

  return [storedValue, setValue];
}
