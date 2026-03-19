'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

type ItemStatus = 'Pending' | 'Accepted' | 'Partial' | 'Rejected';
type Shift = 'Morning' | 'Night';

interface ReqItem {
  id: string;
  name: string;
  unit: string;
  requested: number;
  issued: number;
  received: number;
  itemStatus: ItemStatus;
}

interface Requisition {
  id: number;
  date: string;
  shift: Shift;
  items: ReqItem[];
}

const n3 = (v: number): number => parseFloat(Number(v).toFixed(3));
const fmtDate = (d: string): string => {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
};

const ITEM_MAP: Record<ItemStatus, { label: string; bg: string; color: string; border: string }> = {
  Pending: { label: 'Pending', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  Accepted: { label: '✓ Mila', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  Partial: { label: '~ Kuch mila', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  Rejected: { label: '✕ Nahi mila', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;--rdbr:#FECACA;
  --am:#D97706;--ambg:#FFFBEB;--ambr:#FDE68A;
  --line:#E5E7EB;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased}
.page{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg)}

/* HEADER */
.hdr{background:#111827;position:sticky;top:0;z-index:60}
.hdr-top{padding:13px 16px;display:flex;align-items:center;gap:10px}
.hdr-back{background:rgba(255,255,255,.1);border:none;color:#fff;
  width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:18px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  transition:background .15s}
.hdr-back:active{background:rgba(255,255,255,.2)}
.hdr-meta{flex:1}
.hdr-id{font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:#fff}
.hdr-sub{font-size:11px;color:#9CA3AF;font-weight:700;margin-top:1px}

.hdr-progress{height:3px;background:rgba(255,255,255,.15);margin:0 16px}
.hdr-progress-fill{height:100%;background:var(--gn);
  transition:width .4s cubic-bezier(.4,0,.2,1);border-radius:2px}

.hdr-stats{display:flex;gap:0;padding:10px 14px 12px}
.stat{flex:1;text-align:center;position:relative}
.stat+.stat::before{content:'';position:absolute;left:0;top:10%;bottom:10%;
  width:1px;background:rgba(255,255,255,.12)}
.stat-num{font-family:'DM Mono',monospace;font-size:18px;font-weight:700;
  display:block;line-height:1}
.stat-lbl{font-size:9px;font-weight:800;text-transform:uppercase;
  letter-spacing:.06em;display:block;margin-top:3px}
.stat.s-total  .stat-num{color:#fff}           .stat.s-total  .stat-lbl{color:#6B7280}
.stat.s-acc    .stat-num{color:#4ADE80}         .stat.s-acc    .stat-lbl{color:#4ADE80}
.stat.s-par    .stat-num{color:#FCD34D}         .stat.s-par    .stat-lbl{color:#FCD34D}
.stat.s-rej    .stat-num{color:#F87171}         .stat.s-rej    .stat-lbl{color:#F87171}
.stat.s-pend   .stat-num{color:#94A3B8}         .stat.s-pend   .stat-lbl{color:#94A3B8}

/* BODY */
.body{padding:12px 12px 120px;display:flex;flex-direction:column;gap:10px}

/* ITEM CARD */
.item-card{background:var(--wh);border-radius:16px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);
  border:1.5px solid var(--line);
  transition:border-color .2s,box-shadow .2s}
.item-card.st-Accepted{border-color:var(--gnbr);
  box-shadow:0 2px 8px rgba(22,163,74,.12)}
.item-card.st-Partial{border-color:var(--ambr);
  box-shadow:0 2px 8px rgba(217,119,6,.12)}
.item-card.st-Rejected{border-color:var(--rdbr);
  box-shadow:0 2px 8px rgba(220,38,38,.10)}

.item-top{padding:13px 14px 10px;display:flex;align-items:flex-start;gap:10px}
.item-info{flex:1;min-width:0}
.item-name{font-size:15px;font-weight:900;color:var(--dk);line-height:1.2}

.item-detail{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
.detail-chip{display:flex;align-items:center;gap:4px;padding:4px 9px;
  border-radius:8px;font-size:11px;font-weight:800}
.chip-issued{background:#EFF6FF;color:#1D4ED8}
.chip-short{background:var(--ambg);color:var(--am)}
.chip-zero{background:var(--rdbg);color:var(--rd)}
.chip-lbl{font-size:10px;font-weight:700;color:var(--lt);
  font-family:'DM Mono',monospace}
.chip-val{font-family:'DM Mono',monospace;font-weight:700}

.item-pill{padding:5px 11px;border-radius:20px;font-size:11px;
  font-weight:800;flex-shrink:0;white-space:nowrap;
  transition:background .2s,color .2s}

.item-actions{display:flex;gap:6px;padding:0 13px 12px}
.act{flex:1;padding:11px 6px;border-radius:11px;
  border:1.5px solid var(--line);background:var(--bg);
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;
  color:var(--lt);cursor:pointer;text-align:center;
  transition:all .15s}
.act:active{filter:brightness(.95)}
.act.on-acc{background:var(--gnbg);border-color:var(--gnbr);color:var(--gn)}
.act.on-par{background:var(--ambg);border-color:var(--ambr);color:var(--am)}
.act.on-rej{background:var(--rdbg);border-color:var(--rdbr);color:var(--rd)}

.partial-box{margin:0 13px 12px;padding:10px 12px;
  background:var(--ambg);border-radius:12px;
  border:1px solid var(--ambr)}
.partial-label{font-size:11px;font-weight:800;color:#92400E;
  margin-bottom:8px;display:flex;align-items:center;gap:6px}
.partial-label span{font-size:10px;color:#B45309;font-weight:700}
.partial-row{display:flex;align-items:center;gap:8px}
.partial-ctrl{display:flex;align-items:center;border:2px solid var(--ambr);
  border-radius:11px;overflow:hidden;background:var(--wh);flex:1;height:44px}
.pc-btn{width:42px;height:44px;min-width:42px;border:none;cursor:pointer;
  font-size:22px;font-weight:900;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pc-btn.dec{background:#FFFBEB;color:#92400E}
.pc-btn.inc{background:var(--am);color:#fff}
.pc-btn:active{filter:brightness(.9)}
.pc-inp{flex:1;border:none;background:transparent;text-align:center;
  font-family:'DM Mono',monospace;font-size:18px;font-weight:700;
  color:#92400E;height:44px;padding:0}
.pc-inp:focus{outline:none}
.pc-inp::-webkit-inner-spin-button{-webkit-appearance:none}
.pc-unit{font-size:12px;font-weight:800;color:#92400E;flex-shrink:0;min-width:28px}
.partial-hint{font-size:10px;font-weight:700;color:#B45309;
  margin-top:6px;text-align:center}

.section-sep{font-size:10px;font-weight:800;color:var(--lt);
  text-transform:uppercase;letter-spacing:.06em;
  padding:2px 14px 4px}

/* BOTTOM BAR */
.bbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);
  border-top:2px solid var(--line);
  box-shadow:0 -4px 24px rgba(0,0,0,.12)}

.bbar-summary{display:flex;padding:8px 16px 4px;border-bottom:1px solid var(--line)}
.bs-block{flex:1;text-align:center}
.bs-lbl{font-size:8px;font-weight:800;text-transform:uppercase;
  letter-spacing:.06em;color:var(--lt);display:block}
.bs-val{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;display:block;margin-top:1px}
.bs-val.acc{color:var(--gn)}.bs-val.par{color:var(--am)}.bs-val.rej{color:var(--rd)}.bs-val.pend{color:var(--lt)}

.bbar-btns{padding:8px 12px 12px;display:flex;gap:8px}
.btn-back{flex:0 0 auto;padding:14px 16px;background:var(--bg);
  color:var(--dk);border:2px solid var(--line);border-radius:12px;
  cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800}
.btn-submit{flex:1;padding:14px;background:#16A34A;color:#fff;border:none;
  border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;
  font-size:15px;font-weight:900;transition:background .15s}
.btn-submit:not(:disabled):active{background:#15803D}
.btn-submit:disabled{background:#D1D5DB;color:#9CA3AF;cursor:not-allowed}

/* SUCCESS OVERLAY */
.success-overlay{position:fixed;inset:0;background:rgba(17,24,39,.7);
  display:flex;align-items:center;justify-content:center;z-index:100;
  animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.success-card{background:var(--wh);border-radius:20px;padding:28px 24px;
  margin:20px;width:100%;max-width:360px;text-align:center;
  animation:slideUp .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.success-icon{font-size:56px;margin-bottom:12px}
.success-title{font-size:20px;font-weight:900;color:var(--dk);margin-bottom:6px}
.success-sub{font-size:13px;color:var(--md);font-weight:700;line-height:1.5}
.success-row{display:flex;gap:8px;margin:16px 0}
.sr-block{flex:1;padding:10px 8px;border-radius:10px;text-align:center}
.sr-block.acc{background:var(--gnbg)}.sr-block.par{background:var(--ambg)}.sr-block.rej{background:var(--rdbg)}
.sr-num{font-family:'DM Mono',monospace;font-size:20px;font-weight:700;display:block}
.sr-block.acc .sr-num{color:var(--gn)}.sr-block.par .sr-num{color:var(--am)}.sr-block.rej .sr-num{color:var(--rd)}
.sr-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;display:block;margin-top:2px}
.sr-block.acc .sr-lbl{color:var(--gn)}.sr-block.par .sr-lbl{color:var(--am)}.sr-block.rej .sr-lbl{color:var(--rd)}
.success-btn{width:100%;padding:14px;background:var(--dk);color:#fff;border:none;
  border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;
  font-size:15px;font-weight:900;margin-top:4px}
.success-btn:active{background:#374151}

.fade{animation:fu .18s ease}
@keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
`;

interface ItemCardProps {
  item: ReqItem;
  onSetStatus: (id: string, s: ItemStatus) => void;
  onSetRcv: (id: string, v: number) => void;
}

function ItemCard({ item, onSetStatus, onSetRcv }: ItemCardProps) {
  const im = ITEM_MAP[item.itemStatus];
  const isAcc = item.itemStatus === 'Accepted';
  const isPar = item.itemStatus === 'Partial';
  const isRej = item.itemStatus === 'Rejected';
  const short = item.issued < item.requested;
  const noIssue = item.issued === 0;

  return (
    <div className={`item-card st-${item.itemStatus} fade`}>
      <div className="item-top">
        <div className="item-info">
          <div className="item-name">{item.name}</div>
          <div className="item-detail">
            {noIssue ? (
              <div className="detail-chip chip-zero">
                <span className="chip-lbl">Issued</span>
                <span className="chip-val">0 {item.unit}</span>
              </div>
            ) : (
              <div className="detail-chip chip-issued">
                <span className="chip-lbl">Issued</span>
                <span className="chip-val">{item.issued} {item.unit}</span>
              </div>
            )}
            {short && !noIssue && (
              <div className="detail-chip chip-short">
                <span className="chip-lbl">Short</span>
                <span className="chip-val">{n3(item.requested - item.issued)} {item.unit}</span>
              </div>
            )}
          </div>
        </div>
        <div
          className="item-pill"
          style={{ background: im.bg, color: im.color, border: `1.5px solid ${im.border}` }}
        >
          {im.label}
        </div>
      </div>

      <div className="item-actions">
        <button
          className={`act ${isAcc ? 'on-acc' : ''}`}
          onClick={() => onSetStatus(item.id, 'Accepted')}
          disabled={noIssue}
          style={noIssue ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          ✓ Poora mila
        </button>
        <button
          className={`act ${isPar ? 'on-par' : ''}`}
          onClick={() => onSetStatus(item.id, 'Partial')}
          disabled={noIssue}
          style={noIssue ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          ~ Kuch mila
        </button>
        <button
          className={`act ${isRej ? 'on-rej' : ''}`}
          onClick={() => onSetStatus(item.id, 'Rejected')}
        >
          ✕ Nahi mila
        </button>
      </div>

      {isPar && (
        <div className="partial-box">
          <div className="partial-label">
            Kitna actually mila?
            <span>max: {item.issued} {item.unit}</span>
          </div>
          <div className="partial-row">
            <div className="partial-ctrl">
              <button
                className="pc-btn dec"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onSetRcv(item.id, n3(item.received - 0.5));
                }}
              >
                −
              </button>
              <input
                className="pc-inp"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                max={item.issued}
                value={item.received}
                onChange={(e) => onSetRcv(item.id, parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                className="pc-btn inc"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onSetRcv(item.id, n3(item.received + 0.5));
                }}
              >
                +
              </button>
            </div>
            <span className="pc-unit">{item.unit}</span>
          </div>
          <div className="partial-hint">
            {item.received < item.issued
              ? `${n3(item.issued - item.received)} ${item.unit} short — store ko batao`
              : 'Poora mila — ✓ Poora mila select karo'}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReceiveItems() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const token = useAuthGuard('/kitchen/login');
  const [req, setReq] = useState<Requisition | null>(null);
  const [items, setItems] = useState<ReqItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    apiRequest<any>(`/requisition/${id}`, 'GET', undefined, token ?? undefined)
      .then((data) => {
        const mapped: ReqItem[] = (data.items || []).map((item: any) => {
          const requested = Number(item.requested_qty || 0);
          const issued = Number(item.issued_qty || 0);
          const received = Number(item.received_qty || 0);
          let itemStatus: ItemStatus = 'Pending';
          let initialReceived = received;
          if (received > 0) {
            itemStatus = received >= requested ? 'Accepted' : 'Partial';
          } else if (issued === 0) {
            itemStatus = 'Pending';
            initialReceived = 0;
          } else if (issued < requested) {
            itemStatus = 'Partial';
            initialReceived = issued;
          } else {
            itemStatus = 'Accepted';
            initialReceived = issued;
          }
          return {
            id: item.item_code,
            name: item.item_name || item.item_code,
            unit: item.uom,
            requested,
            issued,
            received: initialReceived,
            itemStatus
          };
        });
        setReq({
          id: data.id,
          date: data.requested_date,
          shift: data.shift as Shift,
          items: mapped
        });
        setItems(mapped);
      })
      .catch(() => setReq(null));
  }, [token, id]);

  const setStatus = useCallback((itemId: string, status: ItemStatus) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        return {
          ...i,
          itemStatus: status,
          received: status === 'Accepted' ? i.issued : status === 'Rejected' ? 0 : i.received
        };
      })
    );
  }, []);

  const setRcv = useCallback((itemId: string, val: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, received: Math.max(0, Math.min(i.issued, n3(val))), itemStatus: 'Partial' }
          : i
      )
    );
  }, []);

  const counts = useMemo(
    () => ({
      total: items.length,
      acc: items.filter((i) => i.itemStatus === 'Accepted').length,
      par: items.filter((i) => i.itemStatus === 'Partial').length,
      rej: items.filter((i) => i.itemStatus === 'Rejected').length,
      pending: items.filter((i) => i.itemStatus === 'Pending').length
    }),
    [items]
  );

  const allActioned = counts.pending === 0;
  const hasIssued = items.some((i) => Number(i.issued) > 0);
  const progress = counts.total === 0 ? 0 : ((counts.total - counts.pending) / counts.total) * 100;
  const pending = items.filter((i) => i.itemStatus === 'Pending');
  const actioned = items.filter((i) => i.itemStatus !== 'Pending');

  const handleSubmit = async () => {
    if (!token || !id) return;
    if (!hasIssued) return;
    const payload = {
      items: items.map((item) => ({
        item_code: item.id,
        received_qty: item.received,
        action:
          item.itemStatus === 'Accepted'
            ? 'accept'
            : item.itemStatus === 'Rejected'
            ? 'reject'
            : 'partial'
      }))
    };
    await apiRequest(`/requisition/${id}/confirm`, 'PUT', payload, token ?? undefined);
    setSubmitted(true);
    router.push('/kitchen');
  };

  const handleFinalize = async () => {
    if (!token || !id) return;
    if (!hasIssued) return;
    const payload = {
      items: items.map((item) => ({
        item_code: item.id,
        received_qty: item.received,
        action:
          item.itemStatus === 'Accepted'
            ? 'accept'
            : item.itemStatus === 'Rejected'
            ? 'reject'
            : 'partial'
      }))
    };
    await apiRequest(`/requisition/${id}/confirm`, 'PUT', payload, token ?? undefined);
    await apiRequest(`/requisition/${id}/finalize`, 'PUT', undefined, token ?? undefined);
    setFinalized(true);
    router.push('/kitchen');
  };

  const handleCancel = async () => {
    if (!token || !id) return;
    if (!confirm('Cancel this requisition?')) return;
    await apiRequest(`/requisition/${id}/cancel`, 'PUT', undefined, token ?? undefined);
    router.push('/kitchen');
  };

  if (!req) {
    return (
      <div className="page">
        <style>{CSS}</style>
        <div className="body">Loading requisition...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{CSS}</style>

      <div className="hdr">
        <div className="hdr-top">
          <button className="hdr-back" onClick={() => router.back()}>
            ←
          </button>
          <div className="hdr-meta">
            <div className="hdr-id">KR-{req.id} — Accept karo</div>
            <div className="hdr-sub">{fmtDate(req.date)} · {req.shift} shift · {counts.total} items</div>
          </div>
        </div>

        <div className="hdr-progress">
          <div className="hdr-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="hdr-stats">
          <div className="stat s-total">
            <span className="stat-num">{counts.total}</span>
            <span className="stat-lbl">Total</span>
          </div>
          <div className="stat s-pend">
            <span className="stat-num">{counts.pending}</span>
            <span className="stat-lbl">Baki</span>
          </div>
          <div className="stat s-acc">
            <span className="stat-num">{counts.acc}</span>
            <span className="stat-lbl">Accepted</span>
          </div>
          <div className="stat s-par">
            <span className="stat-num">{counts.par}</span>
            <span className="stat-lbl">Partial</span>
          </div>
          <div className="stat s-rej">
            <span className="stat-num">{counts.rej}</span>
            <span className="stat-lbl">Rejected</span>
          </div>
        </div>
      </div>

      <div className="body">
        {pending.length > 0 && (
          <>
            {pending.length < counts.total && (
              <div className="section-sep">⏳ Baki hai ({pending.length})</div>
            )}
            {pending.map((item) => (
              <ItemCard key={item.id} item={item} onSetStatus={setStatus} onSetRcv={setRcv} />
            ))}
          </>
        )}

        {actioned.length > 0 && (
          <>
            {pending.length > 0 && <div className="section-sep">✓ Ho gaya ({actioned.length})</div>}
            {actioned.map((item) => (
              <ItemCard key={item.id} item={item} onSetStatus={setStatus} onSetRcv={setRcv} />
            ))}
          </>
        )}
      </div>

      <div className="bbar">
        <div className="bbar-summary">
          <div className="bs-block">
            <span className="bs-lbl">Accepted</span>
            <span className="bs-val acc">{counts.acc}</span>
          </div>
          <div className="bs-block">
            <span className="bs-lbl">Partial</span>
            <span className="bs-val par">{counts.par}</span>
          </div>
          <div className="bs-block">
            <span className="bs-lbl">Rejected</span>
            <span className="bs-val rej">{counts.rej}</span>
          </div>
          <div className="bs-block">
            <span className="bs-lbl">Baki</span>
            <span className="bs-val pend">{counts.pending}</span>
          </div>
        </div>
        <div className="bbar-btns">
          <button className="btn-back" onClick={() => router.back()}>
            ← Wapas
          </button>
          <button className="btn-submit" onClick={handleSubmit} disabled={!hasIssued}>
            Save Acceptance
          </button>
          <button className="btn-submit" disabled={!allActioned || !hasIssued} onClick={handleFinalize}>
            {allActioned ? 'Finalize & Close' : `${counts.pending} item baki`}
          </button>
          {!hasIssued && (
            <button className="btn-submit" onClick={handleCancel}>
              Cancel Requisition
            </button>
          )}
        </div>
      </div>

      {submitted && !finalized && (
        <div className="success-overlay">
          <div className="success-card">
            <div className="success-icon">🎉</div>
            <div className="success-title">Acceptance saved</div>
            <div className="success-sub">
              KR-{req.id} ka acceptance save ho gaya.
              <br />
              Finalize karne par stock entry draft banega.
            </div>
            <div className="success-row">
              <div className="sr-block acc">
                <span className="sr-num">{counts.acc}</span>
                <span className="sr-lbl">Accepted</span>
              </div>
              {counts.par > 0 && (
                <div className="sr-block par">
                  <span className="sr-num">{counts.par}</span>
                  <span className="sr-lbl">Partial</span>
                </div>
              )}
              {counts.rej > 0 && (
                <div className="sr-block rej">
                  <span className="sr-num">{counts.rej}</span>
                  <span className="sr-lbl">Rejected</span>
                </div>
              )}
            </div>
            <button className="success-btn" onClick={() => router.push('/kitchen')}>
              Dashboard pe jao →
            </button>
          </div>
        </div>
      )}

      {finalized && (
        <div className="success-overlay">
          <div className="success-card">
            <div className="success-icon">🎉</div>
            <div className="success-title">Finalized!</div>
            <div className="success-sub">
              KR-{req.id} finalize ho gaya.
              <br />
              Stock entry draft queue ho gaya.
            </div>
            <div className="success-row">
              <div className="sr-block acc">
                <span className="sr-num">{counts.acc}</span>
                <span className="sr-lbl">Accepted</span>
              </div>
              {counts.par > 0 && (
                <div className="sr-block par">
                  <span className="sr-num">{counts.par}</span>
                  <span className="sr-lbl">Partial</span>
                </div>
              )}
              {counts.rej > 0 && (
                <div className="sr-block rej">
                  <span className="sr-num">{counts.rej}</span>
                  <span className="sr-lbl">Rejected</span>
                </div>
              )}
            </div>
            <button className="success-btn" onClick={() => router.push('/kitchen')}>
              Dashboard pe jao →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
