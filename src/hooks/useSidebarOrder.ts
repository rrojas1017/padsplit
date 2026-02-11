import { useState, useCallback } from 'react';

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

function loadOrder(): OrderEntry[] | null {
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

function saveOrder(order: OrderEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function useSidebarOrder() {
  const [savedOrder, setSavedOrder] = useState<OrderEntry[] | null>(() => loadOrder());

  const getOrderedItems = useCallback((visibleItems: MenuItem[]): MenuItem[] => {
    if (!savedOrder) return visibleItems;

    const itemMap = new Map(visibleItems.map(item => [item.path, item]));
    const ordered: MenuItem[] = [];
    const seen = new Set<string>();

    // Place items in saved order, applying saved group
    for (const entry of savedOrder) {
      const item = itemMap.get(entry.path);
      if (item) {
        ordered.push({ ...item, group: entry.group });
        seen.add(entry.path);
      }
      // silently skip removed items
    }

    // Append new items not in saved order at end of their default group
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
    // Build current order entries
    const entries: OrderEntry[] = currentItems.map(item => ({
      path: item.path,
      group: item.group,
    }));

    // Find and remove the dragged item
    const draggedIdx = entries.findIndex(e => e.path === itemPath);
    if (draggedIdx === -1) return;
    const [dragged] = entries.splice(draggedIdx, 1);
    dragged.group = targetGroup;

    // Get items in target group after removal
    const groupItems = entries.filter(e => e.group === targetGroup);
    const otherItems = entries.filter(e => e.group !== targetGroup);

    // Clamp target index
    const clampedIndex = Math.min(targetIndex, groupItems.length);
    groupItems.splice(clampedIndex, 0, dragged);

    // Reconstruct: core first, then admin
    const coreEntries = (targetGroup === 'core' ? groupItems : otherItems.filter(e => e.group === 'core'));
    const adminEntries = (targetGroup === 'admin' ? groupItems : otherItems.filter(e => e.group === 'admin'));

    // If target is core, we need non-core from otherItems for admin
    let newOrder: OrderEntry[];
    if (targetGroup === 'core') {
      newOrder = [...coreEntries, ...otherItems.filter(e => e.group === 'admin')];
    } else {
      newOrder = [...otherItems.filter(e => e.group === 'core'), ...adminEntries];
    }

    saveOrder(newOrder);
    setSavedOrder(newOrder);
  }, []);

  const resetOrder = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedOrder(null);
  }, []);

  const hasCustomOrder = savedOrder !== null;

  return { getOrderedItems, moveItem, resetOrder, hasCustomOrder };
}
