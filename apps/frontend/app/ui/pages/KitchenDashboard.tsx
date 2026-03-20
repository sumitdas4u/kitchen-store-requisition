'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { getWarehouses, getDefaultWarehouse } from '../../../lib/session';

type ReqStatus =
  | 'Draft'
  | 'Submitted'
  | 'Issued'
  | 'Partially Issued'
  | 'Completed'
  | 'Rejected';

interface ReqItem {
  item_code: string;
  item_name: string;
  requested_qty: number;
  issued_qty: number;
  received_qty: number;
  uom: string;
}

interface Requisition {
  id: number;
  requested_date: string;
  shift: string;
  status: ReqStatus;
  warehouse: string;
  notes?: string | null;
  items: ReqItem[];
  issued_at?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
}

type DateFilter = 'today' | 'yesterday' | 'custom';

const fmtDate = (d: string): string => {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
};

const timeAgo = (iso?: string | null): string => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins} min pehle` : `${Math.floor(mins / 60)} ghante pehle`;
};

const STATUS_MAP: Record<ReqStatus, { label: string; bg: string; color: string }> = {
  Draft: { label: 'Draft', bg: '#F1F5F9', color: '#475569' },
  Submitted: { label: 'Store se aana baki', bg: '#EFF6FF', color: '#1D4ED8' },
  Issued: { label: 'Aaya — accept karo', bg: '#FFF7ED', color: '#C2410C' },
  'Partially Issued': { label: 'Kuch aaya — accept karo', bg: '#FFFBEB', color: '#92400E' },
  Completed: { label: 'Done', bg: '#F0FDF4', color: '#166534' },
  Rejected: { label: 'Cancel', bg: '#FEF2F2', color: '#991B1B' }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;
  --am:#D97706;--ambg:#FFFBEB;--ambr:#FDE68A;
  --bl:#1D4ED8;--blbg:#EFF6FF;--blbr:#BFDBFE;
  --line:#E5E7EB;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased}
.app{max-width:420px;margin:0 auto;min-height:100vh;background:var(--bg)}

/* TOP NAV */
.top{background:var(--dk);padding:14px 16px;display:flex;align-items:center;
  justify-content:space-between;position:sticky;top:0;z-index:50}
.top-title{font-size:16px;font-weight:900;color:#fff}
.top-sub{font-size:11px;color:#6B7280;margin-top:1px;font-weight:700}
.new-btn{padding:7px 13px;background:var(--or);color:#fff;border:none;border-radius:8px;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer}
.new-btn:active{background:#EA6C04}

/* CARDS */
.cards{display:flex;gap:8px;padding:12px}
.card{flex:1;background:var(--wh);border-radius:12px;padding:12px 10px;
  text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.07)}
.card-num{font-family:'DM Mono',monospace;font-size:24px;font-weight:700;
  display:block;line-height:1}
.card-lbl{font-size:10px;font-weight:800;color:var(--lt);text-transform:uppercase;
  letter-spacing:.05em;display:block;margin-top:4px}
.card.alert .card-num{color:var(--or)}
.card.done  .card-num{color:var(--gn)}
.card.blue  .card-num{color:var(--bl)}
.card.grey  .card-num{color:var(--md)}

/* DATE FILTER */
.date-filter{display:flex;gap:6px;padding:0 12px 12px}
.df-btn{flex:1;padding:8px 6px;border-radius:10px;border:1.5px solid var(--line);
  background:var(--wh);font-family:'Nunito',sans-serif;
  font-size:12px;font-weight:800;color:var(--md);cursor:pointer;text-align:center}
.df-btn.on{background:var(--dk);border-color:var(--dk);color:#fff}
.df-date{flex:1.5;padding:7px 8px;border-radius:10px;border:1.5px solid var(--line);
  background:var(--wh);font-family:'Nunito',sans-serif;font-size:12px;
  font-weight:700;color:var(--dk)}
.df-date:focus{outline:none;border-color:var(--or)}

.sec-title{padding:4px 14px 6px;font-size:10px;font-weight:800;
  color:var(--lt);text-transform:uppercase;letter-spacing:.06em}

/* DRAFT CARD */
.draft-card{background:var(--wh);margin:0 12px 8px;border-radius:14px;
  overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);
  border:1.5px dashed #D1D5DB;cursor:pointer}
.draft-card:active{opacity:.85}
.dc-top{padding:12px 14px 8px;display:flex;align-items:flex-start;gap:10px}
.dc-info{flex:1}
.dc-id{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--md)}
.dc-meta{font-size:11px;color:var(--lt);font-weight:700;margin-top:2px}
.dc-pill{background:#F1F5F9;color:#475569;padding:4px 10px;
  border-radius:20px;font-size:11px;font-weight:800;flex-shrink:0}
.dc-preview{padding:0 14px 10px;display:flex;gap:5px;flex-wrap:wrap}
.dc-tag{font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;
  background:var(--orl);color:var(--or);border:1px solid #FED7AA}
.dc-more{font-size:10px;font-weight:800;color:var(--lt);align-self:center}
.dc-footer{padding:8px 14px;border-top:1px solid var(--line);
  display:flex;align-items:center;justify-content:space-between;background:#FAFAFA}
.dc-fl{font-size:11px;font-weight:800;color:var(--md)}
.dc-fr{font-size:11px;font-weight:800;color:var(--or)}

/* PENDING FROM STORE */
.pfs-card{background:var(--wh);margin:0 12px 8px;border-radius:14px;
  overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);border:1.5px solid var(--blbr)}
.pfs-hdr{background:#1E3A8A;padding:10px 14px;
  display:flex;align-items:center;justify-content:space-between}
.pfs-title{font-size:13px;font-weight:900;color:#fff}
.pfs-sub{font-size:10px;color:#93C5FD;font-weight:700;margin-top:1px}
.pfs-count{background:rgba(255,255,255,.15);padding:3px 10px;border-radius:20px;
  font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#fff}
.pfs-stats{display:flex;background:var(--blbg);border-bottom:1px solid var(--blbr)}
.pfs-stat{flex:1;padding:8px 10px;text-align:center}
.pfs-stat+.pfs-stat{border-left:1px solid var(--blbr)}
.pfs-sn{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:#1E3A8A;display:block}
.pfs-sl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
  color:var(--bl);display:block;margin-top:1px}
.pfs-item{display:flex;align-items:center;padding:9px 14px;
  border-bottom:1px solid var(--line);gap:10px}
.pfs-item:last-child{border-bottom:none}
.pfs-iname{flex:1;font-size:13px;font-weight:800;color:var(--dk)}
.pfs-itag{font-size:9px;font-weight:800;background:var(--blbg);color:var(--bl);
  padding:2px 7px;border-radius:5px;display:block;margin-top:2px}
.pfs-iqty{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--bl);text-align:right}
.pfs-iunit{font-size:9px;color:var(--lt);font-weight:800;text-align:right}
.pfs-irow{display:flex;gap:6px;align-items:center;justify-content:flex-end}
.pfs-ilbl{font-size:9px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.04em}
.pfs-foot{padding:9px 14px;background:var(--blbg);
  display:flex;align-items:center;justify-content:space-between;
  border-top:1px solid var(--blbr)}
.pfs-fl{font-size:11px;font-weight:800;color:var(--bl)}
.pfs-fr{font-family:'DM Mono',monospace;font-size:10px;color:var(--bl)}

/* REQ CARD */
.req-card{background:var(--wh);margin:0 12px 8px;border-radius:14px;
  overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);cursor:pointer}
.req-card:active{opacity:.85}
.req-card.action{border:1.5px solid var(--or);box-shadow:0 2px 8px rgba(249,115,22,.15)}
.rc-top{padding:12px 14px 10px;display:flex;align-items:flex-start;gap:10px}
.rc-info{flex:1}
.rc-id{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--dk)}
.rc-meta{font-size:11px;color:var(--lt);font-weight:700;margin-top:2px}
.rc-status{padding:4px 10px;border-radius:20px;font-size:11px;
  font-weight:800;white-space:nowrap;flex-shrink:0}
.rc-badges{display:flex;gap:5px;padding:0 14px 10px;flex-wrap:wrap}
.rc-badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px}
.rc-badge.acc{background:var(--gnbg);color:var(--gn)}
.rc-badge.par{background:var(--ambg);color:var(--am)}
.rc-badge.rej{background:var(--rdbg);color:var(--rd)}
.rc-badge.pend{background:#F1F5F9;color:#475569}
.rc-progress{height:3px;background:#F3F4F6;margin:0 14px 10px;border-radius:3px}
.rc-pfill{height:100%;border-radius:3px;background:var(--gn)}
.rc-arrow{padding:9px 14px;border-top:1px solid var(--line);font-size:12px;
  font-weight:800;color:var(--or);display:flex;align-items:center;
  justify-content:space-between}

.empty{padding:24px;text-align:center;color:var(--lt);font-weight:800}
.empty-icon{font-size:26px;margin-bottom:4px}

/* WAREHOUSE SWITCHER */
.wh-switch{display:flex;gap:6px;padding:10px 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;
  background:var(--dk);border-top:1px solid #374151}
.wh-switch::-webkit-scrollbar{display:none}
.wh-pill{padding:6px 12px;border-radius:8px;border:1.5px solid #374151;background:transparent;
  font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;color:#9CA3AF;
  cursor:pointer;white-space:nowrap;flex-shrink:0}
.wh-pill:active{opacity:.8}
.wh-pill.on{background:var(--or);border-color:var(--or);color:#fff}
`;

export function KitchenDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAuthGuard('/kitchen/login');
  const warehouseParam = params.get('warehouse') || '';
  const companyParam = params.get('company') || '';
  const sourceWarehouseParam = params.get('source_warehouse') || '';

  const [userWarehouses, setUserWarehouses] = useState<string[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState('');
  const [todayStr, setTodayStr] = useState('');
  const [yesterdayStr, setYesterdayStr] = useState('');
  const [mounted, setMounted] = useState(false);

  const activeWarehouse = warehouseParam || getDefaultWarehouse() || '';
  const displayName = activeWarehouse ? activeWarehouse.replace(/ - FSRaC$/, '').replace(/ - .*$/, '') : 'Kitchen';
  const hasMultipleWarehouses = userWarehouses.length > 1;

  const switchWarehouse = (wh: string) => {
    const query = new URLSearchParams();
    query.set('warehouse', wh);
    if (companyParam) query.set('company', companyParam);
    if (sourceWarehouseParam) query.set('source_warehouse', sourceWarehouseParam);
    router.replace(`/kitchen?${query.toString()}`);
  };

  const fetchRequisitions = useCallback(() => {
    const query = new URLSearchParams();
    if (activeWarehouse) query.set('warehouse', activeWarehouse);
    if (companyParam) query.set('company', companyParam);
    apiRequest<Requisition[]>(
      `/kitchen/requisitions?${query.toString()}`,
      'GET',
      undefined,
      token ?? undefined
    )
      .then(setRequisitions)
      .catch(() => setRequisitions([]));
  }, [token, activeWarehouse, companyParam]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  useEffect(() => {
    const handleFocus = () => fetchRequisitions();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchRequisitions]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setTodayStr(today);
    setYesterdayStr(yesterday);
    setCustomDate(today);
    setMounted(true);

    const whs = getWarehouses();
    setUserWarehouses(whs);
  }, []);

  const filtered = useMemo(() => {
    const target =
      dateFilter === 'today'
        ? todayStr
        : dateFilter === 'yesterday'
        ? yesterdayStr
        : customDate;
    if (!target) return [];
    return requisitions.filter((r) => r.requested_date === target);
  }, [requisitions, dateFilter, customDate]);

  const drafts = filtered.filter((r) => r.status === 'Draft');
  const pendingStore = filtered.filter((r) =>
    ['Submitted', 'Issued', 'Partially Issued'].includes(r.status)
  );
  const completed = filtered.filter((r) => r.status === 'Completed');

  const counts = {
    draft: drafts.length,
    pending: pendingStore.length,
    completed: completed.length,
    total: filtered.length
  };

  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const at = new Date(a.updated_at || a.submitted_at || a.requested_date).getTime();
        const bt = new Date(b.updated_at || b.submitted_at || b.requested_date).getTime();
        return bt - at;
      }),
    [filtered]
  );

  const sortedDrafts = sortedFiltered.filter((r) => r.status === 'Draft');
  const sortedPendingStore = sortedFiltered.filter((r) =>
    ['Submitted', 'Issued', 'Partially Issued'].includes(r.status)
  );
  const statusPriority: Record<string, number> = {
    Submitted: 0,
    'Partially Issued': 1,
    Issued: 2
  };
  const pendingOrdered = [...sortedPendingStore].sort((a, b) => {
    const pa = statusPriority[a.status] ?? 9;
    const pb = statusPriority[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    const at = new Date(a.updated_at || a.submitted_at || a.requested_date).getTime();
    const bt = new Date(b.updated_at || b.submitted_at || b.requested_date).getTime();
    return bt - at;
  });
  const sortedCompleted = sortedFiltered.filter((r) => r.status === 'Completed');

  const handleDeleteDraft = async (id: number) => {
    await apiRequest(`/requisition/${id}/delete`, 'PUT', undefined, token ?? undefined);
    setRequisitions((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="app">
      <style>{CSS}</style>

      <div className="top">
        <div>
          <div className="top-title">{displayName}</div>
          <div className="top-sub">Daily dashboard</div>
        </div>
        <button
          className="new-btn"
          onClick={() => {
            const query = new URLSearchParams();
            if (activeWarehouse) query.set('warehouse', activeWarehouse);
            if (companyParam) query.set('company', companyParam);
            if (sourceWarehouseParam) query.set('source_warehouse', sourceWarehouseParam);
            const suffix = query.toString();
            router.push(`/kitchen/create-requisition${suffix ? `?${suffix}` : ''}`);
          }}
        >
          + New
        </button>
      </div>

      {hasMultipleWarehouses && (
        <div className="wh-switch">
          {userWarehouses.map((wh) => (
            <button
              key={wh}
              className={`wh-pill${wh === activeWarehouse ? ' on' : ''}`}
              onClick={() => switchWarehouse(wh)}
            >
              {wh.replace(/ - FSRaC$/, '').replace(/ - .*$/, '')}
            </button>
          ))}
        </div>
      )}

      <div className="cards">
        <div className="card alert">
          <span className="card-num">{counts.pending}</span>
          <span className="card-lbl">Pending</span>
        </div>
        <div className="card done">
          <span className="card-num">{counts.completed}</span>
          <span className="card-lbl">Completed</span>
        </div>
        <div className="card blue">
          <span className="card-num">{counts.draft}</span>
          <span className="card-lbl">Drafts</span>
        </div>
      </div>

      <div className="date-filter">
        <button className={`df-btn ${dateFilter === 'today' ? 'on' : ''}`} onClick={() => setDateFilter('today')}>
          Aaj
        </button>
        <button className={`df-btn ${dateFilter === 'yesterday' ? 'on' : ''}`} onClick={() => setDateFilter('yesterday')}>
          Kal
        </button>
        <input
          className="df-date"
          type="date"
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setDateFilter('custom');
          }}
        />
      </div>

      {sortedDrafts.length > 0 && <div className="sec-title">Drafts</div>}
      {sortedDrafts.map((draft) => (
        <div
          key={draft.id}
          className="draft-card"
          onClick={() => router.push(`/kitchen/create-requisition?draft_id=${draft.id}${activeWarehouse ? `&warehouse=${encodeURIComponent(activeWarehouse)}` : ''}`)}
        >
          <div className="dc-top">
            <div className="dc-info">
              <div className="dc-id">KR-{draft.id}</div>
              <div className="dc-meta">{fmtDate(draft.requested_date)} · {draft.shift}</div>
            </div>
            <div className="dc-pill">Draft</div>
          </div>
          <div className="dc-preview">
            {draft.items.slice(0, 3).map((i) => (
              <span key={i.item_code} className="dc-tag">
                {i.item_name || i.item_code}
              </span>
            ))}
            {draft.items.length > 3 && (
              <span className="dc-more">+{draft.items.length - 3} more</span>
            )}
          </div>
          <div className="dc-footer">
            <div className="dc-fl">Last saved</div>
            <div className="dc-fr">
              {mounted ? timeAgo(draft.updated_at ?? draft.submitted_at ?? undefined) : ''}
            </div>
          </div>
          <div className="dc-footer" style={{ justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!confirm('Delete this draft?')) return;
                handleDeleteDraft(draft.id);
              }}
              style={{
                background: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                padding: '6px 10px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 11
              }}
            >
              Delete Draft
            </button>
          </div>
        </div>
      ))}

      {pendingOrdered.length > 0 && (
        <div className="sec-title">Pending from Store</div>
      )}
      {pendingOrdered
        .map((req) => ({
          ...req,
          items: req.items.filter((i) => Number(i.requested_qty) > 0)
        }))
        .filter((req) => req.items.length > 0)
        .map((req) => {
          const issuedCount = req.items.filter((i) => Number(i.issued_qty) > 0).length;
          const statusLabel =
            req.status === 'Submitted'
              ? 'Waiting for store'
              : req.status === 'Issued'
              ? 'Received - accept'
              : 'Partially received - accept';
          const badgeLabel =
            req.status === 'Submitted'
              ? 'Pending'
              : req.status === 'Issued'
              ? 'Received'
              : 'Partial';
          const headerBg = '#1E3A8A';
          const borderColor = '#BFDBFE';
          const footColor =
            req.status === 'Submitted'
              ? '#991B1B'
              : req.status === 'Issued'
              ? '#92400E'
              : '#92400E';
          const canOpen =
            req.status === 'Submitted' ||
            req.status === 'Issued' ||
            req.status === 'Partially Issued';
          return (
        <div
          key={req.id}
          className="pfs-card"
          onClick={() => {
            if (canOpen) router.push(`/kitchen/receive/${req.id}${activeWarehouse ? `?warehouse=${encodeURIComponent(activeWarehouse)}` : ''}`);
          }}
          style={{
            borderColor,
            cursor: canOpen ? 'pointer' : 'default'
          }}
        >
          <div className="pfs-hdr">
            <div>
              <div className="pfs-title">KR-{req.id}</div>
              <div className="pfs-sub">{fmtDate(req.requested_date)} · {req.shift}</div>
            </div>
            <div className="pfs-count">{req.items.length}</div>
          </div>
          <style>{`.pfs-card .pfs-hdr{background:${headerBg}}`}</style>
          <div style={{ padding: '6px 12px', background: '#F8FAFC', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              background: req.status === 'Submitted' ? '#FEE2E2' : req.status === 'Issued' ? '#FEF3C7' : '#FEF3C7',
              color: req.status === 'Submitted' ? '#991B1B' : '#92400E',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 999
            }}>{badgeLabel}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#6B7280' }}>
              {issuedCount}/{req.items.length} sent
            </span>
          </div>
          <div className="pfs-stats">
            <div className="pfs-stat">
              <span className="pfs-sn">{req.items.length}</span>
              <span className="pfs-sl">Items</span>
            </div>
            <div className="pfs-stat">
              <span className="pfs-sn">{issuedCount}</span>
              <span className="pfs-sl">Sent</span>
            </div>
          </div>
          {req.items
            .slice()
            .sort((a, b) => {
              const aRec =
                Number(a.issued_qty) === 0
                  ? 0
                  : Number(a.issued_qty) < Number(a.requested_qty)
                  ? 1
                  : 2;
              const bRec =
                Number(b.issued_qty) === 0
                  ? 0
                  : Number(b.issued_qty) < Number(b.requested_qty)
                  ? 1
                  : 2;
              return aRec - bRec;
            })
            .slice(0, 5)
            .map((item) => {
              const itemStatus =
                Number(item.issued_qty) === 0
                  ? 'Pending'
                  : Number(item.issued_qty) < Number(item.requested_qty)
                  ? 'Partial'
                  : 'Received';
              const badgeStyle =
                itemStatus === 'Pending'
                  ? { background: '#FEE2E2', color: '#991B1B' }
                  : { background: '#FEF3C7', color: '#92400E' };
              return (
                <div key={item.item_code} className="pfs-item">
                  <div className="pfs-iname">
                    {item.item_name || item.item_code}
                    <span className="pfs-itag" style={badgeStyle}>
                      {itemStatus}
                    </span>
                  </div>
                  <div>
                    <div className="pfs-irow">
                      <span className="pfs-ilbl">Ordered</span>
                      <span className="pfs-iqty">{item.requested_qty}</span>
                    </div>
                    <div className="pfs-irow">
                      <span className="pfs-ilbl">Sent</span>
                      <span className="pfs-iqty">{item.issued_qty}</span>
                    </div>
                    <div className="pfs-iunit">{item.uom}</div>
                  </div>
                </div>
              );
            })}
          <div className="pfs-foot">
            <div className="pfs-fl" style={{ color: footColor }}>{statusLabel}</div>
            <div className="pfs-fr">KR-{req.id}</div>
          </div>
        </div>
      )})}

      {/* Accept section removed: use the same cards above to open acceptance */}

      {sortedCompleted.length > 0 && <div className="sec-title">Completed</div>}
      {sortedCompleted.map((req) => {
        const s = STATUS_MAP[req.status];
        return (
          <div
            key={req.id}
            className="req-card"
            onClick={() => router.push(`/kitchen/completed/${req.id}${activeWarehouse ? `?warehouse=${encodeURIComponent(activeWarehouse)}` : ''}`)}
          >
            <div className="rc-top">
              <div className="rc-info">
                <div className="rc-id">KR-{req.id}</div>
                <div className="rc-meta">{fmtDate(req.requested_date)} · {req.shift}</div>
              </div>
              <div className="rc-status" style={{ background: s.bg, color: s.color }}>
                {s.label}
              </div>
            </div>
            <div className="rc-progress">
              <div className="rc-pfill" style={{ width: '100%' }} />
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-text">Is din ka koi order nahi</div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
