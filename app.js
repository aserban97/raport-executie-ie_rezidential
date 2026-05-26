// ===== Raport Execuție IE — iFort Systems =====
// Date stocate în localStorage. Sincronizare Google Sheets în Etapa 2.

const STORAGE_KEY = 'ifort_raport_ie_v1';

const MATERIALE_DEFAULT = [
  { id: 'tub20', nume: 'Tub rigid 20mm', um: 'm' },
  { id: 'cot20', nume: 'Cot 90° 20mm', um: 'buc' },
  { id: 'clema20', nume: 'Clemă 20mm', um: 'buc' },
  { id: 'manson20', nume: 'Manșon 20mm', um: 'buc' },
  { id: 'cyyf15', nume: 'CYYF 3x1.5', um: 'm' },
  { id: 'cyyf25', nume: 'CYYF 3x2.5', um: 'm' },
  { id: 'cyyf4', nume: 'CYYF 3x4', um: 'm' },
  { id: 'cablu_4x15', nume: 'Cablu 4x1.5mmp', um: 'm' },
];

let state = {
  rapoarte: [],
  apartamente: [],
  materiale: [...MATERIALE_DEFAULT],
  utilizator: '',
  antreprenor: 'KESZ',
  santier: 'Corallis',
  norme: {}, // { '2 camere': { tub20: 80, cyyf25: 150 }, '3 camere': {...} }
  aprovizionari: [], // [{ id, data, materiale: {tub20: 500, ...}, nota }]
};

let pozeCurente = []; // {dataUrl, name} pentru raportul în lucru

// ============= Persistență =============
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (e) { console.error('Load error', e); }
  if (!state.materiale || state.materiale.length === 0) state.materiale = [...MATERIALE_DEFAULT];
  // Migrare: adaugă materiale default lipsă (pentru utilizatori existenți)
  MATERIALE_DEFAULT.forEach(def => {
    if (!state.materiale.some(m => m.id === def.id)) {
      state.materiale.push({ ...def });
    }
  });
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ============= Helpers =============
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 2200);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ============= Tabs =============
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'apartamente') { renderApartamente(); renderNorme(); }
    if (btn.dataset.tab === 'calendar') renderCalendar();
    if (btn.dataset.tab === 'stoc') renderStoc();
    if (btn.dataset.tab === 'kpi') renderKPI();
    if (btn.dataset.tab === 'setari') renderSetari();
  });
});

// ============= Raport zilnic =============
function renderAlocari() {
  const cont = document.getElementById('listaAlocari');
  if (cont.children.length === 0) adaugaAlocare();
}

function adaugaAlocare() {
  const cont = document.getElementById('listaAlocari');
  const block = document.createElement('div');
  block.className = 'alocare-block';
  const hasApartamente = state.apartamente.length > 0;
  const optionsAp = state.apartamente.map(a =>
    `<option value="${a.cod}">${a.cod} (${a.tip})</option>`
  ).join('');
  const materialeHTML = state.materiale.map(m => `
    <div class="alocare-mat-item">
      <label>${m.nume}</label>
      <div class="mat-input">
        <input type="number" class="mat-qty" data-mat="${m.id}" min="0" step="0.1" placeholder="0" />
        <span class="um-small">${m.um}</span>
      </div>
    </div>
  `).join('');

  block.innerHTML = `
    <div class="alocare-head">
      <select class="ap">
        <option value="">— Alege apartament/zonă —</option>
        ${optionsAp}
        <option value="__custom__">+ Alt loc (text liber)</option>
      </select>
      <input type="text" class="ap-custom" placeholder="ex: Ap 47 sau Tablou subsol" ${hasApartamente ? 'hidden' : ''} />
      <input type="number" class="qty-oameni" min="1" max="50" placeholder="Oameni" />
      <select class="stare-noua">
        <option value="">— Stare —</option>
        <option value="in_lucru">În lucru</option>
        <option value="gata">Gata</option>
        <option value="blocat">Blocat</option>
      </select>
      <button type="button" class="btn-del">×</button>
    </div>
    <div class="alocare-materiale">${materialeHTML}</div>
  `;
  if (!hasApartamente) {
    block.querySelector('.ap').style.display = 'none';
    block.querySelector('.ap').value = '__custom__';
  }
  block.querySelector('.btn-del').addEventListener('click', () => block.remove());
  block.querySelector('.ap').addEventListener('change', (e) => {
    const customInput = block.querySelector('.ap-custom');
    if (e.target.value === '__custom__') customInput.hidden = false;
    else { customInput.hidden = true; customInput.value = ''; }
  });
  cont.appendChild(block);
}

document.getElementById('btnAdaugaAlocare').addEventListener('click', adaugaAlocare);

document.getElementById('formRaport').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = document.getElementById('data').value;
  const nume = document.getElementById('numeIntrodus').value.trim();
  const oraStart = document.getElementById('oraStart').value;
  const oraFinal = document.getElementById('oraFinal').value;
  const nrPersoane = parseInt(document.getElementById('nrPersoane').value, 10);
  const nrElectricieni = parseInt(document.getElementById('nrElectricieni').value, 10) || 0;
  const observatii = document.getElementById('observatii').value.trim();

  const alocari = [];
  document.querySelectorAll('#listaAlocari .alocare-block').forEach(block => {
    let ap = block.querySelector('.ap').value;
    if (ap === '__custom__') ap = block.querySelector('.ap-custom').value.trim();
    const oameni = parseInt(block.querySelector('.qty-oameni').value, 10) || 0;
    const stareNoua = block.querySelector('.stare-noua').value;
    const materialeAp = {};
    block.querySelectorAll('.mat-qty').forEach(inp => {
      const v = parseFloat(inp.value);
      if (v > 0) materialeAp[inp.dataset.mat] = v;
    });
    if (ap) alocari.push({ ap, oameni, stareNoua, materiale: materialeAp });
  });

  if (alocari.length === 0) { toast('Completează apartamentul / zona la cel puțin un rând'); return; }

  // Total materiale (sumă peste toate alocările)
  const materiale = {};
  alocari.forEach(a => {
    Object.entries(a.materiale || {}).forEach(([k, v]) => {
      materiale[k] = (materiale[k] || 0) + v;
    });
  });

  const raport = {
    id: uid(), data, utilizator: nume, oraStart, oraFinal,
    nrPersoane, nrElectricieni, alocari, materiale,
    poze: [...pozeCurente], observatii,
    createdAt: new Date().toISOString(),
  };

  state.rapoarte.unshift(raport);
  state.utilizator = nume;

  // Actualizează starea apartamentelor
  alocari.forEach(a => {
    const ap = state.apartamente.find(x => x.cod === a.ap);
    if (ap && a.stareNoua) ap.stare = a.stareNoua;
    else if (ap && !a.stareNoua && ap.stare === 'neinceput') ap.stare = 'in_lucru';
  });

  save();
  renderRapoarte();
  renderUserBadge();
  e.target.reset();
  document.getElementById('data').value = todayISO();
  document.getElementById('numeIntrodus').value = state.utilizator;
  document.getElementById('listaAlocari').innerHTML = '';
  pozeCurente = [];
  renderPreviewPoze();
  renderAlocari();
  toast('Raport salvat ✓');
});

// ============= Poze =============
function renderPreviewPoze() {
  const cont = document.getElementById('previewPoze');
  cont.innerHTML = '';
  pozeCurente.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'poza-thumb';
    d.innerHTML = `<img src="${p.dataUrl}" /><button type="button" class="del-poza" data-i="${i}">×</button>`;
    d.querySelector('.del-poza').addEventListener('click', () => {
      pozeCurente.splice(i, 1); renderPreviewPoze();
    });
    cont.appendChild(d);
  });
}

function compressImage(file, maxW = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('poze').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const f of files) {
    if (pozeCurente.length >= 4) { toast('Maxim 4 poze'); break; }
    const dataUrl = await compressImage(f);
    pozeCurente.push({ dataUrl, name: f.name });
  }
  renderPreviewPoze();
  e.target.value = '';
});

function renderRapoarte() {
  const cont = document.getElementById('listaRapoarte');
  if (state.rapoarte.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun raport încă</div>';
    return;
  }
  cont.innerHTML = '';
  state.rapoarte.slice(0, 30).forEach(r => {
    const item = document.createElement('div');
    item.className = 'raport-item';
    const apartLista = r.alocari.map(a => `${a.ap}${a.oameni ? ` (${a.oameni}p)` : ''}`).join(', ');
    const matLista = Object.entries(r.materiale).map(([k, v]) => {
      const m = state.materiale.find(x => x.id === k);
      return m ? `${m.nume}: ${v}${m.um}` : '';
    }).filter(Boolean).join(' • ');
    item.innerHTML = `
      <div class="head">
        <strong>${fmtDate(r.data)}</strong>
        <span class="info">${r.utilizator || '—'} • ${r.nrPersoane}p (${r.nrElectricieni || 0}el) • ${r.oraStart}-${r.oraFinal}</span>
      </div>
      <div class="info"><b>Lucrat:</b> ${apartLista}</div>
      <div class="info"><b>Material:</b> ${matLista || '—'}</div>
      ${r.observatii ? `<div class="info"><b>Obs:</b> ${r.observatii}</div>` : ''}
      <div class="btns">
        <button class="btn-secondary" data-pdf="${r.id}">PDF</button>
        <button class="btn-del" data-del="${r.id}">Șterge</button>
      </div>
    `;
    cont.appendChild(item);
  });
  cont.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Ștergi raportul?')) return;
    state.rapoarte = state.rapoarte.filter(x => x.id !== b.dataset.del);
    save(); renderRapoarte();
  }));
  cont.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => {
    const r = state.rapoarte.find(x => x.id === b.dataset.pdf);
    if (r) genereazaPDF(r);
  }));
}

// ============= PDF =============
function matRowsHTML(materialeObj) {
  const rows = Object.entries(materialeObj || {}).map(([k, v]) => {
    const m = state.materiale.find(x => x.id === k);
    return m ? `<tr><td>${m.nume}</td><td style="text-align:right">${v} ${m.um}</td></tr>` : '';
  }).filter(Boolean).join('');
  return rows || '<tr><td colspan="2" style="text-align:center;color:#9ca3af">Nicio cantitate</td></tr>';
}

function genereazaPDF(r) {
  const antreprenor = state.antreprenor || 'KESZ';
  const santier = state.santier || 'Corallis';

  // PAGINA 1: TOTAL (pentru screenshot rapid către antreprenor)
  const totalPage = `
<div class="page">
  <div class="header">
    <img src="logo.png" class="logo" alt="iFort" />
    <div class="header-text">
      <div class="company">iFort Systems S.R.L.</div>
      <div class="sub">Raport zilnic execuție instalații electrice</div>
    </div>
  </div>

  <div class="info-grid">
    <div><b>Data:</b> ${fmtDate(r.data)}</div>
    <div><b>Program lucru:</b> ${r.oraStart} — ${r.oraFinal}</div>
    <div><b>Antreprenor general:</b> ${antreprenor}</div>
    <div><b>Șantier:</b> ${santier}</div>
    <div><b>Persoane pe șantier:</b> ${r.nrPersoane}</div>
    <div><b>din care electricieni:</b> ${r.nrElectricieni || 0}</div>
  </div>

  <h2>Apartamente / zone lucrate azi</h2>
  <table>
    <thead><tr><th>Locație</th><th style="text-align:right">Oameni</th><th style="text-align:right">Stare</th></tr></thead>
    <tbody>
      ${r.alocari.map(a => `<tr><td>${a.ap}</td><td style="text-align:right">${a.oameni || '—'}</td><td style="text-align:right">${{in_lucru:'În lucru',gata:'Gata',blocat:'Blocat'}[a.stareNoua] || '—'}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>TOTAL materiale folosite</h2>
  <table>
    <thead><tr><th>Material</th><th style="text-align:right">Cantitate totală</th></tr></thead>
    <tbody>${matRowsHTML(r.materiale)}</tbody>
  </table>

  ${r.observatii ? `<h2>Observații</h2><div class="obs">${r.observatii}</div>` : ''}

  <div class="footer">Document generat — iFort Systems S.R.L.</div>
</div>`;

  // PAGINI urmatoare: detaliu per apartament
  const apartPages = r.alocari.map((a, idx) => `
<div class="page">
  <div class="header">
    <img src="logo.png" class="logo" alt="iFort" />
    <div class="header-text">
      <div class="company">iFort Systems S.R.L.</div>
      <div class="sub">Detaliu apartament — ${fmtDate(r.data)}</div>
    </div>
  </div>

  <div class="info-grid">
    <div><b>Locație:</b> ${a.ap}</div>
    <div><b>Oameni alocați:</b> ${a.oameni || '—'}</div>
    <div><b>Stare:</b> ${{in_lucru:'În lucru',gata:'Gata',blocat:'Blocat'}[a.stareNoua] || '—'}</div>
    <div><b>Antreprenor:</b> ${antreprenor}</div>
  </div>

  <h2>Materiale folosite la această locație</h2>
  <table>
    <thead><tr><th>Material</th><th style="text-align:right">Cantitate</th></tr></thead>
    <tbody>${matRowsHTML(a.materiale)}</tbody>
  </table>

  <div class="footer">Pagina ${idx + 2} — Document generat — iFort Systems S.R.L.</div>
</div>`).join('');

  // PAGINA finală: poze (dacă există)
  const pozePage = r.poze && r.poze.length > 0 ? `
<div class="page">
  <div class="header">
    <img src="logo.png" class="logo" alt="iFort" />
    <div class="header-text">
      <div class="company">iFort Systems S.R.L.</div>
      <div class="sub">Poze șantier — ${fmtDate(r.data)}</div>
    </div>
  </div>
  <div class="poze-grid">
    ${r.poze.map(p => `<div class="poza"><img src="${p.dataUrl}" /></div>`).join('')}
  </div>
  <div class="footer">Document generat — iFort Systems S.R.L.</div>
</div>` : '';

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Raport ${fmtDate(r.data)}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
.page{background:white;padding:30px;max-width:780px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1);page-break-after:always}
.page:last-child{page-break-after:auto}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px;height:auto;object-fit:contain}
.header-text .company{font-size:22px;font-weight:700;color:#1e40af;line-height:1.1}
.header-text .sub{font-size:13px;color:#6b7280;margin-top:3px}
h2{font-size:15px;color:#374151;margin-top:22px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px}
th{background:#f3f4f6;text-align:left;font-weight:600}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:12px}
.info-grid div{font-size:14px}
.info-grid b{color:#1e40af}
.obs{background:#fef3c7;padding:12px;border-radius:6px;font-size:13px;margin-top:8px}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
.poze-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.poza img{width:100%;border-radius:6px;border:1px solid #d1d5db}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:1000;box-shadow:0 2px 6px rgba(0,0,0,0.2)}
@media print{
  body{background:white}
  .page{margin:0;box-shadow:none;max-width:100%}
  .no-print{display:none}
}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
${totalPage}
${apartPages}
${pozePage}
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

document.getElementById('btnPDF').addEventListener('click', () => {
  if (state.rapoarte.length === 0) { toast('Salvează un raport mai întâi'); return; }
  genereazaPDF(state.rapoarte[0]);
});

// ============= Apartamente =============
function renderApartamente() {
  const cont = document.getElementById('hartaApartamente');
  const fStare = document.getElementById('filtruStare').value;
  const fTip = document.getElementById('filtruTip').value;
  const lista = state.apartamente.filter(a =>
    (!fStare || a.stare === fStare) && (!fTip || a.tip === fTip)
  );
  if (lista.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun apartament. Adaugă mai jos.</div>';
    return;
  }
  cont.innerHTML = '';
  lista.forEach(a => {
    const cell = document.createElement('div');
    cell.className = 'ap-cell ' + (a.stare || 'neinceput');
    cell.innerHTML = `${a.cod}<span class="tip">${a.tip}</span>`;
    cell.addEventListener('click', () => {
      const stari = ['neinceput', 'in_lucru', 'gata', 'blocat'];
      const nume = { neinceput: 'Neînceput', in_lucru: 'În lucru', gata: 'Gata', blocat: 'Blocat' };
      const optHTML = stari.map(s => `${s === a.stare ? '→' : '  '} ${nume[s]}`).join('\n');
      const r = prompt(`${a.cod} (${a.tip})\nStare curentă: ${nume[a.stare || 'neinceput']}\n\nIntrodu nr stare nouă:\n1. Neînceput\n2. În lucru\n3. Gata\n4. Blocat\n5. Șterge apartament`, '');
      if (!r) return;
      if (r === '5') {
        if (confirm(`Ștergi ${a.cod}?`)) {
          state.apartamente = state.apartamente.filter(x => x.cod !== a.cod);
          save(); renderApartamente();
        }
        return;
      }
      const idx = parseInt(r, 10) - 1;
      if (idx >= 0 && idx < stari.length) { a.stare = stari[idx]; save(); renderApartamente(); }
    });
    cont.appendChild(cell);
  });
}

document.getElementById('filtruStare').addEventListener('change', renderApartamente);
document.getElementById('filtruTip').addEventListener('change', renderApartamente);

document.getElementById('formApartament').addEventListener('submit', (e) => {
  e.preventDefault();
  const cod = document.getElementById('codAp').value.trim();
  const tip = document.getElementById('tipAp').value;
  if (state.apartamente.some(x => x.cod === cod)) { toast('Cod deja existent'); return; }
  state.apartamente.push({ cod, tip, stare: 'neinceput' });
  save(); renderApartamente(); e.target.reset();
  toast('Adăugat ✓');
});

document.getElementById('btnBulk').addEventListener('click', () => {
  const prefix = document.getElementById('bulkPrefix').value;
  const s = parseInt(document.getElementById('bulkStart').value, 10);
  const e = parseInt(document.getElementById('bulkEnd').value, 10);
  const tip = document.getElementById('bulkTip').value;
  if (isNaN(s) || isNaN(e) || s > e) { toast('Interval invalid'); return; }
  let adaugate = 0;
  for (let i = s; i <= e; i++) {
    const cod = prefix + i;
    if (!state.apartamente.some(x => x.cod === cod)) {
      state.apartamente.push({ cod, tip, stare: 'neinceput' });
      adaugate++;
    }
  }
  save(); renderApartamente();
  toast(`${adaugate} adăugate ✓`);
});

// ============= KPI =============
function renderKPI() {
  const cards = document.getElementById('kpiCards');
  const rapoarte = state.rapoarte;
  const aps = state.apartamente;

  const totalOameni = rapoarte.reduce((s, r) => s + (r.nrPersoane || 0), 0);
  const totalElectricieni = rapoarte.reduce((s, r) => s + (r.nrElectricieni || 0), 0);
  const totalRapoarte = rapoarte.length;
  const apGata = aps.filter(a => a.stare === 'gata').length;
  const apInLucru = aps.filter(a => a.stare === 'in_lucru').length;
  const apTotal = aps.length;
  const apProcent = apTotal ? Math.round(apGata / apTotal * 100) : 0;

  // Productivitate calculată pe electricieni (cei care muncesc efectiv)
  const totalMat = {};
  rapoarte.forEach(r => {
    Object.entries(r.materiale || {}).forEach(([k, v]) => {
      totalMat[k] = (totalMat[k] || 0) + v;
    });
  });
  const elZile = totalElectricieni || totalOameni; // fallback: dacă nu sunt electricieni separați, folosește total
  const tubPerOmZi = elZile ? (totalMat.tub20 || 0) / elZile : 0;
  const cyyf25PerOmZi = elZile ? (totalMat.cyyf25 || 0) / elZile : 0;

  cards.innerHTML = `
    <div class="kpi-card"><div class="val">${apGata}/${apTotal}</div><div class="lbl">Apartamente terminate</div><div class="sub">${apProcent}% din total</div></div>
    <div class="kpi-card"><div class="val">${apInLucru}</div><div class="lbl">În lucru acum</div></div>
    <div class="kpi-card"><div class="val">${totalRapoarte}</div><div class="lbl">Zile raportate</div></div>
    <div class="kpi-card"><div class="val">${tubPerOmZi.toFixed(1)}</div><div class="lbl">Tub 20mm / electrician-zi (m)</div></div>
    <div class="kpi-card"><div class="val">${cyyf25PerOmZi.toFixed(1)}</div><div class="lbl">CYYF 3x2.5 / electrician-zi (m)</div></div>
    <div class="kpi-card"><div class="val">${(totalMat.tub20 || 0).toFixed(0)}</div><div class="lbl">Tub 20mm total (m)</div></div>
  `;

  // Consum mediu pe tip apartament
  const perTip = {};
  rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      const ap = state.apartamente.find(x => x.cod === a.ap);
      if (!ap) return;
      if (!perTip[ap.tip]) perTip[ap.tip] = { aps: new Set(), mat: {} };
      perTip[ap.tip].aps.add(ap.cod);
    });
    // distribuim materialele proporțional la alocări (aproximare)
    const alocAps = r.alocari.map(a => state.apartamente.find(x => x.cod === a.ap)).filter(Boolean);
    if (alocAps.length === 0) return;
    Object.entries(r.materiale || {}).forEach(([k, v]) => {
      const perAp = v / alocAps.length;
      alocAps.forEach(ap => {
        if (!perTip[ap.tip].mat[k]) perTip[ap.tip].mat[k] = 0;
        perTip[ap.tip].mat[k] += perAp;
      });
    });
  });

  const tipCont = document.getElementById('kpiPerTip');
  if (Object.keys(perTip).length === 0) {
    tipCont.innerHTML = '<div class="empty">Niciun raport încă</div>';
  } else {
    let html = '<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb">Tip</th>';
    state.materiale.slice(0, 4).forEach(m => {
      html += `<th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">${m.nume}</th>`;
    });
    html += '</tr>';
    Object.entries(perTip).forEach(([tip, d]) => {
      const n = d.aps.size || 1;
      html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6"><b>${tip}</b> <span class="small">(${n} ap)</span></td>`;
      state.materiale.slice(0, 4).forEach(m => {
        const v = (d.mat[m.id] || 0) / n;
        html += `<td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${v.toFixed(1)} ${m.um}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    tipCont.innerHTML = html;
  }

  // Trend ultimele 7 zile
  const trendCont = document.getElementById('kpiTrend');
  const ultimeleZile = [...new Set(rapoarte.map(r => r.data))].sort().slice(-7);
  if (ultimeleZile.length === 0) {
    trendCont.innerHTML = '<div class="empty">Niciun raport încă</div>';
  } else {
    let html = '<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:8px;font-size:12px;border-bottom:1px solid #e5e7eb">Data</th><th style="text-align:right;padding:8px;font-size:12px;border-bottom:1px solid #e5e7eb">Total / Electr.</th><th style="text-align:right;padding:8px;font-size:12px;border-bottom:1px solid #e5e7eb">Tub (m)</th><th style="text-align:right;padding:8px;font-size:12px;border-bottom:1px solid #e5e7eb">CYYF 2.5 (m)</th></tr>';
    ultimeleZile.forEach(d => {
      const zile = rapoarte.filter(r => r.data === d);
      const oameni = zile.reduce((s, r) => s + (r.nrPersoane || 0), 0);
      const electricieni = zile.reduce((s, r) => s + (r.nrElectricieni || 0), 0);
      const tub = zile.reduce((s, r) => s + (r.materiale?.tub20 || 0), 0);
      const cyyf = zile.reduce((s, r) => s + (r.materiale?.cyyf25 || 0), 0);
      html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6">${fmtDate(d)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${oameni} / ${electricieni}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${tub.toFixed(0)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${cyyf.toFixed(0)}</td></tr>`;
    });
    html += '</table>';
    trendCont.innerHTML = html;
  }
}

// ============= Setări =============
function renderSetari() {
  document.getElementById('antreprenor').value = state.antreprenor || 'KESZ';
  document.getElementById('santier').value = state.santier || 'Corallis';
  const cont = document.getElementById('listaMaterialeAdmin');
  cont.innerHTML = '';
  state.materiale.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'material-row';
    row.innerHTML = `
      <span class="nume">${m.nume}</span>
      <span class="um">${m.um}</span>
      <button class="btn-del" data-i="${i}">Șterge</button>
    `;
    row.querySelector('.btn-del').addEventListener('click', () => {
      if (!confirm(`Ștergi "${m.nume}"?`)) return;
      state.materiale.splice(i, 1); save(); renderSetari(); renderMateriale();
    });
    cont.appendChild(row);
  });
}

document.getElementById('formMaterial').addEventListener('submit', (e) => {
  e.preventDefault();
  const nume = document.getElementById('materialNume').value.trim();
  const um = document.getElementById('materialUM').value;
  const id = nume.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + uid().slice(0, 4);
  state.materiale.push({ id, nume, um });
  save(); renderSetari(); e.target.reset();
  toast('Material adăugat ✓ (vizibil la următorul raport)');
});

document.getElementById('btnSaveProiect').addEventListener('click', () => {
  state.antreprenor = document.getElementById('antreprenor').value.trim() || 'KESZ';
  state.santier = document.getElementById('santier').value.trim() || 'Corallis';
  save();
  toast('Date proiect salvate ✓');
});

document.getElementById('btnExportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ifort-raport-backup-${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnImportJSON').addEventListener('click', () => {
  document.getElementById('fileImport').click();
});
document.getElementById('fileImport').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('Înlocuiește toate datele curente?')) return;
      state = { ...state, ...data }; save();
      renderAll(); toast('Import reușit ✓');
    } catch (err) { toast('Fișier invalid'); }
  };
  reader.readAsText(f);
});

document.getElementById('btnExportCSV').addEventListener('click', () => {
  const headers = ['Data', 'Utilizator', 'Ora start', 'Ora final', 'Nr persoane', 'Nr electricieni', 'Apartamente', 'Observatii'];
  state.materiale.forEach(m => headers.push(`${m.nume} (${m.um})`));
  const rows = [headers.join(',')];
  state.rapoarte.forEach(r => {
    const apartLista = r.alocari.map(a => `${a.ap}${a.oameni ? `(${a.oameni}p)` : ''}`).join('; ');
    const row = [
      r.data, r.utilizator || '', r.oraStart || '', r.oraFinal || '',
      r.nrPersoane || '', r.nrElectricieni || '', `"${apartLista}"`, `"${(r.observatii || '').replace(/"/g, '""')}"`
    ];
    state.materiale.forEach(m => row.push(r.materiale?.[m.id] || ''));
    rows.push(row.join(','));
  });
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ifort-raport-${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('ATENȚIE: Șterge TOATE datele. Sigur?')) return;
  if (!confirm('Confirmă încă o dată. Datele NU pot fi recuperate.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// ============= User badge =============
function renderUserBadge() {
  document.getElementById('userBadge').textContent = state.utilizator ? `👤 ${state.utilizator}` : '';
}

// ============= Init =============
function renderAll() {
  renderAlocari();
  renderRapoarte();
  renderUserBadge();
  renderPreviewPoze();
}

// ============= NORME =============
const TIPURI_AP = ['2 camere', '3 camere', '4 camere', 'Penthouse', 'Zona comuna'];

function renderNorme() {
  const cont = document.getElementById('normeContainer');
  if (!cont) return;
  cont.innerHTML = '';
  TIPURI_AP.forEach(tip => {
    const block = document.createElement('div');
    block.style.cssText = 'background:#f9fafb;padding:10px;border-radius:6px;margin-bottom:8px';
    const matInputs = state.materiale.map(m => {
      const val = (state.norme[tip] && state.norme[tip][m.id]) || '';
      return `<div class="alocare-mat-item">
        <label>${m.nume}</label>
        <div class="mat-input">
          <input type="number" class="norma-qty" data-tip="${tip}" data-mat="${m.id}" min="0" step="0.1" value="${val}" placeholder="0" />
          <span class="um-small">${m.um}</span>
        </div>
      </div>`;
    }).join('');
    block.innerHTML = `<div style="font-weight:600;margin-bottom:6px;color:#1e40af">${tip}</div><div class="alocare-materiale">${matInputs}</div>`;
    cont.appendChild(block);
  });
  // auto-save on change
  cont.querySelectorAll('.norma-qty').forEach(inp => {
    inp.addEventListener('change', () => {
      const tip = inp.dataset.tip, mat = inp.dataset.mat;
      if (!state.norme[tip]) state.norme[tip] = {};
      const v = parseFloat(inp.value);
      if (v > 0) state.norme[tip][mat] = v;
      else delete state.norme[tip][mat];
      save();
      toast('Normă salvată ✓');
    });
  });
}

// ============= STOC =============
function renderStoc() {
  // Inputs aprovizionare
  const cont = document.getElementById('aprovizionareInputs');
  cont.innerHTML = '';
  state.materiale.forEach(m => {
    const row = document.createElement('div');
    row.className = 'apro-row';
    row.innerHTML = `
      <span class="nume">${m.nume}</span>
      <input type="number" class="apro-qty" data-mat="${m.id}" min="0" step="0.1" placeholder="0" />
      <span class="um">${m.um}</span>
    `;
    cont.appendChild(row);
  });

  // Stoc curent
  const stocCont = document.getElementById('stocCurent');
  const consum = calculeazaConsumTotal();
  const aprovizionat = calculeazaAprovizionatTotal();
  stocCont.innerHTML = '';
  state.materiale.forEach(m => {
    const intrari = aprovizionat[m.id] || 0;
    const iesiri = consum[m.id] || 0;
    const stoc = intrari - iesiri;
    const cls = stoc <= 0 ? 'zero' : (stoc < 50 ? 'low' : '');
    const row = document.createElement('div');
    row.className = 'stoc-item ' + cls;
    row.innerHTML = `
      <div>
        <div class="stoc-nume">${m.nume}</div>
        <div class="stoc-detail">Aprovizionat: ${intrari.toFixed(1)} ${m.um} • Consumat: ${iesiri.toFixed(1)} ${m.um}</div>
      </div>
      <div class="stoc-val">${stoc.toFixed(1)} ${m.um}</div>
    `;
    stocCont.appendChild(row);
  });

  // Istoric mișcări
  const istCont = document.getElementById('istoricMiscari');
  if (state.aprovizionari.length === 0) {
    istCont.innerHTML = '<div class="empty">Nicio aprovizionare încă</div>';
  } else {
    istCont.innerHTML = '';
    state.aprovizionari.slice().reverse().forEach(a => {
      const item = document.createElement('div');
      item.className = 'raport-item';
      const matLista = Object.entries(a.materiale).map(([k, v]) => {
        const m = state.materiale.find(x => x.id === k);
        return m ? `${m.nume}: +${v}${m.um}` : '';
      }).filter(Boolean).join(' • ');
      item.innerHTML = `
        <div class="head">
          <strong>${fmtDate(a.data)}</strong>
          <button class="btn-del" data-del="${a.id}">×</button>
        </div>
        <div class="info">${matLista}</div>
        ${a.nota ? `<div class="info"><b>Notă:</b> ${a.nota}</div>` : ''}
      `;
      item.querySelector('[data-del]').addEventListener('click', () => {
        if (!confirm('Ștergi aprovizionarea?')) return;
        state.aprovizionari = state.aprovizionari.filter(x => x.id !== a.id);
        save(); renderStoc();
      });
      istCont.appendChild(item);
    });
  }
}

function calculeazaConsumTotal() {
  const total = {};
  state.rapoarte.forEach(r => {
    Object.entries(r.materiale || {}).forEach(([k, v]) => {
      total[k] = (total[k] || 0) + v;
    });
  });
  return total;
}

function calculeazaAprovizionatTotal() {
  const total = {};
  state.aprovizionari.forEach(a => {
    Object.entries(a.materiale || {}).forEach(([k, v]) => {
      total[k] = (total[k] || 0) + v;
    });
  });
  return total;
}

document.getElementById('btnAdaugaApro').addEventListener('click', () => {
  const materiale = {};
  document.querySelectorAll('.apro-qty').forEach(inp => {
    const v = parseFloat(inp.value);
    if (v > 0) materiale[inp.dataset.mat] = v;
  });
  if (Object.keys(materiale).length === 0) { toast('Adaugă cel puțin un material'); return; }
  const nota = document.getElementById('aproNota').value.trim();
  state.aprovizionari.push({
    id: uid(), data: todayISO(), materiale, nota,
    createdAt: new Date().toISOString(),
  });
  document.getElementById('aproNota').value = '';
  document.querySelectorAll('.apro-qty').forEach(i => i.value = '');
  save(); renderStoc();
  toast('Aprovizionare salvată ✓');
});

// ============= CALENDAR =============
function renderCalendar() {
  const filtruLuna = document.getElementById('filtruLuna');
  if (!filtruLuna.value) {
    const d = new Date();
    filtruLuna.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [an, luna] = filtruLuna.value.split('-').map(Number);
  const primaZi = new Date(an, luna - 1, 1);
  const ultimaZi = new Date(an, luna, 0);
  const zileInLuna = ultimaZi.getDate();
  let primaZiSapt = primaZi.getDay(); // 0=duminică
  primaZiSapt = primaZiSapt === 0 ? 6 : primaZiSapt - 1; // 0=luni

  const cont = document.getElementById('calendarGrid');
  cont.innerHTML = '';

  // Header zile săptămână
  const header = document.createElement('div');
  header.className = 'calendar-header';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(z => {
    const d = document.createElement('div');
    d.textContent = z;
    header.appendChild(d);
  });
  cont.parentNode.insertBefore(header, cont);
  // remove duplicate headers
  cont.parentNode.querySelectorAll('.calendar-header').forEach((h, i, arr) => {
    if (i < arr.length - 1) h.remove();
  });

  // Spații goale înainte de ziua 1
  for (let i = 0; i < primaZiSapt; i++) {
    const empty = document.createElement('div');
    cont.appendChild(empty);
  }

  // Zilele
  for (let zi = 1; zi <= zileInLuna; zi++) {
    const isoData = `${an}-${String(luna).padStart(2, '0')}-${String(zi).padStart(2, '0')}`;
    const rapoarteZi = state.rapoarte.filter(r => r.data === isoData);
    const cell = document.createElement('div');
    const dayDate = new Date(an, luna - 1, zi);
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    cell.className = 'calendar-day' + (rapoarteZi.length ? ' has-raport' : '') + (isWeekend ? ' weekend' : '');
    cell.innerHTML = `<div class="num">${zi}</div>${rapoarteZi.length ? `<div class="marker">${rapoarteZi.length} raport${rapoarteZi.length > 1 ? 'e' : ''}</div>` : ''}`;
    if (rapoarteZi.length > 0) {
      cell.addEventListener('click', () => {
        // generează PDF pentru prima zi (sau combinat dacă sunt mai multe)
        if (rapoarteZi.length === 1) genereazaPDF(rapoarteZi[0]);
        else {
          if (confirm(`${rapoarteZi.length} rapoarte în ${fmtDate(isoData)}. Generez PDF combinat?`)) {
            genereazaPDFInterval(isoData, isoData, `Raport ${fmtDate(isoData)}`);
          }
        }
      });
    }
    cont.appendChild(cell);
  }

  // Lista istoric textuală
  const ist = document.getElementById('listaIstoric');
  if (state.rapoarte.length === 0) {
    ist.innerHTML = '<div class="empty">Niciun raport încă</div>';
    return;
  }
  ist.innerHTML = '';
  state.rapoarte.slice().sort((a, b) => b.data.localeCompare(a.data)).forEach(r => {
    const item = document.createElement('div');
    item.className = 'raport-item';
    const apartLista = r.alocari.map(a => a.ap).join(', ');
    item.innerHTML = `
      <div class="head">
        <strong>${fmtDate(r.data)}</strong>
        <button class="btn-secondary" data-pdf="${r.id}" style="padding:4px 10px;font-size:12px">PDF</button>
      </div>
      <div class="info">${apartLista} • ${r.nrPersoane}p (${r.nrElectricieni || 0}el)</div>
    `;
    item.querySelector('[data-pdf]').addEventListener('click', () => genereazaPDF(r));
    ist.appendChild(item);
  });
}

document.getElementById('filtruLuna').addEventListener('change', renderCalendar);

document.getElementById('btnDescarcaSaptamana').addEventListener('click', () => {
  const { start, end } = saptamanaCurenta();
  genereazaPDFInterval(start, end, `Săptămâna ${fmtDate(start)} — ${fmtDate(end)}`);
});

function saptamanaCurenta() {
  const azi = new Date();
  const ziSapt = azi.getDay() === 0 ? 6 : azi.getDay() - 1; // 0=luni
  const luni = new Date(azi); luni.setDate(azi.getDate() - ziSapt);
  const duminica = new Date(luni); duminica.setDate(luni.getDate() + 6);
  const fmt = d => d.toISOString().slice(0, 10);
  return { start: fmt(luni), end: fmt(duminica) };
}

function lunaCurenta() {
  const azi = new Date();
  const start = new Date(azi.getFullYear(), azi.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(azi.getFullYear(), azi.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// ============= PDF INTERVAL (săptămânal / lunar) =============
function genereazaPDFInterval(startISO, endISO, titlu) {
  const rapoarte = state.rapoarte
    .filter(r => r.data >= startISO && r.data <= endISO)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (rapoarte.length === 0) { toast('Niciun raport în interval'); return; }

  // Calculează totaluri
  const totalMat = {};
  let totalOameni = 0, totalElectricieni = 0;
  const aps = new Set();
  rapoarte.forEach(r => {
    Object.entries(r.materiale || {}).forEach(([k, v]) => { totalMat[k] = (totalMat[k] || 0) + v; });
    totalOameni += r.nrPersoane || 0;
    totalElectricieni += r.nrElectricieni || 0;
    r.alocari.forEach(a => aps.add(a.ap));
  });

  const totalRows = Object.entries(totalMat).map(([k, v]) => {
    const m = state.materiale.find(x => x.id === k);
    return m ? `<tr><td>${m.nume}</td><td style="text-align:right">${v.toFixed(1)} ${m.um}</td></tr>` : '';
  }).join('');

  const zilePages = rapoarte.map(r => {
    const apList = r.alocari.map(a => `${a.ap} (${a.oameni || '—'} oameni, ${{in_lucru:'În lucru',gata:'Gata',blocat:'Blocat'}[a.stareNoua] || '—'})`).join('<br>');
    const matRows = Object.entries(r.materiale || {}).map(([k, v]) => {
      const m = state.materiale.find(x => x.id === k);
      return m ? `<tr><td>${m.nume}</td><td style="text-align:right">${v.toFixed(1)} ${m.um}</td></tr>` : '';
    }).join('');
    return `
<div class="page">
  <div class="header"><img src="logo.png" class="logo" /><div class="header-text"><div class="company">iFort Systems S.R.L.</div><div class="sub">Detaliu zi — ${fmtDate(r.data)}</div></div></div>
  <div class="info-grid">
    <div><b>Data:</b> ${fmtDate(r.data)}</div>
    <div><b>Program:</b> ${r.oraStart}—${r.oraFinal}</div>
    <div><b>Persoane:</b> ${r.nrPersoane} (${r.nrElectricieni || 0} el.)</div>
    <div><b>Apartamente:</b> ${r.alocari.length}</div>
  </div>
  <h2>Apartamente lucrate</h2>
  <p>${apList}</p>
  <h2>Materiale</h2>
  <table><thead><tr><th>Material</th><th style="text-align:right">Cantitate</th></tr></thead><tbody>${matRows || '<tr><td colspan="2" style="text-align:center">—</td></tr>'}</tbody></table>
</div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titlu}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
.page{background:white;padding:30px;max-width:780px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1);page-break-after:always}
.page:last-child{page-break-after:auto}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px;height:auto}.header-text .company{font-size:22px;font-weight:700;color:#1e40af}.header-text .sub{font-size:13px;color:#6b7280}
h2{font-size:15px;color:#374151;margin-top:22px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse}td,th{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#f3f4f6;text-align:left}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:12px}
.info-grid b{color:#1e40af}.big-stat{font-size:36px;font-weight:700;color:#1e40af}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:1000}
@media print{body{background:white}.page{margin:0;box-shadow:none}.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  <div class="header"><img src="logo.png" class="logo" /><div class="header-text"><div class="company">iFort Systems S.R.L.</div><div class="sub">${titlu} — Arhivă firmă</div></div></div>
  <div class="info-grid">
    <div><b>Interval:</b> ${fmtDate(startISO)} — ${fmtDate(endISO)}</div>
    <div><b>Șantier:</b> ${state.santier}</div>
    <div><b>Zile lucrate:</b> ${rapoarte.length}</div>
    <div><b>Apartamente unice:</b> ${aps.size}</div>
    <div><b>Total persoane-zile:</b> ${totalOameni}</div>
    <div><b>Total electricieni-zile:</b> ${totalElectricieni}</div>
  </div>
  <h2>TOTAL materiale consumate în interval</h2>
  <table><thead><tr><th>Material</th><th style="text-align:right">Total</th></tr></thead><tbody>${totalRows}</tbody></table>
  <h2>Apartamente lucrate</h2>
  <p>${[...aps].join(', ')}</p>
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">Document generat — iFort Systems S.R.L.</div>
</div>
${zilePages}
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

document.getElementById('btnRapSaptamana').addEventListener('click', () => {
  const { start, end } = saptamanaCurenta();
  genereazaPDFInterval(start, end, `Săptămâna ${fmtDate(start)} — ${fmtDate(end)}`);
});
document.getElementById('btnRapLuna').addEventListener('click', () => {
  const { start, end } = lunaCurenta();
  genereazaPDFInterval(start, end, `Luna ${fmtDate(start).slice(3)}`);
});

// ============= KPI EXTINS - GRAFICE =============
function renderProgresBar() {
  const cont = document.getElementById('progresBar');
  if (!cont) return;
  const total = state.apartamente.length;
  const gata = state.apartamente.filter(a => a.stare === 'gata').length;
  const inLucru = state.apartamente.filter(a => a.stare === 'in_lucru').length;
  const procentGata = total ? (gata / total * 100) : 0;
  cont.innerHTML = `
    <div class="progres-info">
      <span>${gata} terminate / ${total} total</span>
      <span>${inLucru} în lucru</span>
    </div>
    <div class="progres-bar-container">
      <div class="progres-bar-fill" style="width:0%">${procentGata.toFixed(0)}%</div>
    </div>
  `;
  setTimeout(() => {
    cont.querySelector('.progres-bar-fill').style.width = procentGata + '%';
  }, 100);
}

function renderDonut() {
  const cont = document.getElementById('donutStare');
  if (!cont) return;
  const total = state.apartamente.length;
  if (total === 0) { cont.innerHTML = '<div class="empty">Adaugă apartamente pentru a vedea diagrama</div>'; return; }
  const stari = {
    gata: { val: state.apartamente.filter(a => a.stare === 'gata').length, color: '#10b981', label: 'Gata' },
    in_lucru: { val: state.apartamente.filter(a => a.stare === 'in_lucru').length, color: '#fbbf24', label: 'În lucru' },
    blocat: { val: state.apartamente.filter(a => a.stare === 'blocat').length, color: '#ef4444', label: 'Blocat' },
    neinceput: { val: state.apartamente.filter(a => !a.stare || a.stare === 'neinceput').length, color: '#d1d5db', label: 'Neînceput' },
  };
  const r = 70, cx = 100, cy = 100;
  let offset = 0;
  const segments = Object.values(stari).map(s => {
    if (s.val === 0) return '';
    const pct = s.val / total;
    const arc = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(offset);
    const y1 = cy + r * Math.sin(offset);
    const x2 = cx + r * Math.cos(offset + arc);
    const y2 = cy + r * Math.sin(offset + arc);
    const large = arc > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    offset += arc;
    return `<path d="${path}" fill="${s.color}" stroke="white" stroke-width="2" />`;
  }).join('');
  const legend = Object.values(stari).filter(s => s.val > 0).map(s =>
    `<div class="donut-legend-item"><div class="donut-legend-color" style="background:${s.color}"></div>${s.label}: ${s.val} (${(s.val / total * 100).toFixed(0)}%)</div>`
  ).join('');
  cont.innerHTML = `
    <svg class="donut-svg" viewBox="0 0 200 200">
      ${segments}
      <circle cx="100" cy="100" r="40" fill="white" />
      <text x="100" y="95" text-anchor="middle" font-size="22" font-weight="700" fill="#1e40af">${total}</text>
      <text x="100" y="115" text-anchor="middle" font-size="11" fill="#6b7280">apart.</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  `;
}

function renderChartConsum7() {
  const cont = document.getElementById('chartConsum7');
  if (!cont) return;
  const azi = new Date();
  const zile = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(azi); d.setDate(azi.getDate() - i);
    zile.push(d.toISOString().slice(0, 10));
  }
  // Top 3 materiale după consum total
  const consumTotal = calculeazaConsumTotal();
  const topMat = Object.entries(consumTotal).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topMat.length === 0) { cont.innerHTML = '<div class="empty">Niciun consum încă</div>'; return; }

  let html = '<div class="bar-chart">';
  zile.forEach(d => {
    const rapZi = state.rapoarte.filter(r => r.data === d);
    topMat.forEach(([matId]) => {
      const m = state.materiale.find(x => x.id === matId);
      if (!m) return;
      const val = rapZi.reduce((s, r) => s + (r.materiale?.[matId] || 0), 0);
      // max pentru scalare
      const maxVal = Math.max(...zile.map(z => {
        const rz = state.rapoarte.filter(r => r.data === z);
        return rz.reduce((s, r) => s + (r.materiale?.[matId] || 0), 0);
      }));
      const pct = maxVal ? (val / maxVal * 100) : 0;
      const dayName = new Date(d).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric' });
      html += `<div class="bar-row"><div class="label">${dayName} - ${m.nume.slice(0, 12)}</div><div class="bar-container"><div class="bar-fill" style="width:0%">${val ? val.toFixed(0) + m.um : ''}</div></div></div>`;
    });
  });
  html += '</div>';
  cont.innerHTML = html;
  // animate fills
  setTimeout(() => {
    const fills = cont.querySelectorAll('.bar-fill');
    const rows = cont.querySelectorAll('.bar-row');
    rows.forEach((row, i) => {
      const labelText = row.querySelector('.label').textContent;
      const matNume = labelText.split(' - ')[1];
      const d = zile[Math.floor(i / topMat.length)];
      const matIdx = i % topMat.length;
      const matId = topMat[matIdx][0];
      const val = state.rapoarte.filter(r => r.data === d).reduce((s, r) => s + (r.materiale?.[matId] || 0), 0);
      const maxVal = Math.max(...zile.map(z => state.rapoarte.filter(r => r.data === z).reduce((s, r) => s + (r.materiale?.[matId] || 0), 0))) || 1;
      fills[i].style.width = (val / maxVal * 100) + '%';
    });
  }, 100);
}

function renderChartDevieri() {
  const cont = document.getElementById('chartDevieri');
  if (!cont) return;
  // Pentru fiecare tip apartament cu normă, compară cu media reală
  const rows = [];
  TIPURI_AP.forEach(tip => {
    if (!state.norme[tip]) return;
    const apsLogged = new Set();
    const matReal = {};
    state.rapoarte.forEach(r => {
      r.alocari.forEach(a => {
        const ap = state.apartamente.find(x => x.cod === a.ap);
        if (ap && ap.tip === tip) {
          apsLogged.add(ap.cod);
          Object.entries(a.materiale || {}).forEach(([k, v]) => {
            matReal[k] = (matReal[k] || 0) + v;
          });
        }
      });
    });
    if (apsLogged.size === 0) return;
    Object.entries(state.norme[tip]).forEach(([matId, norma]) => {
      const m = state.materiale.find(x => x.id === matId);
      if (!m) return;
      const real = (matReal[matId] || 0) / apsLogged.size;
      const dev = norma ? ((real - norma) / norma * 100) : 0;
      rows.push({ tip, mat: m.nume, norma, real, dev });
    });
  });

  if (rows.length === 0) {
    cont.innerHTML = '<div class="empty">Adaugă norme în tab Apartamente pentru a vedea devierile</div>';
    return;
  }

  const maxAbsDev = Math.max(...rows.map(r => Math.abs(r.dev)), 50);
  cont.innerHTML = rows.map(r => {
    const pctWidth = Math.min(Math.abs(r.dev) / maxAbsDev * 50, 50);
    const cls = r.dev >= 0 ? 'plus' : 'minus';
    const sign = r.dev >= 0 ? '+' : '';
    return `<div class="devieri-row">
      <div class="label">${r.tip.slice(0, 6)} - ${r.mat.slice(0, 12)}</div>
      <div class="deviere-bar"><div class="center"></div><div class="fill ${cls}" style="width:0%"></div></div>
      <div class="val ${cls}">${sign}${r.dev.toFixed(0)}%</div>
    </div>`;
  }).join('');
  setTimeout(() => {
    const fills = cont.querySelectorAll('.fill');
    rows.forEach((r, i) => {
      const pctWidth = Math.min(Math.abs(r.dev) / maxAbsDev * 50, 50);
      fills[i].style.width = pctWidth + '%';
    });
  }, 100);
}

// Hook în renderKPI
const _renderKPI_original = renderKPI;
renderKPI = function () {
  _renderKPI_original();
  renderProgresBar();
  renderDonut();
  renderChartConsum7();
  renderChartDevieri();
};

function init() {
  load();
  document.getElementById('data').value = todayISO();
  document.getElementById('numeIntrodus').value = state.utilizator || '';
  renderAll();

  // Service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
