'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Share2 } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

interface ReqItem {
  item_code: string;
  item_name: string;
  uom: string;
  requested_qty: number;
  issued_qty: number;
  received_qty: number;
}

interface Requisition {
  id: number;
  requested_date: string;
  shift: string;
  status: string;
  warehouse: string;
  notes?: string | null;
  store_note?: string | null;
  items: ReqItem[];
}

const fmtDate = (d: string): string => {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
};

const shareOnWhatsApp = (title: string, text: string) => {
  const payload = `${title}\n${text}`.trim();
  if (navigator.share) {
    navigator.share({ title, text: payload }).catch(() => {});
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(payload)}`;
  window.open(url, '_blank');
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --or:#F97316;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;--line:#E5E7EB;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --am:#D97706;--ambg:#FFFBEB;--ambr:#FDE68A;
  --bl:#1D4ED8;--blbg:#EFF6FF;--blbr:#BFDBFE;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased}
.page{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg)}
.hdr{background:#111827;position:sticky;top:0;z-index:60}
.hdr-top{padding:13px 16px;display:flex;align-items:center;gap:10px}
.hdr-back{background:rgba(255,255,255,.1);border:none;color:#fff;
  width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:18px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.hdr-meta{flex:1}
.hdr-id{font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:#fff}
.hdr-sub{font-size:11px;color:#9CA3AF;font-weight:700;margin-top:1px}
.hdr-stats{display:flex;gap:0;padding:10px 14px 12px}
.stat{flex:1;text-align:center;position:relative}
.stat+.stat::before{content:'';position:absolute;left:0;top:15%;bottom:15%;
  width:1px;background:rgba(255,255,255,.12)}
.stat-num{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;display:block;line-height:1}
.stat-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block;margin-top:3px}
.stat.s-gn .stat-num{color:#4ADE80}.stat.s-gn .stat-lbl{color:#4ADE80}
.stat.s-or .stat-num{color:#FB923C}.stat.s-or .stat-lbl{color:#FB923C}
.stat.s-wh .stat-num{color:#fff}.stat.s-wh .stat-lbl{color:#6B7280}
.body{padding:12px 12px 24px;display:flex;flex-direction:column;gap:10px}
.sec{background:var(--wh);border-radius:14px;border:1.5px solid var(--line);overflow:hidden}
.sec-h{padding:12px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
.sec-title{font-size:13px;font-weight:900;color:#111827}
.wa-btn{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;
  padding:6px 10px;border-radius:999px;background:#ECFDF3;border:1px solid #BBF7D0;color:#15803D}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
.chip{background:#F9FAFB;border:1px solid var(--line);border-radius:10px;padding:10px}
.chip-l{font-size:10px;color:var(--lt);font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.chip-v{font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:#111827;margin-top:4px}
.list{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.row{border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.row-title{font-size:13px;font-weight:800;color:#111827}
.row-sub{font-size:11px;color:var(--md);margin-top:2px}
.row-meta{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
.tag{font-size:10px;font-weight:800;padding:4px 8px;border-radius:8px;border:1px solid var(--line);background:#F9FAFB;color:#475569}
.tag strong{font-family:'DM Mono',monospace}
.note{margin:10px 12px;padding:10px 12px;border-radius:12px;font-size:12px;font-weight:700}
.note.k{background:#FFFBEB;border:1px solid var(--ambr);color:#92400E}
.note.s{background:#EFF6FF;border:1px solid var(--blbr);color:#1D4ED8}
.empty{padding:12px;color:var(--lt);font-weight:800;font-size:12px}
`;

export function CompletedRequisitionDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const token = useAuthGuard('/kitchen/login');
  const [req, setReq] = useState<Requisition | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    apiRequest<Requisition>(`/requisition/${id}`, 'GET', undefined, token ?? undefined)
      .then(setReq)
      .catch(() => setReq(null));
  }, [token, id]);

  const stats = useMemo(() => {
    if (!req) return { ordered: 0, received: 0, items: 0 };
    const ordered = req.items.filter((i) => Number(i.requested_qty) > 0).length;
    const received = req.items.filter((i) => Number(i.received_qty) > 0).length;
    return { ordered, received, items: req.items.length };
  }, [req]);

  if (!req) {
    return (
      <div className="page">
        <style>{CSS}</style>
        <div className="hdr">
          <div className="hdr-top">
            <button className="hdr-back" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hdr-meta">
              <div className="hdr-id">Completed Details</div>
              <div className="hdr-sub">Loading...</div>
            </div>
          </div>
        </div>
        <div className="body">
          <div className="sec">
            <div className="empty">Loading requisition...</div>
          </div>
        </div>
      </div>
    );
  }

  const summaryText = [
    `KR-${req.id}`,
    `Date: ${req.requested_date} (${req.shift})`,
    `Warehouse: ${req.warehouse}`,
    `Items ordered: ${stats.ordered}`,
    `Items received: ${stats.received}`
  ].join('\n');

  const itemsText = req.items
    .filter((i) => Number(i.requested_qty) > 0)
    .map(
      (i) =>
        `${i.item_name || i.item_code} | Ordered ${i.requested_qty} ${i.uom} | Received ${i.received_qty} ${i.uom}`
    )
    .join('\n');

  const notesText = [
    req.notes ? `Kitchen: ${req.notes}` : '',
    req.store_note ? `Store: ${req.store_note}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const shareText = [summaryText, '', itemsText, '', notesText]
    .filter((t) => t && t.trim().length > 0)
    .join('\n');

  return (
    <div className="page">
      <style>{CSS}</style>
      <div className="hdr">
        <div className="hdr-top">
          <button className="hdr-back" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="hdr-meta">
            <div className="hdr-id">KR-{req.id} · Completed</div>
            <div className="hdr-sub">{fmtDate(req.requested_date)} · {req.shift}</div>
          </div>
        </div>
        <div className="hdr-stats">
          <div className="stat s-wh">
            <span className="stat-num">{stats.ordered}</span>
            <span className="stat-lbl">Ordered</span>
          </div>
          <div className="stat s-gn">
            <span className="stat-num">{stats.received}</span>
            <span className="stat-lbl">Received</span>
          </div>
          <div className="stat s-or">
            <span className="stat-num">{stats.items}</span>
            <span className="stat-lbl">Items</span>
          </div>
        </div>
      </div>

      <div className="body">
        <section className="sec">
          <div className="sec-h">
            <div className="sec-title">Summary</div>
            <button className="wa-btn" onClick={() => shareOnWhatsApp(`KR-${req.id} Details`, shareText)}>
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
          <div className="grid">
            <div className="chip">
              <div className="chip-l">Date</div>
              <div className="chip-v">{fmtDate(req.requested_date)}</div>
            </div>
            <div className="chip">
              <div className="chip-l">Shift</div>
              <div className="chip-v">{req.shift}</div>
            </div>
            <div className="chip">
              <div className="chip-l">Warehouse</div>
              <div className="chip-v">{req.warehouse}</div>
            </div>
            <div className="chip">
              <div className="chip-l">Received</div>
              <div className="chip-v">{stats.received}/{stats.ordered}</div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <div className="sec-title">Items</div>
          </div>
          <div className="list">
            {req.items
              .filter((i) => Number(i.requested_qty) > 0)
              .map((item) => (
                <div key={item.item_code} className="row">
                  <div className="row-title">{item.item_name || item.item_code}</div>
                  <div className="row-sub">{item.item_code}</div>
                  <div className="row-meta">
                    <span className="tag">Ordered <strong>{item.requested_qty}</strong> {item.uom}</span>
                    <span className="tag">Received <strong>{item.received_qty}</strong> {item.uom}</span>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <div className="sec-title">Notes</div>
          </div>
          {req.notes && (
            <div className="note k">
              <div>Kitchen</div>
              <div>{req.notes}</div>
            </div>
          )}
          {req.store_note && (
            <div className="note s">
              <div>Store</div>
              <div>{req.store_note}</div>
            </div>
          )}
          {!req.notes && !req.store_note && (
            <div className="empty">No notes available.</div>
          )}
        </section>
      </div>
    </div>
  );
}
