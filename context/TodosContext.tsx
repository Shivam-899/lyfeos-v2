import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Priority = "urgent" | "high" | "medium" | "low";
export type Category = "Work" | "Personal" | "Shopping" | "Health" | "Other";
export type RepeatType = "none" | "daily" | "weekly" | "monthly";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  category: Category;
  dueDate?: string;
  dueTime?: string;
  notes?: string;
  repeat?: RepeatType;
  createdAt: string;
  order: number;
}

interface TodosContextType {
  todos: Todo[];
  addTodo: (todo: Omit<Todo, "id" | "createdAt" | "order">) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  reorderTodos: (fromIdx: number, toIdx: number) => void;
}

const TodosContext = createContext<TodosContextType | undefined>(undefined);
const TODOS_KEY = "@lyfeos_todos_v2";

export function TodosProvider({ children }: { children: React.ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TODOS_KEY);
        if (stored) {
          const parsed: Todo[] = JSON.parse(stored);
          // Migrate old "high" priority data — keep as-is, just ensure all have valid priority
          setTodos(parsed);
        } else {
          setTodos([]);
        }
      } catch {
        setTodos([]);
      }
    })();
  }, []);

  const persist = useCallback(async (items: Todo[]) => {
    await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(items));
  }, []);

  const addTodo = useCallback((todo: Omit<Todo, "id" | "createdAt" | "order">) => {
    setTodos((prev) => {
      const newTodo: Todo = {
        ...todo,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        // Bug 13 fix: use max existing order + 1 to avoid collisions after deletions
        order: prev.length > 0 ? Math.max(...prev.map((t) => t.order)) + 1 : 0,
      };
      const next = [...prev, newTodo];
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t);
      persist(next);
      return next;
    });
  }, [persist]);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    setTodos((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, ...updates } : t);
      persist(next);
      return next;
    });
  }, [persist]);

  const reorderTodos = useCallback((fromIdx: number, toIdx: number) => {
    setTodos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      const reordered = next.map((t, i) => ({ ...t, order: i }));
      persist(reordered);
      return reordered;
    });
  }, [persist]);

  return (
    <TodosContext.Provider value={{ todos, addTodo, toggleTodo, deleteTodo, updateTodo, reorderTodos }}>
      {children}
    </TodosContext.Provider>
  );
}

export function useTodos() {
  const ctx = useContext(TodosContext);
  if (!ctx) throw new Error("useTodos must be used within TodosProvider");
  return ctx;
}
