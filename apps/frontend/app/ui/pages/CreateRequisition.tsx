'use client';

import { useMemo, useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { getDefaultWarehouse, getSourceWarehouse } from '../../../lib/session';

type ShiftValue = 'Morning' | 'Evening';

interface ErpItem {
  name: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  actual_qty?: number;
  valuation_rate?: number;
}

interface BinStock {
  item_code: string;
  actual_qty: number;
  valuation_rate?: number;
}

interface ItemView {
  id: string;
  name: string;
  code: string;
  unit: string;
  opening: number;
  recv: number;
  price: number;
  group: string;
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const inr = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const n3 = (v: number) => parseFloat(Number(v).toFixed(3));

const SHIFT_OPTIONS: { label: string; value: ShiftValue }[] = [
  { label: 'Morning', value: 'Morning' },
  { label: 'Night', value: 'Evening' }
];

function itemEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('butter') || n.includes('cream') || n.includes('paneer')) return '🧈';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('soda') || n.includes('juice') || n.includes('oj') || n.includes('tonic'))
    return '🥤';
  if (n.includes('rice')) return '🍚';
  if (n.includes('oil')) return '🫙';
  if (n.includes('chilli') || n.includes('turmeric')) return '🌶️';
  return '📦';
}

function groupEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('dairy')) return '🧈';
  if (n.includes('chicken') || n.includes('meat') || n.includes('fish')) return '🍗';
  if (n.includes('drink') || n.includes('beverage')) return '🥤';
  if (n.includes('dry') || n.includes('grocery') || n.includes('grain')) return '🌾';
  return '📦';
}

const CSS_PARTS: string[] = [
  `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@400;500;600&display=swap');`,
  `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}`,
  `:root{`,
  `  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#9CA3AF;--bg:#F3F4F6;--wh:#fff;`,
  `  --gn:#16A34A;--gnbg:#F0FDF4;`,
  `  --rd:#DC2626;--rdbg:#FEF2F2;`,
  `  --am:#D97706;--ambg:#FFFBEB;--ambr:#FCD34D;`,
  `  --line:#F3F4F6;`,
  `}`,
  `body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased}`,
  `.app{max-width:420px;margin:0 auto;min-height:100vh;background:var(--wh)}`,
  ``,
  `/* -- TOP BAR -- */`,
  `.top{background:var(--dk);padding:12px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between}`,
  `.top-l{display:flex;align-items:center;gap:8px}`,
  `.back-btn{width:28px;height:28px;border-radius:8px;border:1.5px solid #374151;background:transparent;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;cursor:pointer}`,
  `.back-btn:active{background:#1F2937}`,
  `.top-l .kname{font-size:16px;font-weight:900;color:#fff}`,
  `.top-l .kdate{font-size:11px;color:#6B7280;font-weight:700;margin-top:1px}`,
  `.shift-pill{display:flex;gap:5px}`,
  `.sp{padding:6px 10px;border-radius:8px;border:1.5px solid #374151;background:transparent;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#6B7280;cursor:pointer}`,
  `.sp.on{background:var(--or);border-color:var(--or);color:#fff}`,
  ``,
  `/* -- SUMMARY ROW -- */`,
  `.summary{background:#1F2937;padding:8px 16px;display:flex;position:sticky;top:52px;z-index:49}`,
  `.sm{flex:1;text-align:center}`,
  `.sm-l{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block}`,
  `.sm-v{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;display:block;margin-top:1px}`,
  `.sm-v.rd{color:#F87171}.sm-v.gn{color:#34D399}.sm-v.or{color:#FB923C}`,
  `.sm+.sm{border-left:1px solid #374151}`,
  ``,
  `/* -- COLUMN HEADERS -- */`,
  `.col-hdr{display:flex;align-items:center;padding:7px 14px;background:#F9FAFB;border-bottom:2px solid var(--line);position:sticky;top:89px;z-index:48}`,
  `.ch-name{flex:1;font-size:10px;font-weight:800;color:var(--md);text-transform:uppercase;letter-spacing:.06em}`,
  `.ch-eod{width:88px;text-align:center;font-size:10px;font-weight:800;color:#D97706;text-transform:uppercase;letter-spacing:.05em}`,
  `.ch-ord{width:88px;text-align:center;font-size:10px;font-weight:800;color:var(--or);text-transform:uppercase;letter-spacing:.05em}`,
  ``,
  `/* -- GROUP -- */`,
  `.grp-hdr{display:flex;align-items:center;padding:9px 14px;background:#F9FAFB;border-top:1.5px solid var(--line);border-bottom:1px solid var(--line);cursor:pointer;user-select:none}`,
  `.grp-hdr.open{background:var(--orl);border-color:#FED7AA}`,
  `.gh-em{font-size:18px;margin-right:8px}`,
  `.gh-name{flex:1;font-size:13px;font-weight:900;color:var(--dk)}`,
  `.gh-stats{display:flex;gap:6px;align-items:center}`,
  `.gh-dot{width:7px;height:7px;border-radius:50%;background:var(--or);animation:p 1.4s infinite}`,
  `@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`,
  `.gh-cnt{font-size:11px;color:var(--md);font-weight:800}`,
  `.gh-arr{font-size:13px;color:var(--md)}`,
  ``,
  `/* -- ITEM ROW -- */`,
  `.item-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);gap:8px;background:var(--wh);transition:background .1s}`,
  `.item-row.has-order{background:var(--orl)}`,
  `.ir-em{font-size:18px;flex-shrink:0}`,
  `.ir-info{flex:1;min-width:0}`,
  `.ir-name{font-size:13px;font-weight:900;color:var(--dk);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  `.ir-sub{font-size:10px;font-weight:700;color:var(--md);margin-top:1px;display:flex;gap:5px;align-items:center}`,
  `.ir-avail{font-family:'DM Mono',monospace;font-size:10px;font-weight:600}`,
  `.ir-avail.zero{color:var(--rd)}`,
  `.ir-avail.low{color:var(--am)}`,
  `.ir-avail.ok{color:var(--gn)}`,
  ``,
  `/* -- COMPACT INPUT -- */`,
  `.ci-wrap{width:88px;flex-shrink:0}`,
  `.ci{display:flex;align-items:center;border:1.5px solid #E5E7EB;border-radius:8px;overflow:hidden;background:var(--wh);height:38px}`,
  `.ci.amber{border-color:var(--ambr);background:var(--ambg)}`,
  `.ci.orange{border-color:var(--or);background:var(--orl)}`,
  `.ci-btn{width:28px;height:38px;min-width:28px;border:none;cursor:pointer;font-size:18px;font-weight:900;line-height:1;background:transparent;color:var(--dk);display:flex;align-items:center;justify-content:center;flex-shrink:0}`,
  `.ci-btn:active{background:#F3F4F6}`,
  `.ci-btn.add{background:var(--or);color:#fff}`,
  `.ci-btn.add:active{background:#EA6C04}`,
  `.ci-inp{flex:1;min-width:0;border:none;background:transparent;text-align:center;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--dk);padding:0;height:38px}`,
  `.ci-inp.amber{color:#92400E}`,
  `.ci-inp.orange{color:var(--or)}`,
  `.ci-inp:focus{outline:none}`,
  `.ci-inp::-webkit-inner-spin-button{-webkit-appearance:none}`,
  ``,
  `/* consumed badge */`,
  `.cons-badge{font-family:'DM Mono',monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:5px;background:var(--rdbg);color:var(--rd)}`,
  `.order-badge{font-family:'DM Mono',monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:5px;background:var(--orl);color:var(--or)}`,
  ``,
  `/* -- BOTTOM BAR -- */`,
  `.bbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;background:var(--wh);border-top:2px solid var(--line);box-shadow:0 -4px 20px rgba(0,0,0,.12)}`,
  `.bbar-vals{display:flex;padding:7px 14px 3px;border-bottom:1px solid var(--line)}`,
  `.bv{flex:1;text-align:center}`,
  `.bv-l{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--md);display:block}`,
  `.bv-v{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;display:block}`,
  `.bv-v.rd{color:var(--rd)}.bv-v.gn{color:var(--gn)}.bv-v.or{color:var(--or)}`,
  `.bbar-btn-wrap{padding:8px 12px 12px}`,
  `.bbar-btn{width:100%;padding:15px;background:var(--or);color:#fff;border:none;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:space-between}`,
  `.bbar-btn:disabled{background:#D1D5DB;cursor:not-allowed}`,
  `.bbar-btn:not(:disabled):active{background:#EA6C04}`,
  `.bb-tag{background:rgba(255,255,255,.25);padding:2px 10px;border-radius:20px;font-size:12px;font-weight:800}`,
  ``,
  `/* -- CONFIRM -- */`,
  `.cnf{min-height:100vh;background:var(--bg)}`,
  `.cnf-top{background:var(--dk);padding:16px;color:#fff}`,
  `.cnf-top h2{font-size:18px;font-weight:900;margin-bottom:2px}`,
  `.cnf-top p{font-size:11px;color:#9CA3AF;font-weight:700}`,
  `.cnf-chips{display:flex;gap:6px;margin-top:10px}`,
  `.cc{background:rgba(255,255,255,.1);border-radius:8px;padding:7px 10px;flex:1;text-align:center}`,
  `.cc label{font-size:8px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px;font-weight:800}`,
  `.cc span{font-size:12px;font-weight:900;color:#fff}`,
  `.cc span.big{font-family:'DM Mono',monospace;color:#FDBA74}`,
  `.cnf-vals{display:flex;gap:6px;padding:10px 12px 0}`,
  `.cv{flex:1;background:var(--wh);border-radius:10px;padding:9px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}`,
  `.cv-l{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--md);display:block;margin-bottom:3px}`,
  `.cv-v{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;display:block}`,
  `.cv-v.rd{color:var(--rd)}.cv-v.gn{color:var(--gn)}.cv-v.or{color:var(--or)}`,
  `.cnf-body{padding:10px 12px 110px;display:flex;flex-direction:column;gap:8px}`,
  `.cnf-grp{background:var(--wh);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07)}`,
  `.cnf-gh{padding:9px 12px;background:#1F2937;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;gap:7px}`,
  `.cnf-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line)}`,
  `.cnf-row:last-child{border-bottom:none}`,
  `.cr-em{font-size:18px;flex-shrink:0}`,
  `.cr-info{flex:1}`,
  `.cr-name{font-size:13px;font-weight:900;color:var(--dk)}`,
  `.cr-tags{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}`,
  `.cr-tag{font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px}`,
  `.cr-tag-u{background:var(--rdbg);color:var(--rd)}`,
  `.cr-tag-b{background:var(--gnbg);color:var(--gn)}`,
  `.cr-right{text-align:right;flex-shrink:0}`,
  `.cr-qty{font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:var(--or);line-height:1}`,
  `.cr-unit{font-size:9px;color:var(--md);font-weight:800}`,
  `.cr-val{font-family:'DM Mono',monospace;font-size:10px;color:var(--dk);font-weight:700;margin-top:1px}`,
  `.cnf-acts{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;padding:10px 12px;background:var(--wh);border-top:2px solid var(--line);display:flex;gap:8px;box-shadow:0 -4px 20px rgba(0,0,0,.12)}`,
  `.btn-bk{flex:0 0 auto;padding:14px 16px;background:var(--bg);color:var(--dk);border:2px solid #E5E7EB;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800}`,
  `.btn-go{flex:1;padding:14px;background:var(--or);color:#fff;border:none;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:15px;font-weight:900}`,
  `.btn-go:active{background:#EA6C04}`,
  ``,
  `/* -- SUCCESS -- */`,
  `.suc{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:44px 18px 40px;background:var(--wh)}`,
  `.suc-anim{font-size:64px;animation:boing .4s cubic-bezier(.34,1.56,.64,1);margin-bottom:12px}`,
  `@keyframes boing{from{transform:scale(0)}to{transform:scale(1)}}`,
  `.suc h2{font-size:20px;font-weight:900;color:var(--dk);text-align:center;margin-bottom:4px}`,
  `.suc>p{font-size:12px;color:var(--md);text-align:center;font-weight:700;max-width:220px;line-height:1.5}`,
  `.suc-id{margin:16px 0 0;background:var(--orl);border-radius:12px;padding:11px 22px;text-align:center;width:100%}`,
  `.suc-id label{font-size:8px;color:var(--md);text-transform:uppercase;letter-spacing:.06em;display:block;font-weight:800}`,
  `.suc-id span{font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--or);display:block;margin-top:2px}`,
  `.suc-3{width:100%;display:flex;gap:6px;margin-top:11px}`,
  `.s3{flex:1;border-radius:10px;padding:9px 6px;text-align:center}`,
  `.s3-l{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px}`,
  `.s3-q{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;display:block}`,
  `.s3-v{font-family:'DM Mono',monospace;font-size:9px;display:block;margin-top:2px}`,
  `.s3-u{background:var(--rdbg)}.s3-u .s3-l{color:#991B1B}.s3-u .s3-q{color:var(--rd)}.s3-u .s3-v{color:var(--rd)}`,
  `.s3-b{background:var(--gnbg)}.s3-b .s3-l{color:#166534}.s3-b .s3-q{color:var(--gn)}.s3-b .s3-v{color:var(--gn)}`,
  `.s3-o{background:var(--orl)}.s3-o .s3-l{color:#9A3412}.s3-o .s3-q{color:var(--or)}.s3-o .s3-v{color:var(--or)}`,
  `.suc-list{width:100%;margin-top:10px;background:var(--bg);border-radius:12px;padding:12px}`,
  `.sl-title{font-size:9px;font-weight:800;color:var(--md);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}`,
  `.sl-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #E5E7EB}`,
  `.sl-item:last-child{border-bottom:none}`,
  `.sl-em{font-size:17px}`,
  `.sl-nm{flex:1;font-size:12px;font-weight:800;color:var(--dk)}`,
  `.sl-qty{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--or);text-align:right}`,
  `.sl-val{font-family:'DM Mono',monospace;font-size:10px;color:var(--md);text-align:right}`,
  `.suc-acts{width:100%;margin-top:12px;display:flex;flex-direction:column;gap:7px}`,
  `.wa-btn{width:100%;padding:15px;background:#25D366;color:#fff;border:none;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px}`,
  `.wa-btn:active{background:#1da851}`,
  `.da-btn{width:100%;padding:13px;background:var(--bg);color:var(--dk);border:2px solid #E5E7EB;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800}`,
  ``,
  `/* -- DATE BAR -- */`,
  `.date-bar{background:var(--wh);padding:9px 16px;display:flex;align-items:center;gap:10px;border-bottom:1.5px solid var(--line)}`,
  `.date-lbl{font-size:11px;font-weight:800;color:var(--md);text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}`,
  `.date-inp{flex:1;padding:7px 10px;border:1.5px solid #E5E7EB;border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;color:var(--dk);background:var(--bg);appearance:none}`,
  `.date-inp:focus{outline:none;border-color:var(--or);background:var(--wh)}`,
];

const CSS = CSS_PARTS.join('');

function calcItem(item: ItemView, actuals: Record<string, number>, orders: Record<string, number>) {
  const avail = n3(item.opening + item.recv);
  const ac = actuals[item.id] ?? avail;
  const consumed = n3(Math.max(0, avail - ac));
  const oq = orders[item.id] ?? 0;
  return {
    avail,
    ac,
    consumed,
    consumedVal: n3(consumed * item.price),
    balVal: n3(ac * item.price),
    oq,
    orderVal: n3(oq * item.price)
  };
}

function CInput({
  value,
  onChange,
  variant = 'neutral'
}: {
  value: number;
  onChange: (value: number) => void;
  variant?: 'neutral' | 'amber' | 'orange';
}) {
  const [raw, setRaw] = useState('');
  const [focused, setFocused] = useState(false);

  const cls = variant === 'amber' ? 'amber' : variant === 'orange' ? 'orange' : '';
  const display = focused ? raw : value === 0 ? '0' : String(value);

  return (
    <div className="ci-wrap">
      <div className={`ci ${cls}`}>
        <button
          className="ci-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            const nv = n3(Math.max(0, value - 1));
            onChange(nv);
            setRaw(String(nv));
          }}
        >
          −
        </button>
        <input
          className={`ci-inp ${cls}`}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={focused ? raw : display}
          onFocus={(e) => {
            setFocused(true);
            setRaw(value === 0 ? '' : String(value));
            e.currentTarget.select();
          }}
          onBlur={(e) => {
            setFocused(false);
            const v = parseFloat(e.currentTarget.value);
            onChange(isNaN(v) ? 0 : n3(Math.max(0, v)));
          }}
          onChange={(e) => setRaw(e.currentTarget.value)}
        />
        <button
          className="ci-btn add"
          style={variant === 'amber' ? { background: '#D97706' } : {}}
          onPointerDown={(e) => {
            e.preventDefault();
            const nv = n3(value + 1);
            onChange(nv);
            setRaw(String(nv));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Browse({
  date,
  setDate,
  shift,
  setShift,
  actuals,
  setActuals,
  orders,
  setOrders,
  groups,
  onReview,
  onBack,
  kitchenName
}: {
  date: string;
  setDate: (value: string) => void;
  shift: ShiftValue;
  setShift: (value: ShiftValue) => void;
  actuals: Record<string, number>;
  setActuals: Dispatch<SetStateAction<Record<string, number>>>;
  orders: Record<string, number>;
  setOrders: Dispatch<SetStateAction<Record<string, number>>>;
  groups: { id: string; name: string; emoji: string; items: ItemView[] }[];
  onReview: () => void;
  onBack: () => void;
  kitchenName: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    groups.length ? { [groups[0].id]: true } : {}
  );

  useEffect(() => {
    if (groups.length === 0) return;
    setOpen((prev) => (Object.keys(prev).length ? prev : { [groups[0].id]: true }));
  }, [groups]);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const totals = useMemo(
    () =>
      allItems.reduce(
        (t, item) => {
          const c = calcItem(item, actuals, orders);
          return {
            usedVal: t.usedVal + c.consumedVal,
            balVal: t.balVal + c.balVal,
            ordVal: t.ordVal + c.orderVal,
            ordItems: t.ordItems + (c.oq > 0 ? 1 : 0),
            reconcileItems: t.reconcileItems + (c.ac !== c.avail ? 1 : 0)
          };
        },
        { usedVal: 0, balVal: 0, ordVal: 0, ordItems: 0, reconcileItems: 0 }
      ),
    [allItems, actuals, orders]
  );

  const setAC = (id: string, v: number) => setActuals((p) => ({ ...p, [id]: n3(Math.max(0, v)) }));
  const setOQ = (id: string, v: number) => setOrders((p) => ({ ...p, [id]: n3(Math.max(0, v)) }));

  return (
    <div className="app">
      <style>{CSS}</style>

      <div className="top">
        <div className="top-l">
          <button className="back-btn" onClick={onBack} aria-label="Back to dashboard">
            ←
          </button>
          <div>
            <div className="kname">{kitchenName}</div>
            <div className="kdate">raat ka entry</div>
          </div>
        </div>
        <div className="shift-pill">
          {SHIFT_OPTIONS.map((s) => (
            <button
              key={s.value}
              className={`sp ${shift === s.value ? 'on' : ''}`}
              onClick={() => setShift(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="date-bar">
        <label className="date-lbl">Tarikh</label>
        <input className="date-inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="summary">
        <div className="sm">
          <span className="sm-l">Used</span>
          <span className="sm-v rd">{inr(totals.usedVal)}</span>
        </div>
        <div className="sm">
          <span className="sm-l">Closing</span>
          <span className="sm-v gn">{inr(totals.balVal)}</span>
        </div>
        <div className="sm">
          <span className="sm-l">Order</span>
          <span className="sm-v or">{inr(totals.ordVal)}</span>
        </div>
      </div>

      <div className="col-hdr">
        <span className="ch-name">Item</span>
        <span className="ch-eod">Bacha kitna?</span>
        <span className="ch-ord">Mangna kitna?</span>
      </div>

      {groups.map((group) => {
        const isOpen = open[group.id];
        const ordCnt = group.items.filter((i) => (orders[i.id] ?? 0) > 0).length;
        return (
          <div key={group.id}>
            <div
              className={`grp-hdr ${isOpen ? 'open' : ''}`}
              onClick={() => setOpen((p) => ({ ...p, [group.id]: !p[group.id] }))}
            >
              <span className="gh-em">{group.emoji}</span>
              <span className="gh-name">{group.name}</span>
              <div className="gh-stats">
                {ordCnt > 0 && <div className="gh-dot" />}
                <span className="gh-cnt">{group.items.length}</span>
                <span className="gh-arr">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen &&
              group.items.map((item) => {
                const { avail, ac, consumed, oq } = calcItem(item, actuals, orders);
                const availColor = avail === 0 ? 'zero' : avail <= 2 ? 'low' : 'ok';
                const acChanged = ac !== avail;

                return (
                  <div key={item.id} className={`item-row ${oq > 0 ? 'has-order' : ''}`}>
                    <div className="ir-info">
                      <div className="ir-name">{item.name}</div>
                      <div className="ir-sub">
                        <span className={`ir-avail ${availColor}`}>
                          Opening: {avail} {item.unit}
                        </span>
                        {consumed > 0 && <span className="cons-badge">−{consumed}</span>}
                        {oq > 0 && <span className="order-badge">+{oq}</span>}
                      </div>
                    </div>

                    <CInput value={ac} onChange={(v) => setAC(item.id, v)} variant={acChanged ? 'amber' : 'neutral'} />
                    <CInput value={oq} onChange={(v) => setOQ(item.id, v)} variant={oq > 0 ? 'orange' : 'neutral'} />
                  </div>
                );
              })}
          </div>
        );
      })}

      <div style={{ height: 140 }} />

      <div className="bbar">
        <div className="bbar-vals">
          <div className="bv">
            <span className="bv-l">Use hua</span>
            <span className="bv-v rd">{inr(totals.usedVal)}</span>
          </div>
          <div className="bv">
            <span className="bv-l">Bacha</span>
            <span className="bv-v gn">{inr(totals.balVal)}</span>
          </div>
          <div className="bv">
            <span className="bv-l">Order</span>
            <span className="bv-v or">{inr(totals.ordVal)}</span>
          </div>
        </div>
        <div className="bbar-btn-wrap">
          <button
            className="bbar-btn"
            disabled={totals.ordItems === 0 && totals.reconcileItems === 0}
            onClick={onReview}
          >
            <span>Bhejo store ko 📋</span>
            <span className="bb-tag">
              {totals.ordItems > 0
                ? `${totals.ordItems} items · ${inr(totals.ordVal)}`
                : `${totals.reconcileItems} reconcile`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Confirm({
  date,
  shiftLabel,
  actuals,
  orders,
  groups,
  onBack,
  onSubmit,
  onSaveDraft,
  notes,
  onNotesChange
}: {
  date: string;
  shiftLabel: string;
  actuals: Record<string, number>;
  orders: Record<string, number>;
  groups: { id: string; name: string; emoji: string; items: ItemView[] }[];
  onBack: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const reviewGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => {
            const c = calcItem(i, actuals, orders);
            return c.oq > 0 || c.ac !== c.avail;
          })
        }))
        .filter((g) => g.items.length > 0),
    [groups, actuals, orders]
  );
  const totals = useMemo(
    () =>
      allItems.reduce(
        (t, item) => {
          const c = calcItem(item, actuals, orders);
          return {
            usedVal: t.usedVal + c.consumedVal,
            balVal: t.balVal + c.balVal,
            ordVal: t.ordVal + c.orderVal,
            ordItems: t.ordItems + (c.oq > 0 ? 1 : 0)
          };
        },
        { usedVal: 0, balVal: 0, ordVal: 0, ordItems: 0 }
      ),
    [allItems, actuals, orders]
  );

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="cnf">
        <div className="cnf-top">
          <h2>Theek hai? Bhejein? ✅</h2>
          <p>Yeh order store ko jaayega kal ke liye</p>
          <div className="cnf-chips">
            <div className="cc">
              <label>Tarikh</label>
              <span>{fmtDate(date)}</span>
            </div>
            <div className="cc">
              <label>Shift</label>
              <span>{shiftLabel}</span>
            </div>
            <div className="cc">
              <label>Items</label>
              <span className="big">{totals.ordItems}</span>
            </div>
            <div className="cc">
              <label>Total</label>
              <span className="big">{inr(totals.ordVal)}</span>
            </div>
          </div>
        </div>
        <div className="cnf-vals">
          <div className="cv">
            <span className="cv-l">Use Hua</span>
            <span className="cv-v rd">{inr(totals.usedVal)}</span>
          </div>
          <div className="cv">
            <span className="cv-l">Bacha</span>
            <span className="cv-v gn">{inr(totals.balVal)}</span>
          </div>
          <div className="cv">
            <span className="cv-l">Order</span>
            <span className="cv-v or">{inr(totals.ordVal)}</span>
          </div>
        </div>
        <div className="cnf-body">
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 12,
              border: '1px solid #E5E7EB'
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
              Note to Store
            </div>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add a message for the store..."
              style={{
                width: '100%',
                minHeight: 70,
                borderRadius: 10,
                border: '1px solid #E5E7EB',
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#111827',
                background: '#F9FAFB'
              }}
            />
          </div>
          {reviewGroups.map((group) => (
            <div key={group.id} className="cnf-grp">
              <div className="cnf-gh">
                {group.emoji} {group.name}
              </div>
              {group.items.map((item) => {
                const { consumed, consumedVal, balVal, ac, oq, orderVal } = calcItem(
                  item,
                  actuals,
                  orders
                );
                return (
                  <div key={item.id} className="cnf-row">
                    <div className="cr-info">
                      <div className="cr-name">{item.name}</div>
                      <div className="cr-tags">
                        <span className="cr-tag cr-tag-u">
                          Used: {consumed} {item.unit} = {inr(consumedVal)}
                        </span>
                        <span className="cr-tag cr-tag-b">
                          Closing: {ac} {item.unit} = {inr(balVal)}
                        </span>
                      </div>
                    </div>
                    <div className="cr-right">
                      <div className="cr-qty">{oq}</div>
                      <div className="cr-unit">{item.unit}</div>
                      <div className="cr-val">{inr(orderVal)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cnf-acts">
          <button className="btn-bk" onClick={onBack}>
            ← Wapas
          </button>
          <button className="btn-bk" onClick={onSaveDraft}>
            Save Draft
          </button>
          <button className="btn-go" onClick={onSubmit}>
            ✅ Haan, Bhejo!
          </button>
        </div>
      </div>
    </div>
  );
}

function Success({
  date,
  shiftLabel,
  actuals,
  orders,
  groups,
  requisitionId,
  onDashboard
}: {
  date: string;
  shiftLabel: string;
  actuals: Record<string, number>;
  orders: Record<string, number>;
  groups: { id: string; name: string; emoji: string; items: ItemView[] }[];
  requisitionId: string;
  onDashboard: () => void;
}) {
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const ordered = useMemo(() => allItems.filter((i) => (orders[i.id] ?? 0) > 0), [allItems, orders]);
  const totals = useMemo(
    () =>
      allItems.reduce(
        (t, item) => {
          const c = calcItem(item, actuals, orders);
          return {
            usedVal: t.usedVal + c.consumedVal,
            balVal: t.balVal + c.balVal,
            ordVal: t.ordVal + c.orderVal,
            ordItems: t.ordItems + (c.oq > 0 ? 1 : 0)
          };
        },
        { usedVal: 0, balVal: 0, ordVal: 0, ordItems: 0 }
      ),
    [allItems, actuals, orders]
  );

  const share = () => {
    const lines = [
      `🍳 *${shiftLabel}*`,
      `📋 ${requisitionId} | ${fmtDate(date)}`,
      ``,
      `📊 *Hisaab:*`,
      `• Use hua: ${inr(totals.usedVal)}`,
      `• Bacha: ${inr(totals.balVal)}`,
      `• Order: ${inr(totals.ordVal)}`,
      ``,
      `*🛒 Order:*`,
      ...ordered.map((i) => `• ${i.name}: *${orders[i.id]} ${i.unit}* (${inr((orders[i.id] ?? 0) * i.price)})`),
      ``,
      `✅ Store ko bhej diya`
    ].join('\n');
    if (navigator.share) navigator.share({ title: `Order ${requisitionId}`, text: lines }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="suc">
        <div className="suc-anim">🎉</div>
        <h2>Order bhej diya!</h2>
        <p>Store manager ko order mil gaya.</p>
        <div className="suc-id">
          <label>Order Number</label>
          <span>{requisitionId}</span>
        </div>
        <div className="suc-3">
          <div className="s3 s3-u">
            <span className="s3-l">Use Hua</span>
            <span className="s3-q">{inr(totals.usedVal)}</span>
            <span className="s3-v">consumed</span>
          </div>
          <div className="s3 s3-b">
            <span className="s3-l">Bacha</span>
            <span className="s3-q">{inr(totals.balVal)}</span>
            <span className="s3-v">= kal opening</span>
          </div>
          <div className="s3 s3-o">
            <span className="s3-l">Ordered</span>
            <span className="s3-q">{inr(totals.ordVal)}</span>
            <span className="s3-v">{totals.ordItems} items</span>
          </div>
        </div>
        <div className="suc-list">
          <div className="sl-title">Kya manga kal ke liye</div>
          {ordered.map((item) => (
            <div key={item.id} className="sl-item">
              <span className="sl-nm">{item.name}</span>
              <div>
                <div className="sl-qty">
                  {orders[item.id]} {item.unit}
                </div>
                <div className="sl-val">{inr((orders[item.id] ?? 0) * item.price)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="suc-acts">
          <button className="wa-btn" onClick={share}>
            📲 Share karo (WhatsApp / Other)
          </button>
          <button className="da-btn" onClick={onDashboard}>
            Dashboard pe jao →
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateRequisition() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAuthGuard('/kitchen/login');
  const warehouseParam = params.get('warehouse') || '';
  const companyParam = params.get('company') || '';
  const sourceWarehouseParam = params.get('source_warehouse') || '';
  const resolvedWarehouse = warehouseParam || getDefaultWarehouse() || '';
  const resolvedSourceWarehouse = sourceWarehouseParam || getSourceWarehouse() || '';
  const today = new Date().toISOString().slice(0, 10);

  const [itemsList, setItemsList] = useState<ErpItem[]>([]);
  const [mappedGroups, setMappedGroups] = useState<string[]>([]);
  const [stockList, setStockList] = useState<BinStock[]>([]);
  const [requestedDate, setRequestedDate] = useState('');
  const [shift, setShift] = useState<ShiftValue>('Morning');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [screen, setScreen] = useState<'browse' | 'confirm' | 'success'>('browse');
  const [lastRequisitionId, setLastRequisitionId] = useState<string>('');
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Record<string, number>>({});
  const [draftId, setDraftId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notes, setNotes] = useState('');
  const [debugSample, setDebugSample] = useState<{
    code?: string;
    itemQty?: number;
    itemRate?: number;
    stockQty?: number;
    stockRate?: number;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!requestedDate) {
      setRequestedDate(new Date().toISOString().split('T')[0]);
    }
    const query = new URLSearchParams();
    if (resolvedWarehouse) query.set('warehouse', resolvedWarehouse);
    if (companyParam) query.set('company', companyParam);
    Promise.all([
      apiRequest<ErpItem[]>(`/kitchen/items?${query.toString()}`, 'GET', undefined, token ?? undefined),
      apiRequest<BinStock[]>(`/kitchen/stock?${query.toString()}`, 'GET', undefined, token ?? undefined),
      apiRequest<string[]>(`/kitchen/item-groups?${query.toString()}`, 'GET', undefined, token ?? undefined)
    ])
      .then(([itemsData, stockData, groupsData]) => {
        setItemsList(itemsData || []);
        setStockList(stockData || []);
        setMappedGroups(groupsData || []);
        setError(null);
        const sampleItem = itemsData?.[0];
        const sampleStock = stockData?.find(
          (row) => row.item_code === sampleItem?.name
        );
        setDebugSample(
          sampleItem
            ? {
                code: sampleItem.name,
                itemQty: sampleItem.actual_qty ?? undefined,
                itemRate: sampleItem.valuation_rate ?? undefined,
                stockQty: sampleStock?.actual_qty ?? undefined,
                stockRate: sampleStock?.valuation_rate ?? undefined
              }
            : null
        );
      })
      .catch((err) => setError((err as Error).message));
  }, [token, resolvedWarehouse, companyParam]);

  const draftIdParam = params.get('draft_id');
  useEffect(() => {
    if (!token || !draftIdParam) return;
    const id = Number(draftIdParam);
    if (!Number.isFinite(id)) return;
    setDraftId(id);
    apiRequest<any>(`/requisition/${id}`, 'GET', undefined, token ?? undefined)
      .then((req) => {
        if (!req) return;
        setRequestedDate(req.requested_date || today);
        setShift(req.shift || 'Morning');
        setNotes(req.notes || '');
        const nextActuals: Record<string, number> = {};
        const nextOrders: Record<string, number> = {};
        (req.items || []).forEach((item: any) => {
          const code = item.item_code;
          if (item.actual_closing !== null && item.actual_closing !== undefined) {
            nextActuals[code] = Number(item.actual_closing);
          }
          if (item.requested_qty !== null && item.requested_qty !== undefined) {
            nextOrders[code] = Number(item.requested_qty);
          }
        });
        setActuals(nextActuals);
        setOrders(nextOrders);
      })
      .catch(() => {});
  }, [token, draftIdParam]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockList.forEach((row) => map.set(row.item_code, row.actual_qty));
    return map;
  }, [stockList]);

  const valuationMap = useMemo(() => {
    const map = new Map<string, number>();
    stockList.forEach((row) => {
      if (row.valuation_rate !== undefined && row.valuation_rate !== null) {
        map.set(row.item_code, Number(row.valuation_rate));
      }
    });
    return map;
  }, [stockList]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ItemView[]> = {};
    itemsList.forEach((item) => {
      const group = item.item_group || 'Other';
      const code = item.name;
      const view: ItemView = {
        id: code,
        name: item.item_name || code,
        code,
        unit: item.stock_uom || 'Nos',
        opening: Number(
          item.actual_qty !== undefined && item.actual_qty !== null
            ? item.actual_qty
            : stockMap.get(code) ?? 0
        ),
        recv: 0,
        price: Number(
          item.valuation_rate !== undefined && item.valuation_rate !== null
            ? item.valuation_rate
            : valuationMap.get(code) ?? 0
        ),
        group
      };
      if (!groups[group]) groups[group] = [];
      groups[group].push(view);
    });
    return groups;
  }, [itemsList, stockMap]);

  const groupOrder = useMemo(() => {
    if (mappedGroups.length > 0) return mappedGroups;
    return Object.keys(groupedItems).sort((a, b) => a.localeCompare(b));
  }, [mappedGroups, groupedItems]);

  const groups = useMemo(() => {
    return groupOrder
      .map((group) => ({
        id: group,
        name: group,
        emoji: groupEmoji(group),
        items: groupedItems[group] || []
      }))
      .filter((group) => group.items.length > 0);
  }, [groupOrder, groupedItems]);

  const shiftLabel = SHIFT_OPTIONS.find((s) => s.value === shift)?.label ?? shift;

  const buildPayloadItems = () =>
    groups
      .flatMap((g) => g.items)
      .map((item) => {
        const avail = n3(item.opening + item.recv);
        const ac = actuals[item.id] ?? avail;
        const oq = orders[item.id] ?? 0;
        return {
          item_code: item.code,
          item_name: item.name,
          uom: item.unit,
          closing_stock: avail,
          order_qty: oq,
          actual_closing: ac !== avail ? ac : undefined
        };
      })
      .filter((item) => Number(item.order_qty) > 0 || item.actual_closing !== undefined);

  const requisitionCreateUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (resolvedWarehouse) q.set('warehouse', resolvedWarehouse);
    if (resolvedSourceWarehouse) q.set('source_warehouse', resolvedSourceWarehouse);
    const qs = q.toString();
    return `/requisition${qs ? `?${qs}` : ''}`;
  }, [resolvedWarehouse, resolvedSourceWarehouse]);

  const kitchenBackUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (resolvedWarehouse) q.set('warehouse', resolvedWarehouse);
    if (companyParam) q.set('company', companyParam);
    const qs = q.toString();
    return `/kitchen${qs ? `?${qs}` : ''}`;
  }, [resolvedWarehouse, companyParam]);

  const saveDraft = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = buildPayloadItems();
      if (draftId) {
        await apiRequest<any>(
          `/requisition/${draftId}`,
          'PUT',
          { requested_date: requestedDate, shift, notes, items },
          token ?? undefined
        );
      } else {
        const requisition = await apiRequest<any>(
          requisitionCreateUrl,
          'POST',
          { requested_date: requestedDate, shift, notes, items },
          token ?? undefined
        );
        if (requisition?.id) {
          setDraftId(Number(requisition.id));
          setLastRequisitionId(`KR-${requisition.id}`);
        }
      }
      router.push(kitchenBackUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = buildPayloadItems();
      let id = draftId;
      if (id) {
        await apiRequest<any>(
          `/requisition/${id}`,
          'PUT',
          { requested_date: requestedDate, shift, notes, items },
          token ?? undefined
        );
      } else {
        const requisition = await apiRequest<any>(
          requisitionCreateUrl,
          'POST',
          { requested_date: requestedDate, shift, notes, items },
          token ?? undefined
        );
        id = requisition?.id;
      }
      if (id) {
        await apiRequest(`/requisition/${id}/submit`, 'PUT', undefined, token ?? undefined);
        setLastRequisitionId(`KR-${id}`);
      } else {
        setLastRequisitionId('KR-NEW');
      }
      setScreen('success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!resolvedWarehouse) {
    return (
      <div className="app">
        <style>{CSS}</style>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#111827', marginBottom: 8 }}>
            No Warehouse Assigned
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', lineHeight: 1.6 }}>
            Your account is not assigned to any warehouse. Please contact your admin to assign a warehouse to your account.
          </div>
          <button
            onClick={() => router.push(kitchenBackUrl)}
            style={{
              marginTop: 20,
              padding: '12px 24px',
              background: '#F3F4F6',
              color: '#111827',
              border: '1.5px solid #E5E7EB',
              borderRadius: 10,
              fontFamily: "'Nunito', sans-serif",
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'browse') {
    return (
      <>
        <Browse
          date={requestedDate}
          setDate={setRequestedDate}
          shift={shift}
          setShift={setShift}
          actuals={actuals}
          setActuals={setActuals}
          orders={orders}
          setOrders={setOrders}
          groups={groups}
          onReview={() => setScreen('confirm')}
        onBack={() => router.push(kitchenBackUrl)}
          kitchenName={resolvedWarehouse.replace(/ - FSRaC$/, '').replace(/ - .*$/, '')}
        />
        <div
          style={{
            position: 'fixed',
            right: 10,
            bottom: 10,
            zIndex: 9999,
            background: '#111827',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 11,
            maxWidth: 260
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Debug</div>
          <div>warehouse: {resolvedWarehouse || '(none)'}</div>
          <div>items: {itemsList.length}</div>
          <div>stock rows: {stockList.length}</div>
          <div>groups: {mappedGroups.length || groupOrder.length}</div>
          <div style={{ marginTop: 4 }}>
            sample: {debugSample?.code || '(none)'}
          </div>
          <div>item actual_qty: {String(debugSample?.itemQty ?? 'n/a')}</div>
          <div>item valuation_rate: {String(debugSample?.itemRate ?? 'n/a')}</div>
          <div>stock actual_qty: {String(debugSample?.stockQty ?? 'n/a')}</div>
          <div>stock valuation_rate: {String(debugSample?.stockRate ?? 'n/a')}</div>
          {error && <div style={{ color: '#f87171' }}>error: {error}</div>}
        </div>
      </>
    );
  }

  if (screen === 'confirm') {
    return (
      <>
        <Confirm
          date={requestedDate}
          shiftLabel={shiftLabel}
          actuals={actuals}
          orders={orders}
          groups={groups}
          onBack={() => setScreen('browse')}
          onSubmit={() => setShowConfirm(true)}
          onSaveDraft={saveDraft}
          notes={notes}
          onNotesChange={setNotes}
        />
        {showConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }}
          >
            <div
              style={{
                width: 320,
                background: '#fff',
                borderRadius: 14,
                padding: 16,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
                Confirm Submission
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
                Are you sure you want to place this order or update your stock?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    background: '#F9FAFB',
                    fontWeight: 800,
                    fontSize: 13
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    submit();
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#F97316',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 13
                  }}
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Success
      date={requestedDate}
      shiftLabel={shiftLabel}
      actuals={actuals}
      orders={orders}
      groups={groups}
      requisitionId={lastRequisitionId || 'KR-NEW'}
      onDashboard={() => {
        setScreen('browse');
        setActuals({});
        setOrders({});
        setLastRequisitionId('');
        router.push(kitchenBackUrl);
      }}
    />
  );
}
