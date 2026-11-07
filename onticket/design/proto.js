/*
 * 온티켓 클릭 프로토타입 — 서버 흉내와 공통 도우미. 제품 코드가 아니다.
 * 금액·잔여수량·결제 승인·입장 판정은 실제로 서버가 한다(프로젝트구조 1.2). 여기서는 화면을 눌러 보려고 흉내만 낸다.
 * 바뀐 값은 이 브라우저의 localStorage에만 남는다. "데이터 처음으로"로 지운다.
 */
(function () {
  const D = window.PROTO_DATA;
  const KEY = 'onticket-proto-v1';
  const DEMO_EMAIL = 'example@example.com'; // CSV 주문에는 이메일이 없다. 모든 CSV 주문을 이 가짜 이메일로 조회한다.

  // 매진·수량 한계를 실제 값으로 보이려고 바꾼 등급 (CSV에는 잔여수량 0인 등급이 없다)
  const OVERRIDES = {
    TT007: { 판매수량: 200, 잔여수량: 0 },  // 뮤지컬 <달빛 극장> A석: 등급 매진
    TT012: { 판매수량: 248, 잔여수량: 2 },  // 김선우 피아노 리사이틀 R석: 잔여 2 (수량 3은 못 산다)
    TT013: { 판매수량: 399, 잔여수량: 1 },  // 김선우 피아노 리사이틀 S석: 잔여 1
    TT023: { 판매수량: 300, 잔여수량: 0 },  // 클래식 갈라: 모든 등급 매진
    TT024: { 판매수량: 500, 잔여수량: 0 },
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  let S = load();
  function norm() {
    S.events = S.events || {}; S.types = S.types || {}; S.orders = S.orders || [];
    S.status = S.status || {}; S.checkins = S.checkins || {}; S.seq = S.seq || 300;
    S.admin = !!S.admin; S.gate = S.gate || '';
  }
  norm();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 못 해도 화면은 돈다 */ } }

  // ── 조회 ──────────────────────────────────────────────
  function events() {
    const base = D.events.map(e => Object.assign({}, e, S.events[e.event_id] || {}));
    Object.keys(S.events).forEach(id => { if (!D.events.find(e => e.event_id === id)) base.push(Object.assign({}, S.events[id])); });
    return base;
  }
  function event(id) { return events().find(e => e.event_id === id) || null; }
  function types() {
    const base = D.ticketTypes.map(t => Object.assign({}, t, OVERRIDES[t.ticket_type_id] || {}, S.types[t.ticket_type_id] || {}));
    Object.keys(S.types).forEach(id => { if (!D.ticketTypes.find(t => t.ticket_type_id === id)) base.push(Object.assign({}, S.types[id])); });
    return base;
  }
  function typesOf(eid) { return types().filter(t => t.event_id === eid).sort((a, b) => a.ticket_type_id.localeCompare(b.ticket_type_id)); }
  function type(id) { return types().find(t => t.ticket_type_id === id) || null; }
  function orders() {
    const base = D.orders.map(o => Object.assign({ email: DEMO_EMAIL }, o));
    return base.concat(S.orders.map(o => Object.assign({}, o))).map(o => {
      if (S.status[o.order_id]) o.상태 = S.status[o.order_id];
      return o;
    });
  }
  function order(id) { return orders().find(o => o.order_id === id) || null; }
  function checkinOf(orderId) {
    if (S.checkins[orderId]) return S.checkins[orderId];
    return D.checkins.find(c => c.order_id === orderId) || null;
  }
  function soldOut(e) {
    if (e.판매상태 === '매진') return true;
    const ts = typesOf(e.event_id);
    return ts.length > 0 && ts.every(t => t.잔여수량 === 0);
  }
  function stats(eid) {
    let qty = 0, amount = 0;
    orders().forEach(o => {
      if (o.event_id === eid && (o.상태 === '결제완료' || o.상태 === '입장완료')) { qty += o.수량; amount += o.결제금액; }
    });
    return { qty, amount };
  }

  // ── 서버 흉내: 주문·승인 ──────────────────────────────
  function maxQty(tt) { const t = type(tt); return t ? Math.min(4, t.잔여수량) : 0; }
  function quote(tt, qty) { const t = type(tt); return t ? t.가격 * qty : 0; }
  function today() { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function nowText() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function createOrder({ eid, tt, qty, email }) {
    const e = event(eid), t = type(tt);
    if (!e || e.판매상태 !== '판매중') return { error: '판매끝남', 판매상태: e ? e.판매상태 : '' };
    if (!t || t.event_id !== eid) return { error: '등급불일치' };
    if (!(qty >= 1 && qty <= 4) || qty > t.잔여수량) return { error: '수량부족' };
    S.seq += 1;
    const o = {
      order_id: `ORD-${today()}-${String(S.seq).padStart(4, '0')}`,
      event_id: eid, ticket_type_id: tt, 등급: t.등급, 수량: qty, 결제금액: t.가격 * qty,
      상태: '승인대기', 주문일시: nowText(), qr_code: '', email,
    };
    S.orders.push(o); save();
    return { order: o };
  }
  function setOrder(id, patch) { const o = S.orders.find(x => x.order_id === id); if (o) Object.assign(o, patch); save(); return o; }
  function approve(id) {
    const o = S.orders.find(x => x.order_id === id);
    if (!o) return { ok: false };
    if (o.상태 === '결제완료') return { ok: true, order: o };
    const t = type(o.ticket_type_id);
    if (!t || t.잔여수량 < o.수량) { setOrder(id, { 상태: '취소' }); return { ok: false, reason: '수량부족' }; }
    const used = new Set(orders().map(x => x.qr_code));
    let qr;
    do { qr = `OT-${o.order_id.slice(-4)}-${Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0')}`; } while (used.has(qr));
    S.types[t.ticket_type_id] = Object.assign({}, S.types[t.ticket_type_id] || {}, { 판매수량: t.판매수량 + o.수량, 잔여수량: t.잔여수량 - o.수량 });
    setOrder(id, { 상태: '결제완료', qr_code: qr });
    return { ok: true, order: o };
  }
  function cancel(id) { setOrder(id, { 상태: '취소' }); }
  function lookup(id, email) {
    const o = order(id);
    if (!o || o.email !== email) return null;
    return o;
  }

  // ── 서버 흉내: 입장 판정 ──────────────────────────────
  function checkin(eid, code, gate) {
    const o = orders().find(x => x.qr_code && x.qr_code === code);
    if (!o || (o.상태 !== '결제완료' && o.상태 !== '입장완료')) return { result: '불가' };
    if (o.event_id !== eid) return { result: '다른공연', order: o, event: event(o.event_id) };
    if (o.상태 === '입장완료') return { result: '이미입장', order: o, checkin: checkinOf(o.order_id) };
    const c = { order_id: o.order_id, qr_code: code, 게이트: gate, 입장일시: nowText() };
    S.checkins[o.order_id] = c; S.status[o.order_id] = '입장완료'; save();
    return { result: '허용', order: o, checkin: c };
  }
  function sampleCode(eid, kind) {
    const os = orders().filter(o => o.qr_code);
    if (kind === '허용') { const o = os.find(o => o.event_id === eid && o.상태 === '결제완료'); return o && o.qr_code; }
    if (kind === '다른공연') { const o = os.find(o => o.event_id !== eid && o.상태 === '결제완료'); return o && o.qr_code; }
    if (kind === '이미입장') { const o = os.find(o => o.event_id === eid && o.상태 === '입장완료'); return o && o.qr_code; }
    if (kind === '불가') { const o = os.find(o => o.상태 !== '결제완료' && o.상태 !== '입장완료'); return o ? o.qr_code : 'OT-9999-FFFF'; }
    return 'OT-9999-FFFF';
  }

  // ── 서버 흉내: 공연 등록·수정 ─────────────────────────
  function saveEvent(id, fields, rows) {
    const errors = {};
    rows.forEach((r, i) => {
      if (r.ticket_type_id) {
        const t = type(r.ticket_type_id);
        if (t && r.총수량 < t.판매수량) errors['총수량-' + i] = t.판매수량;
      }
    });
    if (Object.keys(errors).length) return { errors };
    let eid = id;
    if (!eid) {
      const n = events().map(e => parseInt(e.event_id.slice(2), 10)).reduce((a, b) => Math.max(a, b), 0) + 1;
      eid = 'EV' + String(n).padStart(3, '0');
    }
    S.events[eid] = Object.assign({}, S.events[eid] || {}, fields, { event_id: eid, 주최: '(주)승승장구' });
    let tn = types().map(t => parseInt(t.ticket_type_id.slice(2), 10)).reduce((a, b) => Math.max(a, b), 0);
    rows.forEach(r => {
      if (r.ticket_type_id) {
        const t = type(r.ticket_type_id);
        S.types[r.ticket_type_id] = Object.assign({}, S.types[r.ticket_type_id] || {}, { 등급: r.등급, 가격: r.가격, 총수량: r.총수량, 잔여수량: r.총수량 - t.판매수량 });
      } else {
        tn += 1;
        const tid = 'TT' + String(tn).padStart(3, '0');
        S.types[tid] = { ticket_type_id: tid, event_id: eid, 등급: r.등급, 가격: r.가격, 총수량: r.총수량, 판매수량: 0, 잔여수량: r.총수량 };
      }
    });
    save();
    return { ok: true, id: eid };
  }

  // ── 운영 비밀번호 확인 흉내 ───────────────────────────
  function isAdmin() { return S.admin; }
  function setAdmin(v) { S.admin = !!v; save(); }
  function requireAdmin() {
    if (!S.admin) { location.replace('admin-login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return false; }
    return true;
  }
  function gate(v) { if (v !== undefined) { S.gate = v; save(); } return S.gate; }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } S = {}; norm(); }

  // ── 표시 도우미 ───────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fmtDate(s) {
    if (!s) return '';
    const [d, t] = s.split(' ');
    const day = '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
    return `${d.replace(/-/g, '.')} (${day}) ${t || ''}`.trim();
  }
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const param = k => new URLSearchParams(location.search).get(k);

  // 진짜 QR이 아니다. qr_code 글자로 정해지는 무늬만 그린다(프로토타입 전용).
  function qrSvg(code) {
    const N = 25; let h = 2166136261;
    for (const ch of code) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h; };
    const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
    const finderOn = (x, y) => { const fx = x >= N - 7 ? x - (N - 7) : x, fy = y >= N - 7 ? y - (N - 7) : y; return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); };
    let d = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const on = finder(x, y) ? finderOn(x, y) : (rnd() & 1) === 1;
      if (on) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    }
    return `<svg class="qr" viewBox="0 0 ${N + 4} ${N + 4}" role="img" aria-label="QR 티켓 ${esc(code)}"><rect class="qr-bg" width="${N + 4}" height="${N + 4}"/><path class="qr-m" d="${d}"/></svg>`;
  }

  const ICON = {
    alert: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    x: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    eye: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 6 10 6a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    minus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    scan: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
  };

  /*
   * 프로토타입 전용 띠. groups = [{ label, buttons: [{ text, onClick | href, pressed }] }]
   * 화면 요소와 섞이지 않게 화면 틀 밖 맨 위에 놓는다.
   */
  function strip(el, title, groups) {
    let html = `<div class="proto-head"><span class="proto-tag">프로토타입 전용</span><span>${esc(title)}</span></div>`;
    const handlers = [];
    groups.forEach(g => {
      html += `<div class="proto-group"><span class="proto-group-label">${esc(g.label)}</span>`;
      g.buttons.forEach(b => {
        if (b.href) html += `<a class="proto-btn" href="${esc(b.href)}">${esc(b.text)}</a>`;
        else { handlers.push(b.onClick); html += `<button type="button" class="proto-btn" data-h="${handlers.length - 1}" aria-pressed="${b.pressed ? 'true' : 'false'}">${esc(b.text)}</button>`; }
      });
      html += '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => handlers[+b.dataset.h]()));
  }
  function resetButton() {
    return { text: '데이터 처음으로', onClick: () => { reset(); location.reload(); } };
  }

  function customerHeader() {
    return '<header class="top"><a class="wordmark" href="home.html">온티켓<span class="wordmark-dot">.</span></a><a class="top-link" href="ticket.html">티켓 조회</a></header>';
  }
  function adminHeader(sub) {
    return `<header class="top"><div class="top-left"><a class="wordmark" href="admin.html">온티켓<span class="wordmark-dot">.</span></a><span class="top-sub">${sub || '운영 서비스'}</span></div><button type="button" class="top-link" data-logout>나가기</button></header>`;
  }
  function bindLogout(root) {
    root.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', () => { setAdmin(false); location.href = 'admin-login.html'; }));
  }

  // 결제 완료·티켓 조회가 함께 쓰는 티켓 모양
  function ticketHtml(o, extra) {
    const e = event(o.event_id) || {};
    return `
      <div class="ticket">
        ${qrSvg(o.qr_code)}
        <p class="qr-code">${esc(o.qr_code)}</p>
        <p class="caption muted">공연장 입구에서 이 QR을 보여 주세요.</p>
        ${o.수량 >= 2 ? '<p class="caption">이 QR 하나로 함께 온 인원이 입장해요.</p>' : ''}
        ${extra || ''}
      </div>
      <dl class="dl">
        <dt>주문번호</dt><dd class="num strong">${esc(o.order_id)}</dd>
        <dt>공연</dt><dd>${esc(e.제목)}</dd>
        <dt>일시</dt><dd class="num">${esc(fmtDate(e.시작일시))}</dd>
        <dt>장소</dt><dd>${esc(e.장소)}</dd>
        <dt>등급</dt><dd>${esc(o.등급)}</dd>
        <dt>수량</dt><dd class="num">${o.수량}장</dd>
        <dt>결제금액</dt><dd class="price">${won(o.결제금액)}</dd>
        <dt>이메일</dt><dd>${esc(o.email)}</dd>
      </dl>`;
  }

  window.P = {
    events, event, typesOf, type, orders, order, checkinOf, soldOut, stats,
    maxQty, quote, createOrder, approve, cancel, lookup, checkin, sampleCode, saveEvent,
    isAdmin, setAdmin, requireAdmin, gate, reset,
    esc, fmtDate, won, param, qrSvg, ICON, strip, resetButton, customerHeader, adminHeader, bindLogout, ticketHtml,
    DEMO_EMAIL,
  };
})();
