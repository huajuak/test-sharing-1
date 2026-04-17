const INITIAL_CASH = 100000;
const MAX_ROUNDS = 30;

const STOCKS = [
  { symbol: 'PTT',  name: 'ปตท.',           price: 35,   volatility: 0.04 },
  { symbol: 'AOT',  name: 'ท่าอากาศยาน',     price: 72,   volatility: 0.05 },
  { symbol: 'ADVA', name: 'แอดวานซ์ อินโฟ',  price: 220,  volatility: 0.035 },
  { symbol: 'CPALL',name: 'ซีพี ออลล์',       price: 58,   volatility: 0.045 },
  { symbol: 'KBANK',name: 'กสิกรไทย',         price: 145,  volatility: 0.04 },
  { symbol: 'SCB',  name: 'ไทยพาณิชย์',       price: 105,  volatility: 0.04 },
];

const NEWS_EVENTS = [
  { text: '📢 PTT ประกาศลงทุนพลังงานสะอาด คาดราคาพุ่ง!', stock: 'PTT', effect: 1 },
  { text: '✈️ AOT รายงานนักท่องเที่ยวทะลุเป้า ราคาหุ้นบวก', stock: 'AOT', effect: 1 },
  { text: '📱 ADVA เปิดตัว 5G ครอบคลุมทั่วประเทศ', stock: 'ADVA', effect: 1 },
  { text: '🛒 CPALL ขยายสาขา 7-Eleven อีก 500 แห่ง', stock: 'CPALL', effect: 1 },
  { text: '💰 KBANK รายงานกำไรไตรมาสสูงสุดในรอบ 5 ปี', stock: 'KBANK', effect: 1 },
  { text: '⚠️ ราคาน้ำมันดิบร่วงแรง กระทบ PTT โดยตรง', stock: 'PTT', effect: -1 },
  { text: '🌧️ มรสุมทำให้เที่ยวบินหยุดชะงัก AOT ผลกำไรลด', stock: 'AOT', effect: -1 },
  { text: '📉 ค่าเงินบาทอ่อนตัว ต้นทุนนำเข้าพุ่ง', stock: null, effect: -1 },
  { text: '🌍 เศรษฐกิจโลกฟื้นตัว ตลาดหุ้นไทยรับอานิสงส์', stock: null, effect: 1 },
  { text: '🏦 ธนาคารกลางขึ้นดอกเบี้ย กระทบหุ้นธนาคาร', stock: 'KBANK', effect: -1 },
  { text: '🏦 SCB ขยายสินเชื่อดิจิทัล เติบโตแข็งแกร่ง', stock: 'SCB', effect: 1 },
  { text: '📊 นักลงทุนต่างชาติเทขายหุ้นไทย ตลาดผันผวน', stock: null, effect: -1 },
  { text: '🎉 ไทยได้รับเลือกเป็นเจ้าภาพ ASEAN Summit', stock: 'AOT', effect: 1 },
  { text: '⚡ ราคาไฟฟ้าพุ่ง กระทบต้นทุนทุกบริษัท', stock: null, effect: -1 },
  { text: '🛡️ รัฐบาลออกมาตรการกระตุ้นเศรษฐกิจ 5 แสนล้าน', stock: null, effect: 1 },
];

let cash = INITIAL_CASH;
let portfolio = {};
let round = 1;
let stocks = STOCKS.map(s => ({ ...s, history: [s.price], currentPrice: s.price }));
let currentEvent = null;
let modalMode = null;
let modalStock = null;

function fmt(n) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function totalStockValue() {
  return stocks.reduce((sum, s) => {
    const qty = portfolio[s.symbol] ? portfolio[s.symbol].qty : 0;
    return sum + qty * s.currentPrice;
  }, 0);
}

function totalValue() { return cash + totalStockValue(); }

function updateHeader() {
  const sv = totalStockValue();
  const tv = totalValue();
  const pnl = tv - INITIAL_CASH;
  const pct = (pnl / INITIAL_CASH * 100).toFixed(2);

  document.getElementById('cash').textContent = fmt(cash);
  document.getElementById('stock-value').textContent = fmt(sv);
  document.getElementById('total-value').textContent = fmt(tv);

  const pnlEl = document.getElementById('pnl');
  pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnl >= 0 ? '+' : ''}${pct}%)`;
  pnlEl.className = 'value ' + (pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'neutral');
}

function drawMiniChart(canvas, history) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (history.length < 2) return;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  ctx.beginPath();
  history.forEach((p, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((p - min) / range) * h * 0.85 - h * 0.05;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  const last = history[history.length - 1];
  const first = history[0];
  ctx.strokeStyle = last >= first ? '#3fb950' : '#f85149';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function renderStocks() {
  const list = document.getElementById('stock-list');
  list.innerHTML = '';

  stocks.forEach(s => {
    const prev = s.history.length > 1 ? s.history[s.history.length - 2] : s.history[0];
    const change = s.currentPrice - prev;
    const pct = ((change / prev) * 100).toFixed(2);
    const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    const dirBg = change > 0 ? 'up-bg' : change < 0 ? 'down-bg' : '';

    const ownedQty = portfolio[s.symbol] ? portfolio[s.symbol].qty : 0;

    const card = document.createElement('div');
    card.className = 'stock-card';
    card.innerHTML = `
      <div class="stock-header">
        <div>
          <span class="stock-symbol">${s.symbol}</span>
          <span class="stock-name"> ${s.name}</span>
        </div>
        <div>
          <span class="stock-price ${dir}">${fmt(s.currentPrice)}</span>
          <span class="price-change ${dir} ${dirBg}">${change >= 0 ? '+' : ''}${pct}%</span>
        </div>
      </div>
      <div class="mini-chart"><canvas id="chart-${s.symbol}" width="200" height="32"></canvas></div>
      <div class="stock-actions">
        <button class="btn-buy" onclick="openModal('buy','${s.symbol}')">ซื้อ</button>
        <button class="btn-sell" onclick="openModal('sell','${s.symbol}')" ${ownedQty === 0 ? 'disabled' : ''}>ขาย (${ownedQty})</button>
      </div>
    `;
    list.appendChild(card);

    const canvas = document.getElementById(`chart-${s.symbol}`);
    drawMiniChart(canvas, s.history);
  });
}

function renderPortfolio() {
  const list = document.getElementById('portfolio-list');
  list.innerHTML = '';

  const entries = Object.entries(portfolio).filter(([, v]) => v.qty > 0);
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-msg">ยังไม่มีหุ้นในพอร์ต</p>';
    return;
  }

  entries.forEach(([sym, pos]) => {
    const s = stocks.find(x => x.symbol === sym);
    const curVal = pos.qty * s.currentPrice;
    const costVal = pos.qty * pos.avgCost;
    const pnl = curVal - costVal;
    const pct = ((pnl / costVal) * 100).toFixed(2);
    const dir = pnl >= 0 ? 'up' : 'down';

    const card = document.createElement('div');
    card.className = 'port-card';
    card.innerHTML = `
      <div class="port-header">
        <span class="port-symbol">${sym}</span>
        <span class="port-qty">${pos.qty} หุ้น</span>
      </div>
      <div class="port-values">
        ต้นทุน: ${fmt(pos.avgCost)}/หุ้น &nbsp;|&nbsp; ปัจจุบัน: ${fmt(s.currentPrice)}/หุ้น
      </div>
      <div class="port-values">
        มูลค่า: ${fmt(curVal)} &nbsp;
        <span class="${dir}">${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnl >= 0 ? '+' : ''}${pct}%)</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function pickEvent() {
  return NEWS_EVENTS[Math.floor(Math.random() * NEWS_EVENTS.length)];
}

function updatePrices() {
  const event = currentEvent;
  stocks.forEach(s => {
    let move = (Math.random() * 2 - 1) * s.volatility;

    if (event) {
      if (event.stock === s.symbol) {
        move += event.effect * 0.06;
      } else if (event.stock === null) {
        move += event.effect * 0.025;
      }
    }

    s.currentPrice = Math.max(1, s.currentPrice * (1 + move));
    s.history.push(s.currentPrice);
    if (s.history.length > 30) s.history.shift();
  });
}

function updateTicker(event) {
  const ticker = document.getElementById('ticker-content');
  const priceInfo = stocks.map(s => {
    const prev = s.history.length > 1 ? s.history[s.history.length - 2] : s.history[0];
    const pct = (((s.currentPrice - prev) / prev) * 100).toFixed(2);
    const arrow = s.currentPrice >= prev ? '▲' : '▼';
    return `${s.symbol} ${fmt(s.currentPrice)} ${arrow}${Math.abs(pct)}%`;
  }).join('   ·   ');

  const newsText = event ? `  📰 ${event.text}  ·  ` : '';
  ticker.textContent = newsText + priceInfo + '   ·   ' + priceInfo;
}

function render() {
  document.getElementById('round-num').textContent = round;
  updateHeader();
  renderStocks();
  renderPortfolio();
}

function nextRound() {
  if (round >= MAX_ROUNDS) return;

  currentEvent = Math.random() < 0.6 ? pickEvent() : null;
  updatePrices();
  round++;
  render();
  updateTicker(currentEvent);

  if (round > MAX_ROUNDS) {
    setTimeout(showGameOver, 300);
  }
}

function showGameOver() {
  const tv = totalValue();
  const pnl = tv - INITIAL_CASH;
  const pct = ((pnl / INITIAL_CASH) * 100).toFixed(2);

  let grade;
  if (pct >= 30) grade = '🏆 นักลงทุนระดับตำนาน!';
  else if (pct >= 15) grade = '🥇 นักลงทุนมือโปร!';
  else if (pct >= 5) grade = '🥈 นักลงทุนหน้าใหม่ที่มีแววดี!';
  else if (pct >= 0) grade = '🥉 ยังไม่ขาดทุน ถือว่าใช้ได้!';
  else grade = '📉 เสียใจด้วย ลองใหม่อีกครั้ง!';

  document.getElementById('final-result').textContent = grade;
  document.getElementById('final-score').textContent =
    `ทุนเริ่มต้น ${fmt(INITIAL_CASH)} → ทุนสุดท้าย ${fmt(tv)} (${pnl >= 0 ? '+' : ''}${pct}%)`;

  document.getElementById('game-over').classList.remove('hidden');
}

// Modal
function openModal(mode, symbol) {
  modalMode = mode;
  modalStock = stocks.find(s => s.symbol === symbol);

  const maxQty = mode === 'buy'
    ? Math.floor(cash / modalStock.currentPrice)
    : (portfolio[symbol] ? portfolio[symbol].qty : 0);

  if (maxQty <= 0) {
    alert(mode === 'buy' ? 'เงินไม่พอ!' : 'ไม่มีหุ้นที่จะขาย!');
    return;
  }

  document.getElementById('modal-title').textContent =
    (mode === 'buy' ? '🛒 ซื้อหุ้น ' : '💸 ขายหุ้น ') + symbol;
  document.getElementById('modal-stock-info').textContent =
    `ราคา: ${fmt(modalStock.currentPrice)} | ${mode === 'buy' ? 'เงินสดที่มี' : 'จำนวนที่ถือ'}: ${mode === 'buy' ? fmt(cash) : maxQty + ' หุ้น'}`;

  const qtyInput = document.getElementById('modal-qty');
  qtyInput.max = maxQty;
  qtyInput.value = 1;

  const confirmBtn = document.getElementById('modal-confirm-btn');
  confirmBtn.textContent = mode === 'buy' ? 'ยืนยันการซื้อ' : 'ยืนยันการขาย';
  confirmBtn.onclick = confirmTrade;

  updateModalTotal();
  document.getElementById('modal').classList.remove('hidden');
}

function updateModalTotal() {
  if (!modalStock) return;
  const qty = parseInt(document.getElementById('modal-qty').value) || 0;
  const total = qty * modalStock.currentPrice;
  document.getElementById('modal-total').textContent =
    `รวม: ${fmt(total)}`;
}

function confirmTrade() {
  const qty = parseInt(document.getElementById('modal-qty').value);
  if (!qty || qty <= 0) return;

  const sym = modalStock.symbol;
  const price = modalStock.currentPrice;

  if (modalMode === 'buy') {
    const cost = qty * price;
    if (cost > cash) { alert('เงินไม่พอ!'); return; }
    cash -= cost;
    if (!portfolio[sym]) portfolio[sym] = { qty: 0, avgCost: 0 };
    const oldCost = portfolio[sym].avgCost * portfolio[sym].qty;
    portfolio[sym].qty += qty;
    portfolio[sym].avgCost = (oldCost + cost) / portfolio[sym].qty;
  } else {
    if (!portfolio[sym] || portfolio[sym].qty < qty) { alert('หุ้นไม่พอ!'); return; }
    cash += qty * price;
    portfolio[sym].qty -= qty;
    if (portfolio[sym].qty === 0) delete portfolio[sym];
  }

  closeModal();
  render();
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  modalMode = null;
  modalStock = null;
}

function resetGame() {
  cash = INITIAL_CASH;
  portfolio = {};
  round = 1;
  stocks = STOCKS.map(s => ({ ...s, history: [s.price], currentPrice: s.price }));
  currentEvent = null;
  document.getElementById('game-over').classList.add('hidden');
  render();
  updateTicker(null);
}

// Init
resetGame();
