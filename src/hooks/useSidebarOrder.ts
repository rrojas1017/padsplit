import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type MenuGroup = 'core' | 'admin';

interface OrderEntry {
  path: string;
  group: MenuGroup;
}

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[];
  group: MenuGroup;
}

const STORAGE_KEY = 'sidebar-custom-order';
const PREFERENCE_KEY = 'sidebar_custom_order';

function loadOrderFromLocal(): OrderEntry[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(e => e.path && e.group)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveOrderToLocal(order: OrderEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function useSidebarOrder(userId?: string) {
  const [savedOrder, setSavedOrder] = useState<OrderEntry[] | null>(() => loadOrderFromLocal());
  const dbLoaded = useRef(false);

  // Load from database on mount (source of truth)
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
        if (data?.preference_value) {
          const order = data.preference_value as unknown as OrderEntry[];
          if (Array.isArray(order) && order.every(e => e.path && e.group)) {
            setSavedOrder(order);
            saveOrderToLocal(order);
            return;
          }
        }
        // No DB record — if localStorage has something, push it to DB
        const local = loadOrderFromLocal();
        if (local) {
          setSavedOrder(local);
          upsertToDb(userId, local);
        }
      });
  }, [userId]);

  const upsertToDb = useCallback(async (uid: string, order: OrderEntry[]) => {
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

  const getOrderedItems = useCallback((visibleItems: MenuItem[]): MenuItem[] => {
    if (!savedOrder) return visibleItems;

    const itemMap = new Map(visibleItems.map(item => [item.path, item]));
    const ordered: MenuItem[] = [];
    const seen = new Set<string>();

    for (const entry of savedOrder) {
      const item = itemMap.get(entry.path);
      if (item) {
        ordered.push({ ...item, group: entry.group });
        seen.add(entry.path);
      }
    }

    for (const item of visibleItems) {
      if (!seen.has(item.path)) {
        ordered.push(item);
      }
    }

    return ordered;
  }, [savedOrder]);

  const moveItem = useCallback((
    itemPath: string,
    targetGroup: MenuGroup,
    targetIndex: number,
    currentItems: MenuItem[]
  ) => {
    const entries: OrderEntry[] = currentItems.map(item => ({
      path: item.path,
      group: item.group,
    }));

    const draggedIdx = entries.findIndex(e => e.path === itemPath);
    if (draggedIdx === -1) return;
    const [dragged] = entries.splice(draggedIdx, 1);
    dragged.group = targetGroup;

    const groupItems = entries.filter(e => e.group === targetGroup);
    const otherItems = entries.filter(e => e.group !== targetGroup);

    const clampedIndex = Math.min(targetIndex, groupItems.length);
    groupItems.splice(clampedIndex, 0, dragged);

    let newOrder: OrderEntry[];
    if (targetGroup === 'core') {
      newOrder = [...groupItems, ...otherItems.filter(e => e.group === 'admin')];
    } else {
      newOrder = [...otherItems.filter(e => e.group === 'core'), ...groupItems];
    }

    saveOrderToLocal(newOrder);
    setSavedOrder(newOrder);
    if (userId) upsertToDb(userId, newOrder);
  }, [userId, upsertToDb]);

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

  const hasCustomOrder = savedOrder !== null;

  return { getOrderedItems, moveItem, resetOrder, hasCustomOrder };
}
