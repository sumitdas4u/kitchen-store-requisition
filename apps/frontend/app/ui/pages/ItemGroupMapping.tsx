'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { Save, Loader } from 'lucide-react';

type WarehouseItem = { id: number; warehouse: string; item_code: string; company: string };
type ErpWarehouse = { name: string };
type ErpItemGroup = { name: string };
type ErpItem = { name: string; item_name: string; item_group: string; stock_uom: string };
type ErpCompany = { name: string; company_name?: string };

// Tri-state checkbox component
function TriCheckbox({
  state,
  onChange,
}: {
  state: 'none' | 'partial' | 'all';
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = state === 'partial';
    ref.current.checked = state === 'all';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-orange-500"
    />
  );
}

export function ItemGroupMapping() {
  const token = useAuthGuard('/admin/login');

  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [itemGroups, setItemGroups] = useState<ErpItemGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  // Working selection state: item_code → true means "should be mapped"
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  // Saved state: item_code → WarehouseItem.id (for DELETE calls)
  const [originalItems, setOriginalItems] = useState<Map<string, number>>(new Map());

  // Cache of items per group
  const [itemsCache, setItemsCache] = useState<Map<string, ErpItem[]>>(new Map());
  const [prefetching, setPrefetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);

  // ── Bootstrap: load companies + item groups ───────────────────────────────
  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<ErpCompany[]>('/admin/erp/companies', 'GET', undefined, token),
      apiRequest<ErpItemGroup[]>('/admin/erp/item-groups', 'GET', undefined, token),
    ]).then(([c, g]) => {
      setCompanies(c);
      setItemGroups(g);
      if (g.length > 0) setSelectedGroup(g[0].name);
      if (c.length > 0) setSelectedCompany(c[0].name);
    }).catch(() => {});
  }, [token]);

  // ── Load warehouses when company changes ──────────────────────────────────
  useEffect(() => {
    if (!token || !selectedCompany) return;
    apiRequest<ErpWarehouse[]>(
      `/admin/erp/warehouses?company=${encodeURIComponent(selectedCompany)}`,
      'GET', undefined, token
    ).then((w) => {
      setWarehouses(w);
      if (w.length > 0) setSelectedWarehouse(w[0].name);
    }).catch(() => setWarehouses([]));
  }, [token, selectedCompany]);

  // ── Load mapped items when warehouse changes ──────────────────────────────
  const loadMappedItems = useCallback(async (warehouse: string, tk: string) => {
    setLoadingWarehouse(true);
    try {
      const data = await apiRequest<WarehouseItem[]>(
        `/admin/warehouse-items/${encodeURIComponent(warehouse)}`,
        'GET', undefined, tk
      );
      const orig = new Map<string, number>();
      data.forEach((r) => orig.set(r.item_code, r.id));
      setOriginalItems(orig);
      setSelectedItems(new Set(orig.keys()));
    } finally {
      setLoadingWarehouse(false);
    }
  }, []);

  useEffect(() => {
    if (!token || !selectedWarehouse) return;
    loadMappedItems(selectedWarehouse, token);
  }, [token, selectedWarehouse, loadMappedItems]);

  // ── Bulk-prefetch ALL groups' items when groups are loaded ────────────────
  useEffect(() => {
    if (!token || itemGroups.length === 0) return;
    setPrefetching(true);
    const allGroupNames = itemGroups.map((g) => g.name).join(',');
    apiRequest<ErpItem[]>(
      `/admin/erp/items?item_groups=${encodeURIComponent(allGroupNames)}`,
      'GET', undefined, token
    ).then((items) => {
      const byGroup = new Map<string, ErpItem[]>();
      itemGroups.forEach((g) => byGroup.set(g.name, []));
      items.forEach((item) => {
        const arr = byGroup.get(item.item_group);
        if (arr) arr.push(item);
      });
      setItemsCache(byGroup);
    }).catch(() => {}).finally(() => setPrefetching(false));
  }, [token, itemGroups]);

  const currentItems = itemsCache.get(selectedGroup) ?? [];

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (selectedItems.size !== originalItems.size) return true;
    for (const code of selectedItems) {
      if (!originalItems.has(code)) return true;
    }
    return false;
  }, [selectedItems, originalItems]);

  // ── Group tri-state ───────────────────────────────────────────────────────
  function groupState(groupName: string): 'none' | 'partial' | 'all' {
    const groupItems = itemsCache.get(groupName);
    if (!groupItems || groupItems.length === 0) return 'none';
    const mapped = groupItems.filter((i) => selectedItems.has(i.name)).length;
    if (mapped === 0) return 'none';
    if (mapped === groupItems.length) return 'all';
    return 'partial';
  }

  function groupMappedCount(groupName: string): number {
    const groupItems = itemsCache.get(groupName);
    if (!groupItems) return 0;
    return groupItems.filter((i) => selectedItems.has(i.name)).length;
  }

  // ── Toggle single item ────────────────────────────────────────────────────
  function toggleItem(code: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  // ── Bulk: toggle all items in current group ───────────────────────────────
  function toggleGroup(groupName: string) {
    const groupItems = itemsCache.get(groupName);
    if (!groupItems || groupItems.length === 0) return;
    const state = groupState(groupName);
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (state === 'all' || state === 'partial') {
        groupItems.forEach((i) => next.delete(i.name));
      } else {
        groupItems.forEach((i) => next.add(i.name));
      }
      return next;
    });
  }

  // ── Select / Deselect all in current group ────────────────────────────────
  function selectAllInGroup() {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      currentItems.forEach((i) => next.add(i.name));
      return next;
    });
  }

  function deselectAllInGroup() {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      currentItems.forEach((i) => next.delete(i.name));
      return next;
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!token || !selectedWarehouse) return;
    setSaving(true);
    setSaveError(null);
    try {
      const toAdd = [...selectedItems].filter((code) => !originalItems.has(code));
      const toRemove = [...originalItems.entries()].filter(([code]) => !selectedItems.has(code));

      await Promise.all([
        ...toAdd.map((code) =>
          apiRequest('/admin/warehouse-items', 'POST', {
            warehouse: selectedWarehouse,
            item_code: code,
            company: selectedCompany,
          }, token)
        ),
        ...toRemove.map(([, id]) =>
          apiRequest(`/admin/warehouse-items/${id}`, 'DELETE', undefined, token)
        ),
      ]);

      await loadMappedItems(selectedWarehouse, token);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = useMemo(() => {
    let count = 0;
    for (const code of selectedItems) if (!originalItems.has(code)) count++;
    for (const [code] of originalItems) if (!selectedItems.has(code)) count++;
    return count;
  }, [selectedItems, originalItems]);

  return (
    <DesktopLayout>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* ── Top bar: company + warehouse tabs ── */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4 flex-shrink-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm text-gray-500 whitespace-nowrap">Company:</span>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {companies.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {warehouses.map((wh) => (
              <button
                key={wh.name}
                onClick={() => setSelectedWarehouse(wh.name)}
                className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
                  selectedWarehouse === wh.name
                    ? 'border-primary text-primary bg-orange-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {wh.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body: left groups + right items ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: item groups */}
          <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Item Groups</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {itemGroups.filter((group) => {
                if (prefetching) return true; // show all while loading
                return (itemsCache.get(group.name) ?? []).length > 0;
              }).map((group) => {
                const state = groupState(group.name);
                const count = groupMappedCount(group.name);
                const isActive = selectedGroup === group.name;
                return (
                  <div
                    key={group.name}
                    onClick={() => setSelectedGroup(group.name)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-2 transition-colors ${
                      isActive
                        ? 'border-primary bg-orange-50'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div onClick={(e) => { e.stopPropagation(); toggleGroup(group.name); }}>
                      <TriCheckbox
                        state={state}
                        onChange={() => toggleGroup(group.name)}
                      />
                    </div>
                    <span className={`flex-1 text-sm truncate ${isActive ? 'text-primary font-medium' : 'text-gray-700'}`}>
                      {group.name}
                    </span>
                    {count > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 font-medium">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: items panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

            {/* Items header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-medium text-gray-900">
                  {selectedGroup || 'Select a group'}
                </h2>
                {currentItems.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {currentItems.filter((i) => selectedItems.has(i.name)).length} / {currentItems.length} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllInGroup}
                  disabled={!currentItems.length}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllInGroup}
                  disabled={!currentItems.length}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Deselect All
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving || loadingWarehouse}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : isDirty ? `Save (${pendingCount})` : 'Saved'}
                </button>
              </div>
            </div>

            {/* Items grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {(prefetching || loadingWarehouse) ? (
                <div className="flex items-center justify-center h-40 text-gray-400">
                  <Loader className="w-6 h-6 animate-spin mr-2" />
                  Loading...
                </div>
              ) : currentItems.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  No items in this group
                </div>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {currentItems.map((item) => {
                    const isSelected = selectedItems.has(item.name);
                    return (
                      <label
                        key={item.name}
                        className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-primary bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(item.name)}
                          className="w-4 h-4 rounded border-gray-300 accent-orange-500 cursor-pointer flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${isSelected ? 'text-primary font-medium' : 'text-gray-900'}`}>
                            {item.item_name || item.name}
                          </div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">{item.name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {saveError && (
                <p className="mt-4 text-sm text-red-600">{saveError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
