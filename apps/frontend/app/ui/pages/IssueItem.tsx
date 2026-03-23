'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { shareMessage } from '../../../lib/share';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;
  --am:#D97706;--ambg:#FFFBEB;
  --bl:#1D4ED8;--blbg:#EFF6FF;
  --ln:#E5E7EB;--lnlt:#F3F4F6;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}

.ipage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:96px}

/* Header */
.ihdr{background:var(--dk);position:sticky;top:0;z-index:60}
.ihdr-top{padding:14px 16px 10px;display:flex;align-items:center;gap:12px}
.ihdr-back{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ihdr-back:active{background:rgba(255,255,255,.2)}
.ihdr-info{flex:1}
.ihdr-title{font-size:16px;font-weight:900;color:#fff}
.ihdr-sub{font-size:11px;color:#6B7280;font-weight:700;margin-top:2px}

.istatbar{display:flex;padding:8px 0 12px;border-top:1px solid rgba(255,255,255,.07)}
.isb{flex:1;text-align:center;position:relative}
.isb+.isb::before{content:'';position:absolute;left:0;top:15%;bottom:15%;width:1px;background:rgba(255,255,255,.1)}
.isbn{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;display:block;line-height:1}
.isbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block;margin-top:3px}
.isb.o .isbn{color:#FB923C}
.isb.g .isbn{color:#4ADE80}
.isb.b .isbn{color:#60A5FA}

/* Body */
.ibody{padding:12px 12px}

/* Kitchen note */
.kitchen-note{background:var(--ambg);border:1.5px solid #FDE68A;border-radius:13px;
  padding:12px 14px;margin-bottom:12px}
.kn-title{font-size:10px;font-weight:800;color:var(--am);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.kn-text{font-size:13px;font-weight:700;color:#92400E;line-height:1.5}

/* Item card */
.item-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.item-card.done{opacity:.65}
.ic-hdr{padding:11px 14px;display:flex;align-items:center;gap:10px}
.ic-name{flex:1;font-size:14px;font-weight:900;color:var(--dk)}
.ic-done-badge{background:var(--gnbg);color:var(--gn);font-size:10px;font-weight:800;
  padding:3px 9px;border-radius:20px;border:1px solid var(--gnbr)}

.ic-stats{display:flex;padding:0 14px 12px;gap:8px}
.ic-stat{flex:1;border-radius:10px;padding:8px 10px;text-align:center}
.ic-stat.req{background:var(--orl);border:1px solid #FED7AA}
.ic-stat.avail{background:var(--gnbg);border:1px solid var(--gnbr)}
.ic-stat.issued{background:var(--blbg);border:1px solid var(--blbr)}
.ic-stat-val{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;display:block;line-height:1}
.ic-stat.req .ic-stat-val{color:var(--or)}
.ic-stat.avail .ic-stat-val{color:var(--gn)}
.ic-stat.issued .ic-stat-val{color:var(--bl)}
.ic-stat-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
  color:var(--lt);display:block;margin-top:3px}

.ic-qty{padding:0 14px 14px;display:flex;align-items:center;gap:10px}
.qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--ln);border-radius:11px;overflow:hidden;height:44px}
.qty-btn{width:40px;height:44px;border:none;cursor:pointer;font-size:22px;font-weight:900;
  background:var(--bg);color:var(--dk);display:flex;align-items:center;justify-content:center}
.qty-btn.add{background:var(--or);color:#fff}
.qty-btn:active{filter:brightness(.9)}
.qty-btn:disabled{opacity:.35;cursor:default}
.qty-inp{width:56px;border:none;background:transparent;text-align:center;
  font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--dk);height:44px;padding:0}
.qty-inp:focus{outline:none}
.qty-inp::-webkit-inner-spin-button{-webkit-appearance:none}
.qty-unit{font-size:11px;font-weight:800;color:var(--lt);flex-shrink:0}
.qty-fill-btn{height:38px;padding:0 14px;background:var(--bg);border:1.5px solid var(--ln);
  border-radius:9px;font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;
  color:var(--md);cursor:pointer;white-space:nowrap;flex-shrink:0}
.qty-fill-btn:active{background:var(--orl);color:var(--or);border-color:#FED7AA}

/* Store note */
.note-wrap{background:var(--wh);border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);
  padding:14px;margin-bottom:12px}
.note-label{font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.note-inp{width:100%;min-height:72px;border:1.5px solid var(--ln);border-radius:10px;
  background:var(--bg);font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;
  color:var(--dk);padding:10px 12px;resize:none;outline:none}
.note-inp:focus{border-color:var(--or);background:#fff}

/* Bottom bar */
.ibbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);border-top:2px solid var(--ln);
  box-shadow:0 -4px 24px rgba(0,0,0,.1)}
.ibbar-inner{padding:10px 12px 18px;display:flex;gap:9px}
.ibbar-skip{padding:13px 18px;background:var(--bg);color:var(--md);
  border:2px solid var(--ln);border-radius:13px;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;flex-shrink:0}
.ibbar-issue{flex:1;padding:13px;background:var(--gn);color:#fff;border:none;
  border-radius:13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900}
.ibbar-issue:disabled{background:#D1D5DB;cursor:not-allowed}
.ibbar-issue:not(:disabled):active{background:#15803D}

/* Success */
.success-overlay{position:fixed;inset:0;background:rgba(17,24,39,.75);z-index:100;
  display:flex;align-items:flex-end;justify-content:center}
.success-sheet{background:var(--wh);width:100%;max-width:480px;border-radius:22px 22px 0 0;
  padding:0 0 32px}
.success-handle{width:40px;height:4px;background:#E5E7EB;border-radius:4px;margin:16px auto 20px}
.success-icon{font-size:56px;text-align:center;margin-bottom:12px}
.success-title{font-size:19px;font-weight:900;color:var(--dk);text-align:center;margin-bottom:6px}
.success-sub{font-size:13px;font-weight:700;color:var(--md);text-align:center;margin-bottom:20px;line-height:1.5}
.success-done-btn{display:block;margin:0 18px;padding:14px;background:var(--gn);color:#fff;border:none;
  border-radius:13px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;width:calc(100% - 36px)}
.success-share-btn{display:block;margin:10px 18px 0;padding:13px;background:#25D366;color:#fff;border:none;
  border-radius:13px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:900;cursor:pointer;width:calc(100% - 36px)}
.success-more-btn{display:block;margin:10px 18px 0;padding:13px;background:var(--bg);color:var(--dk);
  border:2px solid var(--ln);border-radius:13px;font-family:'Nunito',sans-serif;font-size:13px;
  font-weight:800;cursor:pointer;width:calc(100% - 36px)}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.anim-up{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1)}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .18s ease both}
`;

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8'];
const getColor = (s: string) => COLORS[Math.abs((s || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % COLORS.length];
const n3 = (v: number) => parseFloat(Number(v).toFixed(3));
export function IssueItem() {
  const router = useRouter();
  const params = useParams();
  const id     = params?.id as string | undefined;
  const token  = useAuthGuard('/store/login');

  const [requisition, setRequisition] = useState<any | null>(null);
  const [stockMap,    setStockMap   ] = useState<Map<string, number>>(new Map());
  const [issued,      setIssued     ] = useState<Record<string, number>>({});
  const [storeNote,   setStoreNote  ] = useState('');
  const [loading,     setLoading    ] = useState(false);
  const [error,       setError      ] = useState<string | null>(null);
  const [success,     setSuccess    ] = useState<{ itemsIssued: number } | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      apiRequest<any>(`/store/requisitions/${id}`, 'GET', undefined, token),
      apiRequest<any[]>('/store/stock', 'GET', undefined, token),
    ]).then(([req, stock]) => {
      setRequisition(req);
      const map = new Map<string, number>();
      (stock || []).forEach((r: any) => map.set(r.item_code, Number(r.actual_qty || 0)));
      setStockMap(map);
      // Pre-fill with remaining qty
      const pre: Record<string, number> = {};
      (req?.items || []).forEach((item: any) => {
        const remaining = Math.max(0, Number(item.requested_qty) - Number(item.issued_qty || 0));
        const available = Number(map.get(item.item_code) ?? 0);
        const maxIssuable = Math.max(0, Math.min(remaining, available));
        if (maxIssuable > 0) pre[item.item_code] = maxIssuable;
      });
      setIssued(pre);
    }).catch(() => setRequisition(null));
  }, [token, id]);

  const totalRequested = useMemo(
    () => (requisition?.items || []).reduce((s: number, i: any) => s + Number(i.requested_qty || 0), 0),
    [requisition]
  );
  const totalAvailable = useMemo(
    () => (requisition?.items || []).reduce((s: number, i: any) => s + (stockMap.get(i.item_code) ?? 0), 0),
    [requisition, stockMap]
  );
  const totalIssuing = useMemo(
    () => Object.values(issued).reduce((s, v) => s + v, 0),
    [issued]
  );

  const handleIssue = async () => {
    if (!token || !id || !requisition) return;
    setLoading(true);
    setError(null);
    try {
      const invalidLine = (requisition.items || []).find((item: any) => {
        const requested = Number(item.requested_qty || 0);
        const alreadyIssued = Number(item.issued_qty || 0);
        const remaining = Math.max(0, requested - alreadyIssued);
        const available = Number(stockMap.get(item.item_code) ?? 0);
        const qty = Number(issued[item.item_code] ?? 0);
        return qty > Math.min(remaining, available);
      });
      if (invalidLine) {
        throw new Error(`Issue qty cannot exceed store stock for ${invalidLine.item_name || invalidLine.item_code}.`);
      }
      await apiRequest(`/requisition/${id}/issue`, 'PUT', {
        items: requisition.items.map((item: any) => ({
          item_code:  item.item_code,
          issued_qty: issued[item.item_code] ?? 0,
        })),
        store_note: storeNote || undefined,
      }, token);
      setSuccess({ itemsIssued: Object.values(issued).filter(v => v > 0).length });
    } catch (err: any) {
      setError(err?.message || 'Failed to issue items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareIssuedItems = () => {
    if (!requisition || !id) return;

    const issuedLines = (requisition.items || [])
      .map((item: any) => {
        const qty = Number(issued[item.item_code] ?? 0);
        if (qty <= 0) return null;
        const label = item.item_name || item.item_code;
        const unit = item.uom ? ` ${item.uom}` : '';
        return `- ${label}: ${qty}${unit}`;
      })
      .filter((line: string | null): line is string => Boolean(line));

    if (issuedLines.length === 0) return;

    const lines = [
      `Store issue for TR-${id}`,
      `Kitchen: ${requisition.warehouse || 'Unknown'}`,
      '',
      'Items issued:',
      ...issuedLines
    ];

    const note = storeNote.trim();
    if (note) {
      lines.push('', `Note: ${note}`);
    }

    void shareMessage({
      title: `TR-${id} issued`,
      text: lines.join('\n')
    });
  };

  if (!token) return null;

  const wh    = requisition?.warehouse || 'Loading...';
  const color = getColor(wh);

  return (
    <div className="ipage">
      <style>{CSS}</style>

      {/* Success overlay */}
      {success && (
        <div className="success-overlay">
          <div className="success-sheet anim-up">
            <div className="success-handle"/>
            <div className="success-icon">✅</div>
            <div className="success-title">Items Issued!</div>
            <div className="success-sub">
              {success.itemsIssued} items issued to {wh}
              {storeNote ? `\n"${storeNote}"` : ''}
            </div>
            <button className="success-done-btn" onClick={() => router.push('/store/transfers')}>
              Done → Back to Transfers
            </button>
            <button className="success-share-btn" onClick={shareIssuedItems}>
              Share on WhatsApp
            </button>
            <button className="success-more-btn" onClick={() => router.push('/store')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="ihdr">
        <div className="ihdr-top">
          <button className="ihdr-back" onClick={() => router.push('/store/transfers')}>←</button>
          <div className="ihdr-info">
            <div className="ihdr-title">Issue Items</div>
            <div className="ihdr-sub">{wh} · TR-{id}</div>
          </div>
        </div>
        {requisition && (
          <div className="istatbar">
            <div className="isb o"><span className="isbn">{totalRequested}</span><span className="isbl">Requested</span></div>
            <div className="isb g"><span className="isbn">{totalAvailable.toFixed(1)}</span><span className="isbl">In Stock</span></div>
            <div className="isb b"><span className="isbn">{totalIssuing.toFixed(1)}</span><span className="isbl">Issuing</span></div>
          </div>
        )}
      </div>

      <div className="ibody">
        {/* Kitchen note */}
        {requisition?.notes && (
          <div className="kitchen-note fade">
            <div className="kn-title">📋 Kitchen Note</div>
            <div className="kn-text">{requisition.notes}</div>
          </div>
        )}

        {!requisition && (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
            <div style={{ fontSize:13, fontWeight:800 }}>Loading requisition...</div>
          </div>
        )}

        {/* Items */}
        {(requisition?.items || []).map((item: any) => {
          const requested  = Number(item.requested_qty || 0);
          const alreadyIss = Number(item.issued_qty || 0);
          const remaining  = Math.max(0, requested - alreadyIss);
          const available  = stockMap.get(item.item_code) ?? 0;
          const maxIssuable = Math.max(0, Math.min(remaining, available));
          const qty        = issued[item.item_code] ?? 0;
          const isDone     = remaining === 0;

          const setQty = (v: number) =>
            setIssued(prev => ({ ...prev, [item.item_code]: Math.max(0, Math.min(n3(v), maxIssuable)) }));

          return (
            <div key={item.item_code} className={`item-card fade ${isDone ? 'done' : ''}`}>
              <div className="ic-hdr" style={{ borderBottom: '1px solid var(--lnlt)' }}>
                <div className="ic-name">{item.item_name || item.item_code}</div>
                {isDone && <div className="ic-done-badge">✓ Issued</div>}
              </div>

              <div className="ic-stats">
                <div className="ic-stat req">
                  <span className="ic-stat-val">{requested}</span>
                  <span className="ic-stat-lbl">{item.uom} Needed</span>
                </div>
                <div className="ic-stat avail">
                  <span className="ic-stat-val">{available.toFixed(1)}</span>
                  <span className="ic-stat-lbl">{item.uom} In Store</span>
                </div>
                {alreadyIss > 0 && (
                  <div className="ic-stat issued">
                    <span className="ic-stat-val">{alreadyIss}</span>
                    <span className="ic-stat-lbl">{item.uom} Done</span>
                  </div>
                )}
              </div>

              {!isDone && (
                <div className="ic-qty">
                  <div className="qty-ctrl">
                    <button className="qty-btn" disabled={qty <= 0}
                      onPointerDown={e => { e.preventDefault(); setQty(qty - 0.5); }}>−</button>
                    <input className="qty-inp" type="number" inputMode="decimal" step="any"
                      value={qty}
                      onChange={e => setQty(parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()} />
                    <button className="qty-btn add" disabled={qty >= maxIssuable || maxIssuable === 0}
                      onPointerDown={e => { e.preventDefault(); setQty(qty + 0.5); }}>+</button>
                  </div>
                  <span className="qty-unit">{item.uom}</span>
                  {qty < maxIssuable && (
                    <button className="qty-fill-btn" onClick={() => setQty(maxIssuable)}>
                      Fill ({maxIssuable})
                    </button>
                  )}
                </div>
              )}
              {!isDone && available <= 0 && (
                <div style={{ padding:'0 14px 14px', color:'var(--rd)', fontSize:12, fontWeight:800 }}>
                  Store stock is 0. This item cannot be issued right now.
                </div>
              )}
              {!isDone && available > 0 && available < remaining && (
                <div style={{ padding:'0 14px 14px', color:'#92400E', fontSize:12, fontWeight:800 }}>
                  Only {available.toFixed(1)} {item.uom} available in store right now.
                </div>
              )}
            </div>
          );
        })}

        {/* Store note */}
        {requisition && (
          <div className="note-wrap fade">
            <div className="note-label">Note to Kitchen (optional)</div>
            <textarea
              className="note-inp"
              placeholder="Add a message for the kitchen..."
              value={storeNote}
              onChange={e => setStoreNote(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin:'0 12px 12px', padding:'11px 14px', background:'var(--rdbg)',
          border:'1.5px solid #FECACA', borderRadius:12, fontSize:13, fontWeight:700,
          color:'var(--rd)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠️</span>
          <span style={{ flex:1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none',
            cursor:'pointer', color:'var(--rd)', fontSize:16, lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* Bottom bar */}
      {requisition && (
        <div className="ibbar">
          <div className="ibbar-inner">
            <button className="ibbar-skip" onClick={() => {
              if (confirm('Skip this transfer?')) router.push('/store/transfers');
            }}>
              Skip
            </button>
            <button className="ibbar-issue"
              disabled={loading || totalIssuing === 0}
              onClick={handleIssue}>
              {loading ? '⏳ Submitting...' : `✓ Issue ${totalIssuing > 0 ? totalIssuing.toFixed(1) : ''} Items`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
