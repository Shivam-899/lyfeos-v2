import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getStoredJson, setStoredJson } from "@/utils/storage";
import { syncTodosToCloud, fetchTodosFromCloud } from "@/utils/cloudSync";
import { useAuth } from "@/context/AuthContext";
import { getNextRecurringDate } from "@/utils/date";

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
  const { user, isGuest } = useAuth();
  // Keep a ref so callbacks always see the latest user/isGuest without re-creating them
  const authRef = useRef({ user, isGuest });
  useEffect(() => { authRef.current = { user, isGuest }; }, [user, isGuest]);

  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    (async () => {
      const parsed = await getStoredJson<Todo[]>(TODOS_KEY, []);
      // Migrate old "high" priority data — keep as-is, just ensure all have valid priority
      setTodos(parsed);

      // Cloud sync: fetch from Firestore if logged-in non-guest user
      if (user && !isGuest) {
        const cloudTodos = await fetchTodosFromCloud(user.uid);
        if (cloudTodos && cloudTodos.length > 0) {
          setTodos(cloudTodos);
          await setStoredJson(TODOS_KEY, cloudTodos);
        }
      }
    })();
  }, [user, isGuest]);

  const persist = useCallback(async (items: Todo[]) => {
    await setStoredJson(TODOS_KEY, items);
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
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const isCompleting = !target.completed;
      let next = prev.map((t) => t.id === id ? { ...t, completed: isCompleting } : t);

      // If completing a recurring todo, generate the next uncompleted occurrence
      if (isCompleting && target.repeat && target.repeat !== "none") {
        const nextDueDate = getNextRecurringDate(target.dueDate, target.repeat);

        // Prevent duplicate next occurrences if one is already active
        const duplicateExists = prev.some(
          (t) => !t.completed && t.title === target.title && t.dueDate === nextDueDate && t.repeat === target.repeat
        );

        if (!duplicateExists) {
          const maxOrder = prev.length > 0 ? Math.max(...prev.map((t) => t.order)) + 1 : 0;
          const nextTodo: Todo = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: target.title,
            completed: false,
            priority: target.priority,
            category: target.category,
            dueDate: nextDueDate,
            dueTime: target.dueTime,
            notes: target.notes,
            repeat: target.repeat,
            createdAt: new Date().toISOString(),
            order: maxOrder,
          };
          next = [...next, nextTodo];
        }
      }

      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    setTodos((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, ...updates } : t);
      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
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
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, reordered); }
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
