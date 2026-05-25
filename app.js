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
];

let state = {
  rapoarte: [],
  apartamente: [],
  materiale: [...MATERIALE_DEFAULT],
  utilizator: '',
  antreprenor: 'KESZ',
  santier: 'Corallis',
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
    if (btn.dataset.tab === 'apartamente') renderApartamente();
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
