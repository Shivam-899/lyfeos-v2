import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getStoredJson, setStoredJson } from "@/utils/storage";
import { syncTodosToCloud, fetchTodosFromCloud, mergeTodos, normalizeTodo } from "@/utils/cloudSync";
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
  updatedAt: number;
  deletedAt?: number;
  seriesId?: string;
}

interface TodosContextType {
  todos: Todo[];
  addTodo: (todo: Omit<Todo, "id" | "createdAt" | "order" | "updatedAt">) => void;
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

  // rawTodos contains all items including active and soft-deleted tombstones
  const [rawTodos, setRawTodos] = useState<Todo[]>([]);

  // Public todos exposed to UI contains only active, non-tombstoned items
  const todos = useMemo(() => rawTodos.filter((t) => !t.deletedAt), [rawTodos]);

  useEffect(() => {
    (async () => {
      const parsed = await getStoredJson<any[]>(TODOS_KEY, []);
      const localNormalized: Todo[] = parsed.map(normalizeTodo);
      setRawTodos(localNormalized);

      // Cloud sync: fetch from Firestore if logged-in non-guest user
      if (user && !isGuest) {
        const cloudRaw = await fetchTodosFromCloud(user.uid);
        if (cloudRaw !== null) {
          const merged: Todo[] = mergeTodos(localNormalized, cloudRaw);
          setRawTodos(merged);
          await setStoredJson(TODOS_KEY, merged);

          // If local had changes/additions not yet in cloud, push merged state back to cloud
          const cloudNormalized = cloudRaw.map(normalizeTodo);
          const needsSync =
            merged.length !== cloudNormalized.length ||
            JSON.stringify(merged) !== JSON.stringify(cloudNormalized);

          if (needsSync) {
            syncTodosToCloud(user.uid, merged);
          }
        }
      }
    })();
  }, [user, isGuest]);

  const persist = useCallback(async (items: Todo[]) => {
    await setStoredJson(TODOS_KEY, items);
  }, []);

  const addTodo = useCallback((todo: Omit<Todo, "id" | "createdAt" | "order" | "updatedAt">) => {
    setRawTodos((prev) => {
      const now = Date.now();
      const active = prev.filter((t) => !t.deletedAt);
      const maxOrder = active.length > 0 ? Math.max(...active.map((t) => t.order)) + 1 : 0;
      const isRecurring = todo.repeat && todo.repeat !== "none";
      const newTodo: Todo = {
        ...todo,
        id: now.toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date(now).toISOString(),
        updatedAt: now,
        order: maxOrder,
        ...(isRecurring ? { seriesId: now.toString() + Math.random().toString(36).substr(2, 9) } : {}),
      };
      const next = [...prev, newTodo];
      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const toggleTodo = useCallback((id: string) => {
    setRawTodos((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const now = Date.now();
      const isCompleting = !target.completed;
      let next = prev.map((t) => t.id === id ? { ...t, completed: isCompleting, updatedAt: now } : t);

      // If completing a recurring todo, generate the next uncompleted occurrence
      if (isCompleting && target.repeat && target.repeat !== "none") {
        const nextDueDate = getNextRecurringDate(target.dueDate, target.repeat);
        const seriesId = target.seriesId || target.id;

        // Prevent duplicate next occurrences if one is already active
        const duplicateExists = prev.some(
          (t) => !t.deletedAt && !t.completed && (
            (t.seriesId && t.seriesId === seriesId && t.dueDate === nextDueDate) ||
            (t.title === target.title && t.dueDate === nextDueDate && t.repeat === target.repeat)
          )
        );

        if (!duplicateExists) {
          const active = prev.filter((t) => !t.deletedAt);
          const maxOrder = active.length > 0 ? Math.max(...active.map((t) => t.order)) + 1 : 0;
          const nextTodo: Todo = {
            id: now.toString() + Math.random().toString(36).substr(2, 9),
            title: target.title,
            completed: false,
            priority: target.priority,
            category: target.category,
            dueDate: nextDueDate,
            dueTime: target.dueTime,
            notes: target.notes,
            repeat: target.repeat,
            createdAt: new Date(now).toISOString(),
            updatedAt: now,
            order: maxOrder,
            seriesId,
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
    setRawTodos((prev) => {
      const now = Date.now();
      // Soft-delete: mark with deletedAt timestamp so tombstone propagates across devices
      const next = prev.map((t) => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t);
      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    setRawTodos((prev) => {
      const now = Date.now();
      const next = prev.map((t) => t.id === id ? { ...t, ...updates, updatedAt: now } : t);
      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
    });
  }, [persist]);

  const reorderTodos = useCallback((fromIdx: number, toIdx: number) => {
    setRawTodos((prev) => {
      const now = Date.now();
      const active = prev.filter((t) => !t.deletedAt);
      const tombstones = prev.filter((t) => t.deletedAt);

      const [removed] = active.splice(fromIdx, 1);
      active.splice(toIdx, 0, removed);
      const reorderedActive = active.map((t, i) => ({ ...t, order: i, updatedAt: now }));
      const next = [...reorderedActive, ...tombstones];

      persist(next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncTodosToCloud(u.uid, next); }
      return next;
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
