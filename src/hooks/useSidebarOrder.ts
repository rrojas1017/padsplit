import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SidebarGroupId =
  | 'my_work'
  | 'sales'
  | 'coaching'
  | 'research'
  | 'insights'
  | 'data'
  | 'admin';

type SavedOrder = Partial<Record<SidebarGroupId, string[]>>;

interface MenuItem {
  path: string;
}

const STORAGE_KEY = 'sidebar-custom-order-v2';
const PREFERENCE_KEY = 'sidebar_custom_order_v2';

function isSavedOrder(value: unknown): value is SavedOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (paths) => Array.isArray(paths) && paths.every((path) => typeof path === 'string')
  );
}

function loadOrderFromLocal(): SavedOrder | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedOrder(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveOrderToLocal(order: SavedOrder) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function useSidebarOrder(userId?: string) {
  const [savedOrder, setSavedOrder] = useState<SavedOrder | null>(() => loadOrderFromLocal());
  const dbLoaded = useRef(false);

  const upsertToDb = useCallback(async (uid: string, order: SavedOrder) => {
    await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: uid,
          preference_key: PREFERENCE_KEY,
          preference_value: order as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,preference_key' }
      );
  }, []);

  useEffect(() => {
    if (!userId || dbLoaded.current) return;
    dbLoaded.current = true;

    supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', userId)
      .eq('preference_key', PREFERENCE_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const databaseOrder = data?.preference_value;
        if (isSavedOrder(databaseOrder)) {
          setSavedOrder(databaseOrder);
          saveOrderToLocal(databaseOrder);
          return;
        }

        const localOrder = loadOrderFromLocal();
        if (localOrder) {
          setSavedOrder(localOrder);
          upsertToDb(userId, localOrder);
        }
      });
  }, [userId, upsertToDb]);

  const getOrderedItems = useCallback(<T extends MenuItem>(groupId: SidebarGroupId, items: T[]): T[] => {
    const paths = savedOrder?.[groupId];
    if (!paths) return items;

    const itemMap = new Map(items.map((item) => [item.path, item]));
    const ordered: T[] = [];
    const seen = new Set<string>();

    for (const path of paths) {
      const item = itemMap.get(path);
      if (item && !seen.has(path)) {
        ordered.push(item);
        seen.add(path);
      }
    }

    for (const item of items) {
      if (!seen.has(item.path)) ordered.push(item);
    }

    return ordered;
  }, [savedOrder]);

  const moveItem = useCallback((
    groupId: SidebarGroupId,
    itemPath: string,
    targetIndex: number,
    currentItems: MenuItem[]
  ) => {
    const paths = currentItems.map((item) => item.path);
    const draggedIndex = paths.indexOf(itemPath);
    if (draggedIndex === -1) return;

    const [draggedPath] = paths.splice(draggedIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, paths.length));
    paths.splice(clampedIndex, 0, draggedPath);

    const newOrder: SavedOrder = { ...(savedOrder ?? {}), [groupId]: paths };
    saveOrderToLocal(newOrder);
    setSavedOrder(newOrder);
    if (userId) upsertToDb(userId, newOrder);
  }, [savedOrder, userId, upsertToDb]);

  const resetOrder = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedOrder(null);
    if (userId) {
      supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('preference_key', PREFERENCE_KEY)
        .then();
    }
  }, [userId]);

  return {
    getOrderedItems,
    moveItem,
    resetOrder,
    hasCustomOrder: savedOrder !== null,
  };
}