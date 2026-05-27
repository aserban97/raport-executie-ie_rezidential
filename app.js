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
  { id: 'cablu_4x15', nume: 'CYYF 4x1.5', um: 'm' },
  { id: 'dibluri', nume: 'Dibluri', um: 'buc' },
  { id: 'suruburi', nume: 'Șuruburi', um: 'buc' },
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
  muncitori: [], // [{ id, cod, nume, dataStart, dataEnd (null=activ) }]
  prezenta: [], // [{ data, cod, ore }]
  echipe: [], // [{ id, nume, codMembri: ['001','002'], culoare }]
  contorBackup: 0, // câte rapoarte de la ultimul backup auto
};

let raportEditareId = null; // ID raport în editare (null = nou)
let aproEditareId = null; // ID aprovizionare în editare (null = nou)

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
  // Migrare: adaugă materiale default lipsă + actualizează denumirile la cele default
  MATERIALE_DEFAULT.forEach(def => {
    const existing = state.materiale.find(m => m.id === def.id);
    if (!existing) {
      state.materiale.push({ ...def });
    } else {
      // Actualizează denumirea și UM dacă s-au schimbat în default (păstrează istoricul prin ID)
      existing.nume = def.nume;
      existing.um = def.um;
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
    if (btn.dataset.tab === 'personal') renderPersonal();
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

  const echipeOptions = (state.echipe || []).map(e =>
    `<option value="${e.id}">${e.nume}</option>`
  ).join('');

  block.innerHTML = `
    <div class="alocare-head">
      <select class="ap">
        <option value="">— Alege apartament/zonă —</option>
        ${optionsAp}
        <option value="__custom__">+ Alt loc (text liber)</option>
      </select>
      <input type="text" class="ap-custom" placeholder="ex: Ap 47 sau Tablou subsol" ${hasApartamente ? 'hidden' : ''} />
      <input type="number" class="qty-oameni" min="1" max="50" placeholder="Oameni" />
      <select class="echipa-sel">
        <option value="">— Echipă —</option>
        ${echipeOptions}
      </select>
      <select class="stare-noua">
        <option value="">— Stare —</option>
        <option value="in_lucru">În lucru</option>
        <option value="gata">Gata</option>
        <option value="blocat">Blocat</option>
      </select>
      <button type="button" class="btn-del">×</button>
    </div>
    <div class="alocare-materiale">${materialeHTML}</div>
    <div style="margin-top:8px;text-align:right">
      <button type="button" class="btn-secondary btn-sugestii" style="font-size:12px;padding:6px 12px">💡 Sugestii din istoric (pe baza tub)</button>
    </div>
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
  block.querySelector('.btn-sugestii').addEventListener('click', () => aplicaSugestii(block));
  cont.appendChild(block);
}

// Calculează rapoartele aux/tub din istoric
function rapoarteAuxiliarePerTub() {
  let totalTub = 0;
  const totalAux = {};
  state.rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      const tub = a.materiale?.tub20 || 0;
      if (tub <= 0) return;
      totalTub += tub;
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (k === 'tub20') return;
        totalAux[k] = (totalAux[k] || 0) + v;
      });
    });
  });
  if (totalTub === 0) return null;
  const ratios = {};
  Object.entries(totalAux).forEach(([k, v]) => { ratios[k] = v / totalTub; });
  return { totalTub, ratios };
}

function aplicaSugestii(block) {
  const tubInput = block.querySelector('.mat-qty[data-mat="tub20"]');
  const tubVal = parseFloat(tubInput?.value);
  if (!tubVal || tubVal <= 0) {
    toast('Introdu cantitatea de tub mai întâi');
    return;
  }
  const data = rapoarteAuxiliarePerTub();
  if (!data) { toast('Istoric insuficient pentru sugestii'); return; }

  let applied = 0;
  block.querySelectorAll('.mat-qty').forEach(inp => {
    const id = inp.dataset.mat;
    if (id === 'tub20') return;
    const ratio = data.ratios[id];
    if (!ratio || ratio <= 0) return;
    // doar dacă e gol — nu suprascriem ce a pus deja
    if (!inp.value || parseFloat(inp.value) === 0) {
      const sugestie = tubVal * ratio;
      // rotunjire: cote/cleme/manșoane/dibluri/șuruburi la întreg; cabluri la 0.5
      const m = state.materiale.find(x => x.id === id);
      if (m && m.um === 'buc') {
        inp.value = Math.round(sugestie);
      } else {
        inp.value = (Math.round(sugestie * 2) / 2).toFixed(1);
      }
      applied++;
    }
  });
  toast(applied > 0 ? `${applied} sugestii aplicate ✓` : 'Toate câmpurile sunt deja completate');
}

document.getElementById('btnAdaugaAlocare').addEventListener('click', adaugaAlocare);

document.getElementById('formRaport').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = document.getElementById('data').value;
  const nume = document.getElementById('numeIntrodus').value.trim();
  const oraStart = document.getElementById('oraStart').value;
  const oraFinal = document.getElementById('oraFinal').value;
  const nrPersoane = parseInt(document.getElementById('nrPersoane').value, 10);
  const nrSefi = parseInt(document.getElementById('nrSefi').value, 10) || 0;
  const nrElectricieni = parseInt(document.getElementById('nrElectricieni').value, 10) || 0;
  const observatii = document.getElementById('observatii').value.trim();

  const alocari = [];
  document.querySelectorAll('#listaAlocari .alocare-block').forEach(block => {
    let ap = block.querySelector('.ap').value;
    if (ap === '__custom__') ap = block.querySelector('.ap-custom').value.trim();
    const oameni = parseInt(block.querySelector('.qty-oameni').value, 10) || 0;
    const stareNoua = block.querySelector('.stare-noua').value;
    const echipaId = block.querySelector('.echipa-sel')?.value || '';
    const materialeAp = {};
    block.querySelectorAll('.mat-qty').forEach(inp => {
      const v = parseFloat(inp.value);
      if (v > 0) materialeAp[inp.dataset.mat] = v;
    });
    if (ap) alocari.push({ ap, oameni, stareNoua, echipaId, materiale: materialeAp });
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
    id: raportEditareId || uid(), data, utilizator: nume, oraStart, oraFinal,
    nrPersoane, nrSefi, nrElectricieni, alocari, materiale,
    poze: [...pozeCurente], observatii,
    createdAt: raportEditareId ?
      (state.rapoarte.find(x => x.id === raportEditareId)?.createdAt || new Date().toISOString()) :
      new Date().toISOString(),
    updatedAt: raportEditareId ? new Date().toISOString() : undefined,
  };

  if (raportEditareId) {
    state.rapoarte = state.rapoarte.map(r => r.id === raportEditareId ? raport : r);
    raportEditareId = null;
    document.getElementById('formRaport').querySelector('.btn-primary').textContent = 'Salvează raport';
  } else {
    state.rapoarte.unshift(raport);
    state.contorBackup = (state.contorBackup || 0) + 1;
  }
  state.utilizator = nume;

  // Actualizează starea apartamentelor
  alocari.forEach(a => {
    const ap = state.apartamente.find(x => x.cod === a.ap);
    if (ap && a.stareNoua) ap.stare = a.stareNoua;
    else if (ap && !a.stareNoua && ap.stare === 'neinceput') ap.stare = 'in_lucru';
  });

  save();
  // Backup auto la fiecare 10 rapoarte (doar pentru creări noi)
  if (state.contorBackup >= 10) {
    backupAutoJSON();
    state.contorBackup = 0;
    save();
  }
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function incarcaRaportPentruEditare(id) {
  const r = state.rapoarte.find(x => x.id === id);
  if (!r) return;
  raportEditareId = id;
  document.getElementById('data').value = r.data;
  document.getElementById('numeIntrodus').value = r.utilizator || '';
  document.getElementById('oraStart').value = r.oraStart || '07:00';
  document.getElementById('oraFinal').value = r.oraFinal || '17:00';
  document.getElementById('nrPersoane').value = r.nrPersoane || '';
  document.getElementById('nrSefi').value = r.nrSefi || 0;
  document.getElementById('nrElectricieni').value = r.nrElectricieni || '';
  document.getElementById('observatii').value = r.observatii || '';
  pozeCurente = r.poze ? [...r.poze] : [];
  renderPreviewPoze();

  // Reconstruiește alocările
  document.getElementById('listaAlocari').innerHTML = '';
  r.alocari.forEach(a => {
    adaugaAlocare();
    const block = document.querySelectorAll('#listaAlocari .alocare-block');
    const last = block[block.length - 1];
    // setează ap
    const apSelect = last.querySelector('.ap');
    const apCustom = last.querySelector('.ap-custom');
    const matchesOption = Array.from(apSelect.options).some(o => o.value === a.ap);
    if (matchesOption) {
      apSelect.value = a.ap;
    } else {
      apSelect.value = '__custom__';
      apCustom.hidden = false;
      apCustom.value = a.ap;
    }
    last.querySelector('.qty-oameni').value = a.oameni || '';
    last.querySelector('.stare-noua').value = a.stareNoua || '';
    const echSel = last.querySelector('.echipa-sel');
    if (echSel && a.echipaId) echSel.value = a.echipaId;
    // materiale
    Object.entries(a.materiale || {}).forEach(([k, v]) => {
      const inp = last.querySelector(`.mat-qty[data-mat="${k}"]`);
      if (inp) inp.value = v;
    });
  });
  if (r.alocari.length === 0) renderAlocari();

  // Schimbă butonul
  document.getElementById('formRaport').querySelector('.btn-primary').textContent = '💾 Salvează modificările';
  toast(`Editezi raportul din ${fmtDate(r.data)}`);
  // Navighează la tab raport
  document.querySelector('.tab[data-tab="raport"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Backup auto JSON la fiecare 10 rapoarte
function backupAutoJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ifort-backup-auto-${todayISO()}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('💾 Backup automat descărcat (10 rapoarte)');
}

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
  // Ordine cronologică: recent primul (după data raport, nu după când l-am introdus)
  const sortate = state.rapoarte.slice().sort((a, b) => b.data.localeCompare(a.data) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  sortate.slice(0, 30).forEach(r => {
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
        <span class="info">${r.utilizator || '—'} • ${r.nrPersoane}p (${r.nrSefi || 0}s, ${r.nrElectricieni || 0}el) • ${r.oraStart}-${r.oraFinal}</span>
      </div>
      <div class="info"><b>Lucrat:</b> ${apartLista}</div>
      <div class="info"><b>Material:</b> ${matLista || '—'}</div>
      ${r.observatii ? `<div class="info"><b>Obs:</b> ${r.observatii}</div>` : ''}
      <div class="btns">
        <button class="btn-secondary" data-edit="${r.id}">✏️ Editează</button>
        <button class="btn-secondary" data-pdf-ext="${r.id}">📄 Extern</button>
        <button class="btn-secondary" data-pdf-int="${r.id}">🔒 Intern</button>
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
  cont.querySelectorAll('[data-pdf-ext]').forEach(b => b.addEventListener('click', () => {
    const r = state.rapoarte.find(x => x.id === b.dataset.pdfExt);
    if (r) genereazaPDF(r, true);
  }));
  cont.querySelectorAll('[data-pdf-int]').forEach(b => b.addEventListener('click', () => {
    const r = state.rapoarte.find(x => x.id === b.dataset.pdfInt);
    if (r) genereazaPDF(r, false);
  }));
  cont.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    incarcaRaportPentruEditare(b.dataset.edit);
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

function genereazaPDF(r, extern = false) {
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
    ${extern ? '' : `<div><b>Persoane pe șantier:</b> ${r.nrPersoane}</div>
    <div><b>Șefi de echipă:</b> ${r.nrSefi || 0}</div>
    <div><b>Electricieni:</b> ${r.nrElectricieni || 0}</div>`}
    <div><b>Responsabil raport:</b> ${r.utilizator || '—'}</div>
  </div>

  <h2>Apartamente / zone lucrate azi</h2>
  <table>
    <thead><tr><th>Locație</th>${extern ? '' : '<th style="text-align:right">Oameni</th>'}<th style="text-align:right">Stare</th></tr></thead>
    <tbody>
      ${r.alocari.map(a => `<tr><td>${a.ap}</td>${extern ? '' : `<td style="text-align:right">${a.oameni || '—'}</td>`}<td style="text-align:right">${{in_lucru:'În lucru',gata:'Gata',blocat:'Blocat'}[a.stareNoua] || '—'}</td></tr>`).join('')}
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
    ${extern ? '' : `<div><b>Oameni alocați:</b> ${a.oameni || '—'}</div>`}
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

document.getElementById('btnPDFExtern').addEventListener('click', () => {
  if (state.rapoarte.length === 0) { toast('Salvează un raport mai întâi'); return; }
  genereazaPDF(state.rapoarte[0], true);
});
document.getElementById('btnPDFIntern').addEventListener('click', () => {
  if (state.rapoarte.length === 0) { toast('Salvează un raport mai întâi'); return; }
  genereazaPDF(state.rapoarte[0], false);
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
    cell.innerHTML = `${a.cod}<span class="tip">${a.tip}${a.mp ? ` • ${a.mp}mp` : ''}</span>`;
    cell.addEventListener('click', () => {
      const stari = ['neinceput', 'in_lucru', 'gata', 'blocat'];
      const nume = { neinceput: 'Neînceput', in_lucru: 'În lucru', gata: 'Gata', blocat: 'Blocat' };
      const optHTML = stari.map(s => `${s === a.stare ? '→' : '  '} ${nume[s]}`).join('\n');
      const dur = durataApartament(a.cod);
      const durTxt = dur ? `\n📅 Început: ${fmtDate(dur.start)}${dur.end ? `, Finalizat: ${fmtDate(dur.end)}` : ' (în lucru)'}\n⏱️ Durată: ${dur.zile} zile` : '\n(Niciun raport încă)';
      const mpTxt = a.mp ? `\n📐 Suprafață: ${a.mp} mp` : '\n📐 Suprafață: nesetată';
      const r = prompt(`${a.cod} (${a.tip})\nStare curentă: ${nume[a.stare || 'neinceput']}${mpTxt}${durTxt}\n\nIntrodu nr opțiune:\n1. Neînceput\n2. În lucru\n3. Gata\n4. Blocat\n5. Șterge apartament\n6. Editează suprafață (mp)`, '');
      if (!r) return;
      if (r === '5') {
        if (confirm(`Ștergi ${a.cod}?`)) {
          state.apartamente = state.apartamente.filter(x => x.cod !== a.cod);
          save(); renderApartamente();
        }
        return;
      }
      if (r === '6') {
        const sNou = prompt(`Suprafață în mp pentru ${a.cod} (gol = șterge):`, a.mp || '');
        if (sNou === null) return;
        const v = parseFloat(sNou);
        a.mp = (v > 0) ? v : null;
        save(); renderApartamente();
        toast('Suprafață actualizată ✓');
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
  const mp = parseFloat(document.getElementById('suprafataAp').value) || null;
  if (state.apartamente.some(x => x.cod === cod)) { toast('Cod deja existent'); return; }
  state.apartamente.push({ cod, tip, mp, stare: 'neinceput' });
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
    // FIX: folosim materialele reale per alocare, NU distribuție egală
    r.alocari.forEach(a => {
      const ap = state.apartamente.find(x => x.cod === a.ap);
      if (!ap) return;
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (!perTip[ap.tip].mat[k]) perTip[ap.tip].mat[k] = 0;
        perTip[ap.tip].mat[k] += v;
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
  // Default data = azi
  const dataInput = document.getElementById('aproData');
  if (dataInput && !dataInput.value) dataInput.value = todayISO();

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
    // Sortare cronologică: recent primul (după data primirii, nu createdAt)
    const sortate = state.aprovizionari.slice().sort((a, b) => b.data.localeCompare(a.data) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    sortate.forEach(a => {
      const item = document.createElement('div');
      item.className = 'raport-item';
      const matLista = Object.entries(a.materiale).map(([k, v]) => {
        const m = state.materiale.find(x => x.id === k);
        return m ? `${m.nume}: +${v}${m.um}` : '';
      }).filter(Boolean).join(' • ');
      item.innerHTML = `
        <div class="head">
          <strong>${fmtDate(a.data)}</strong>
          <span class="info">${a.nota ? a.nota : ''}</span>
        </div>
        <div class="info">${matLista}</div>
        <div class="btns">
          <button class="btn-secondary" data-edit-apro="${a.id}">✏️ Editează</button>
          <button class="btn-del" data-del="${a.id}">Șterge</button>
        </div>
      `;
      item.querySelector('[data-del]').addEventListener('click', () => {
        if (!confirm('Ștergi aprovizionarea?')) return;
        state.aprovizionari = state.aprovizionari.filter(x => x.id !== a.id);
        save(); renderStoc();
      });
      item.querySelector('[data-edit-apro]').addEventListener('click', () => incarcaAprovizionarePentruEditare(a.id));
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
  const dataApro = document.getElementById('aproData').value || todayISO();
  const nota = document.getElementById('aproNota').value.trim();

  if (aproEditareId) {
    const idx = state.aprovizionari.findIndex(x => x.id === aproEditareId);
    if (idx >= 0) {
      state.aprovizionari[idx] = {
        ...state.aprovizionari[idx],
        data: dataApro, materiale, nota,
        updatedAt: new Date().toISOString(),
      };
    }
    aproEditareId = null;
    document.getElementById('btnAdaugaApro').textContent = '+ Salvează aprovizionare';
    toast('Aprovizionare actualizată ✓');
  } else {
    state.aprovizionari.push({
      id: uid(), data: dataApro, materiale, nota,
      createdAt: new Date().toISOString(),
    });
    toast('Aprovizionare salvată ✓');
  }

  document.getElementById('aproNota').value = '';
  document.getElementById('aproData').value = todayISO();
  document.querySelectorAll('.apro-qty').forEach(i => i.value = '');
  save(); renderStoc();
});

function incarcaAprovizionarePentruEditare(id) {
  const a = state.aprovizionari.find(x => x.id === id);
  if (!a) return;
  aproEditareId = id;
  document.getElementById('aproData').value = a.data;
  document.getElementById('aproNota').value = a.nota || '';
  // Resetează și pune valorile
  document.querySelectorAll('.apro-qty').forEach(inp => {
    const v = a.materiale[inp.dataset.mat];
    inp.value = v ? v : '';
  });
  document.getElementById('btnAdaugaApro').textContent = '💾 Salvează modificările';
  toast(`Editezi aprovizionarea din ${fmtDate(a.data)}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
        const tip = prompt(`${fmtDate(isoData)} — ${rapoarteZi.length} raport(e)\n\nCe PDF vrei?\n1. Extern (pentru antreprenor, fără nr. muncitori)\n2. Intern (pentru firmă, complet)`, '1');
        if (!tip) return;
        const extern = tip === '1';
        if (rapoarteZi.length === 1) genereazaPDF(rapoarteZi[0], extern);
        else genereazaPDFInterval(isoData, isoData, `Raport ${fmtDate(isoData)}`);
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
        <span class="info">${r.nrPersoane}p (${r.nrElectricieni || 0}el)</span>
      </div>
      <div class="info">${apartLista}</div>
      <div class="btns">
        <button class="btn-secondary" data-pdf-ext="${r.id}" style="padding:4px 10px;font-size:12px">📄 Extern</button>
        <button class="btn-secondary" data-pdf-int="${r.id}" style="padding:4px 10px;font-size:12px">🔒 Intern</button>
      </div>
    `;
    item.querySelector('[data-pdf-ext]').addEventListener('click', () => genereazaPDF(r, true));
    item.querySelector('[data-pdf-int]').addEventListener('click', () => genereazaPDF(r, false));
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

// ============= DONUT DISTRIBUȚIE MATERIALE PER TIP =============
function renderDonutMaterialeTip() {
  const cont = document.getElementById('donutMaterialeTip');
  if (!cont) return;

  // grupare materiale per tip apartament (cantități reale)
  const perTip = {};
  state.rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      const ap = state.apartamente.find(x => x.cod === a.ap);
      if (!ap) return;
      if (!perTip[ap.tip]) perTip[ap.tip] = {};
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        perTip[ap.tip][k] = (perTip[ap.tip][k] || 0) + v;
      });
    });
  });

  if (Object.keys(perTip).length === 0) {
    cont.innerHTML = '<div class="empty">Niciun raport încă cu apartamente create</div>';
    return;
  }

  const colors = ['#1e40af', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  let html = '<div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center">';
  Object.entries(perTip).forEach(([tip, mats]) => {
    const total = Object.values(mats).reduce((s, v) => s + v, 0);
    if (total === 0) return;
    const r = 60, cx = 80, cy = 80;
    let offset = -Math.PI / 2;
    let segments = '';
    const legend = [];
    Object.entries(mats).forEach(([matId, val], i) => {
      const m = state.materiale.find(x => x.id === matId);
      if (!m || val === 0) return;
      const pct = val / total;
      const arc = pct * 2 * Math.PI;
      const x1 = cx + r * Math.cos(offset);
      const y1 = cy + r * Math.sin(offset);
      const x2 = cx + r * Math.cos(offset + arc);
      const y2 = cy + r * Math.sin(offset + arc);
      const large = arc > Math.PI ? 1 : 0;
      const color = colors[i % colors.length];
      segments += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${color}" stroke="white" stroke-width="2" />`;
      legend.push(`<div class="donut-legend-item"><div class="donut-legend-color" style="background:${color}"></div>${m.nume}: ${val.toFixed(0)}${m.um} (${(pct * 100).toFixed(0)}%)</div>`);
      offset += arc;
    });

    html += `<div style="text-align:center;min-width:220px">
      <div style="font-weight:600;color:#1e40af;margin-bottom:6px">${tip}</div>
      <svg width="160" height="160" viewBox="0 0 160 160">${segments}<circle cx="80" cy="80" r="30" fill="white" /></svg>
      <div class="donut-legend" style="margin-left:0;font-size:11px;text-align:left">${legend.join('')}</div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

// ============= DURATĂ MEDIE EXECUȚIE PER TIP =============
function calculeazaDurateApartamente() {
  // Pentru fiecare apartament: când a fost prima dată "în lucru" și prima dată "gata"
  const istoric = {}; // cod -> [{ data, stare }]
  state.rapoarte.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(r => {
    r.alocari.forEach(a => {
      if (!a.stareNoua) return;
      if (!istoric[a.ap]) istoric[a.ap] = [];
      istoric[a.ap].push({ data: r.data, stare: a.stareNoua });
    });
  });

  const durate = {}; // cod -> { tip, zile }
  Object.entries(istoric).forEach(([cod, evenimente]) => {
    const ap = state.apartamente.find(x => x.cod === cod);
    if (!ap || ap.stare !== 'gata') return; // doar apartamente "Gata"
    const start = evenimente.find(e => e.stare === 'in_lucru');
    const end = evenimente.slice().reverse().find(e => e.stare === 'gata');
    if (!start || !end) return;
    const d1 = new Date(start.data), d2 = new Date(end.data);
    const zile = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
    durate[cod] = { tip: ap.tip, zile };
  });
  return durate;
}

function renderDurataPerTip() {
  const cont = document.getElementById('durataPerTip');
  if (!cont) return;
  const durate = calculeazaDurateApartamente();
  const perTip = {};
  Object.values(durate).forEach(d => {
    if (!perTip[d.tip]) perTip[d.tip] = [];
    perTip[d.tip].push(d.zile);
  });

  if (Object.keys(perTip).length === 0) {
    cont.innerHTML = '<div class="empty">Niciun apartament finalizat încă (marchează "Gata" în Apartamente)</div>';
    return;
  }

  const maxMedia = Math.max(...Object.values(perTip).map(zile => zile.reduce((a, b) => a + b, 0) / zile.length), 1);

  let html = '<div class="bar-chart">';
  TIPURI_AP.forEach(tip => {
    if (!perTip[tip]) return;
    const zile = perTip[tip];
    const media = zile.reduce((a, b) => a + b, 0) / zile.length;
    const pct = (media / maxMedia) * 100;
    html += `<div class="bar-row">
      <div class="label">${tip}</div>
      <div class="bar-container"><div class="bar-fill" style="width:0%;background:#10b981">${media.toFixed(1)} zile (${zile.length} ap)</div></div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;

  setTimeout(() => {
    const fills = cont.querySelectorAll('.bar-fill');
    let idx = 0;
    TIPURI_AP.forEach(tip => {
      if (!perTip[tip]) return;
      const zile = perTip[tip];
      const media = zile.reduce((a, b) => a + b, 0) / zile.length;
      fills[idx].style.width = ((media / maxMedia) * 100) + '%';
      idx++;
    });
  }, 100);
}

// ============= PREDICȚIE PROIECT =============
function renderPredictieProiect() {
  const cont = document.getElementById('predictieProiect');
  if (!cont) return;
  const durate = calculeazaDurateApartamente();
  const perTip = {};
  Object.values(durate).forEach(d => {
    if (!perTip[d.tip]) perTip[d.tip] = [];
    perTip[d.tip].push(d.zile);
  });

  // Apartamente rămase (neînceput + în lucru)
  const ramaseTip = {};
  state.apartamente.forEach(ap => {
    if (ap.stare !== 'gata') {
      ramaseTip[ap.tip] = (ramaseTip[ap.tip] || 0) + 1;
    }
  });

  if (Object.keys(ramaseTip).length === 0) {
    cont.innerHTML = '<div class="empty">Niciun apartament în execuție</div>';
    return;
  }
  if (Object.keys(perTip).length === 0) {
    cont.innerHTML = '<div class="empty">Marchează măcar 1 apartament "Gata" ca să pot estima</div>';
    return;
  }

  // Calcul ritm: media om-zile/apartament terminat, raport la electricieni medii pe șantier
  const totalElZile = state.rapoarte.reduce((s, r) => s + (r.nrElectricieni || 0), 0);
  const totalApFinalizate = Object.keys(durate).length;
  const omZilePerAp = totalElZile / (totalApFinalizate || 1);
  const electricieniMedii = state.rapoarte.length ? totalElZile / state.rapoarte.length : 1;

  let zileRamase = 0;
  let detaliuRows = '';
  Object.entries(ramaseTip).forEach(([tip, n]) => {
    const mediaTipo = perTip[tip] ? perTip[tip].reduce((a, b) => a + b, 0) / perTip[tip].length : null;
    const mediaGlobala = Object.values(durate).reduce((a, b) => a + b.zile, 0) / totalApFinalizate;
    const media = mediaTipo || mediaGlobala;
    const zile = n * media;
    zileRamase += zile;
    detaliuRows += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #f3f4f6"><span>${tip} × ${n} ap</span><span style="font-weight:600">${zile.toFixed(0)} zile-apartament</span></div>`;
  });

  // ajustare: dacă lucrăm pe mai multe apartamente simultan
  const apartParalele = Math.max(1, Math.round(electricieniMedii / 2)); // 2 electricieni/apartament estimat
  const zileCalendaristice = Math.ceil(zileRamase / apartParalele);
  const luniCalendaristice = (zileCalendaristice / 22).toFixed(1); // 22 zile lucratoare/luna

  cont.innerHTML = `
    <div style="text-align:center;padding:14px 0">
      <div class="big-stat" style="font-size:36px;font-weight:700;color:#1e40af">${zileCalendaristice} zile</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">≈ ${luniCalendaristice} luni lucrătoare</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:6px">la ritmul actual de ~${electricieniMedii.toFixed(1)} electricieni/zi pe ${apartParalele} ap. în paralel</div>
    </div>
    <details style="margin-top:10px">
      <summary>Detaliu calcul</summary>
      ${detaliuRows}
      <div style="font-size:11px;color:#9ca3af;margin-top:8px">Estimarea se calibrează automat pe măsură ce marchezi apartamente "Gata".</div>
    </details>
  `;
}

// ============= PERSONAL / PONTAJ =============
function renderPersonal() {
  // Pontaj data default = azi
  const pontajData = document.getElementById('pontajData');
  if (!pontajData.value) pontajData.value = todayISO();

  // Sumar lună default
  const sumarLuna = document.getElementById('sumarLuna');
  if (!sumarLuna.value) {
    const d = new Date();
    sumarLuna.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  renderListaMuncitoriPrezenta();
  renderMuncitoriActivi();
  renderMuncitoriIstoric();
  renderSumarPrezenta();
  renderEchipe();

  // Start date default azi
  const startInput = document.getElementById('muncitorStart');
  if (!startInput.value) startInput.value = todayISO();
}

function muncitoriiActiviLaData(dataISO) {
  return state.muncitori.filter(m =>
    m.dataStart <= dataISO && (!m.dataEnd || m.dataEnd >= dataISO)
  );
}

function renderListaMuncitoriPrezenta() {
  const cont = document.getElementById('listaMuncitoriPrezenta');
  const data = document.getElementById('pontajData').value || todayISO();
  const activi = muncitoriiActiviLaData(data);
  const prezentaZi = state.prezenta.filter(p => p.data === data);

  if (activi.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun muncitor activ în această dată. Adaugă mai jos.</div>';
    return;
  }

  let html = '<div style="margin-top:10px">';
  activi.forEach(m => {
    const p = prezentaZi.find(x => x.cod === m.cod);
    const ore = p ? p.ore : '';
    html += `<div class="apro-row" data-cod="${m.cod}">
      <span class="nume"><b>${m.cod}</b> — ${m.nume}</span>
      <input type="number" class="pontaj-ore" data-cod="${m.cod}" min="0" max="16" step="0.5" placeholder="ore" value="${ore}" style="max-width:90px" />
      <span class="um">ore</span>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

document.getElementById('pontajData').addEventListener('change', renderListaMuncitoriPrezenta);

document.getElementById('btnSavePontaj').addEventListener('click', () => {
  const data = document.getElementById('pontajData').value || todayISO();
  // Șterge prezența veche pentru data asta
  state.prezenta = state.prezenta.filter(p => p.data !== data);
  // Adaugă nouă
  document.querySelectorAll('.pontaj-ore').forEach(inp => {
    const ore = parseFloat(inp.value);
    if (ore > 0) {
      state.prezenta.push({ data, cod: inp.dataset.cod, ore });
    }
  });
  save();
  toast(`Pontaj salvat pentru ${fmtDate(data)} ✓`);
  renderSumarPrezenta();
});

function renderMuncitoriActivi() {
  const cont = document.getElementById('muncitoriActivi');
  const azi = todayISO();
  const activi = state.muncitori.filter(m => !m.dataEnd || m.dataEnd >= azi);
  if (activi.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun muncitor activ. Adaugă mai sus.</div>';
    return;
  }
  cont.innerHTML = activi.map(m => `
    <div class="raport-item">
      <div class="head">
        <strong>${m.cod} — ${m.nume}</strong>
        <span class="info">început: ${fmtDate(m.dataStart)}</span>
      </div>
      <div class="btns">
        <button class="btn-secondary" data-end="${m.id}">📅 Marcheaza plecat</button>
        <button class="btn-del" data-del-m="${m.id}">Șterge</button>
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => {
    const m = state.muncitori.find(x => x.id === b.dataset.end);
    if (!m) return;
    const data = prompt(`Data plecării pentru ${m.cod} — ${m.nume} (YYYY-MM-DD):`, todayISO());
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    m.dataEnd = data;
    save(); renderPersonal();
    toast('Marcat ca plecat ✓');
  }));
  cont.querySelectorAll('[data-del-m]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Șterge muncitorul DEFINITIV? Istoricul prezenței rămâne.')) return;
    state.muncitori = state.muncitori.filter(x => x.id !== b.dataset.delM);
    save(); renderPersonal();
  }));
}

function renderMuncitoriIstoric() {
  const cont = document.getElementById('muncitoriIstoric');
  const azi = todayISO();
  const istoric = state.muncitori.filter(m => m.dataEnd && m.dataEnd < azi);
  if (istoric.length === 0) {
    cont.innerHTML = '<div class="empty">Nimeni în istoric</div>';
    return;
  }
  cont.innerHTML = istoric.map(m => `
    <div class="raport-item">
      <div class="head">
        <strong>${m.cod} — ${m.nume}</strong>
        <span class="info">${fmtDate(m.dataStart)} → ${fmtDate(m.dataEnd)}</span>
      </div>
    </div>
  `).join('');
}

document.getElementById('formMuncitor').addEventListener('submit', (e) => {
  e.preventDefault();
  const cod = document.getElementById('muncitorCod').value.trim();
  const nume = document.getElementById('muncitorNume').value.trim();
  const dataStart = document.getElementById('muncitorStart').value;
  const dataEnd = document.getElementById('muncitorEnd').value || null;
  if (state.muncitori.some(m => m.cod === cod && (!m.dataEnd))) {
    toast('Cod deja folosit de un muncitor activ');
    return;
  }
  state.muncitori.push({ id: uid(), cod, nume, dataStart, dataEnd });
  save(); renderPersonal();
  e.target.reset();
  document.getElementById('muncitorStart').value = todayISO();
  toast('Muncitor adăugat ✓');
});

function renderSumarPrezenta() {
  const cont = document.getElementById('sumarPrezenta');
  const luna = document.getElementById('sumarLuna').value;
  if (!luna) { cont.innerHTML = ''; return; }
  const start = `${luna}-01`;
  const [an, lunaNr] = luna.split('-').map(Number);
  const ultimaZi = new Date(an, lunaNr, 0).getDate();
  const end = `${luna}-${String(ultimaZi).padStart(2, '0')}`;

  // Strângem ore per muncitor în lună
  const oreLuna = {};
  state.prezenta.filter(p => p.data >= start && p.data <= end).forEach(p => {
    oreLuna[p.cod] = (oreLuna[p.cod] || 0) + p.ore;
  });

  // Toți muncitorii activi măcar 1 zi în lună (dataStart <= end și (dataEnd >= start sau dataEnd null))
  const muncitoriLuna = state.muncitori.filter(m =>
    m.dataStart <= end && (!m.dataEnd || m.dataEnd >= start)
  );

  if (muncitoriLuna.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun muncitor în această lună</div>';
    return;
  }

  let totalOre = 0;
  let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb">Cod</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb">Nume</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb">Ore</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb">Zile</th></tr></thead><tbody>';
  muncitoriLuna.sort((a, b) => a.cod.localeCompare(b.cod)).forEach(m => {
    const ore = oreLuna[m.cod] || 0;
    const zile = state.prezenta.filter(p => p.cod === m.cod && p.data >= start && p.data <= end).length;
    totalOre += ore;
    html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6"><b>${m.cod}</b></td><td style="padding:8px;border-bottom:1px solid #f3f4f6">${m.nume}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${ore.toFixed(1)}h</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${zile}</td></tr>`;
  });
  html += `<tr><td colspan="2" style="padding:8px;text-align:right;font-weight:700">TOTAL</td><td style="text-align:right;padding:8px;font-weight:700;color:#1e40af">${totalOre.toFixed(1)}h</td><td></td></tr>`;
  html += '</tbody></table>';
  cont.innerHTML = html;
}

document.getElementById('sumarLuna').addEventListener('change', renderSumarPrezenta);

document.getElementById('btnExportPrezenta').addEventListener('click', () => {
  const luna = document.getElementById('sumarLuna').value;
  if (!luna) { toast('Selectează o lună'); return; }
  const start = `${luna}-01`;
  const [an, lunaNr] = luna.split('-').map(Number);
  const ultimaZi = new Date(an, lunaNr, 0).getDate();
  const end = `${luna}-${String(ultimaZi).padStart(2, '0')}`;

  const oreLuna = {};
  const zileLuna = {};
  state.prezenta.filter(p => p.data >= start && p.data <= end).forEach(p => {
    oreLuna[p.cod] = (oreLuna[p.cod] || 0) + p.ore;
    if (!zileLuna[p.cod]) zileLuna[p.cod] = new Set();
    zileLuna[p.cod].add(p.data);
  });
  const muncitoriLuna = state.muncitori.filter(m =>
    m.dataStart <= end && (!m.dataEnd || m.dataEnd >= start)
  );

  let totalOre = 0;
  const rows = muncitoriLuna.sort((a, b) => a.cod.localeCompare(b.cod)).map(m => {
    const ore = oreLuna[m.cod] || 0;
    const zile = zileLuna[m.cod] ? zileLuna[m.cod].size : 0;
    totalOre += ore;
    return `<tr><td><b>${m.cod}</b></td><td>${m.nume}</td><td style="text-align:right">${ore.toFixed(1)}</td><td style="text-align:right">${zile}</td></tr>`;
  }).join('');

  const lunaNume = new Date(an, lunaNr - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pontaj ${lunaNume}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
.page{background:white;padding:30px;max-width:780px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px}.header-text .company{font-size:22px;font-weight:700;color:#1e40af}.header-text .sub{font-size:13px;color:#6b7280}
h2{font-size:15px;color:#374151;margin-top:22px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse}td,th{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#f3f4f6;text-align:left}
.total{font-weight:700;background:#f9fafb}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer}
@media print{body{background:white}.page{margin:0;box-shadow:none}.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  <div class="header"><img src="logo.png" class="logo" /><div class="header-text"><div class="company">iFort Systems S.R.L.</div><div class="sub">Pontaj — ${lunaNume} (intern, arhivă firmă)</div></div></div>
  <h2>Sumar prezență</h2>
  <table><thead><tr><th>Cod</th><th>Nume</th><th style="text-align:right">Ore</th><th style="text-align:right">Zile</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">${totalOre.toFixed(1)}h</td><td></td></tr></tbody></table>
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">Document generat — iFort Systems S.R.L.</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
});

// ============= ECHIPE =============
function renderEchipe() {
  // Populează selectul de membri
  const azi = todayISO();
  const activi = state.muncitori.filter(m => !m.dataEnd || m.dataEnd >= azi);
  const sel = document.getElementById('echipaMembri');
  sel.innerHTML = activi.map(m => `<option value="${m.cod}">${m.cod} — ${m.nume}</option>`).join('');

  const lista = document.getElementById('listaEchipe');
  if (state.echipe.length === 0) {
    lista.innerHTML = '<div class="empty">Niciuna creată încă</div>';
    return;
  }
  lista.innerHTML = state.echipe.map(e => {
    const membri = e.codMembri.map(c => {
      const m = state.muncitori.find(x => x.cod === c);
      return m ? `${c} ${m.nume}` : c;
    }).join(', ');
    return `<div class="raport-item">
      <div class="head">
        <strong style="color:${e.culoare}">● ${e.nume}</strong>
        <span class="info">${e.codMembri.length} membri</span>
      </div>
      <div class="info">${membri}</div>
      <div class="btns">
        <button class="btn-secondary" data-edit-ech="${e.id}">✏️ Editează</button>
        <button class="btn-del" data-del-ech="${e.id}">Șterge</button>
      </div>
    </div>`;
  }).join('');

  lista.querySelectorAll('[data-del-ech]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Ștergi echipa? Nu afectează rapoartele deja salvate.')) return;
    state.echipe = state.echipe.filter(x => x.id !== b.dataset.delEch);
    save(); renderEchipe();
  }));
  lista.querySelectorAll('[data-edit-ech]').forEach(b => b.addEventListener('click', () => {
    const e = state.echipe.find(x => x.id === b.dataset.editEch);
    if (!e) return;
    document.getElementById('echipaNume').value = e.nume;
    document.getElementById('echipaCuloare').value = e.culoare || '#1e40af';
    const sel = document.getElementById('echipaMembri');
    Array.from(sel.options).forEach(o => o.selected = e.codMembri.includes(o.value));
    document.getElementById('formEchipa').dataset.editId = e.id;
    document.getElementById('formEchipa').querySelector('button[type="submit"]').textContent = '💾 Salvează modificările';
    toast(`Editezi ${e.nume}`);
  }));
}

document.getElementById('formEchipa').addEventListener('submit', (e) => {
  e.preventDefault();
  const nume = document.getElementById('echipaNume').value.trim();
  const culoare = document.getElementById('echipaCuloare').value;
  const sel = document.getElementById('echipaMembri');
  const codMembri = Array.from(sel.selectedOptions).map(o => o.value);
  if (codMembri.length === 0) { toast('Selectează cel puțin un muncitor'); return; }

  const editId = e.target.dataset.editId;
  if (editId) {
    const idx = state.echipe.findIndex(x => x.id === editId);
    if (idx >= 0) state.echipe[idx] = { ...state.echipe[idx], nume, culoare, codMembri };
    delete e.target.dataset.editId;
    e.target.querySelector('button[type="submit"]').textContent = 'Salvează echipă';
  } else {
    state.echipe.push({ id: uid(), nume, culoare, codMembri });
  }
  save(); renderEchipe();
  e.target.reset();
  document.getElementById('echipaCuloare').value = '#1e40af';
  toast('Echipă salvată ✓');
});

// ============= PRODUCTIVITATE PER ELECTRICIAN-ZI =============
function renderProductivitate() {
  const cont = document.getElementById('productivitateGrid');
  if (!cont) return;
  if (state.rapoarte.length === 0) {
    cont.innerHTML = '<div class="empty">Niciun raport încă</div>';
    return;
  }

  // Calcul global (toată perioada)
  const totalGlobal = {};
  let elZileGlobal = 0;
  state.rapoarte.forEach(r => {
    elZileGlobal += r.nrElectricieni || 0;
    Object.entries(r.materiale || {}).forEach(([k, v]) => {
      totalGlobal[k] = (totalGlobal[k] || 0) + v;
    });
  });

  // Calcul recent (ultimele 7 zile calendaristice de la ultima zi raportată)
  const dateRapoarte = state.rapoarte.map(r => r.data).sort();
  const ultimaZi = dateRapoarte[dateRapoarte.length - 1];
  const d7 = new Date(ultimaZi); d7.setDate(d7.getDate() - 6);
  const start7 = d7.toISOString().slice(0, 10);

  const totalRecent = {};
  let elZileRecent = 0;
  state.rapoarte.filter(r => r.data >= start7).forEach(r => {
    elZileRecent += r.nrElectricieni || 0;
    Object.entries(r.materiale || {}).forEach(([k, v]) => {
      totalRecent[k] = (totalRecent[k] || 0) + v;
    });
  });

  // Construim cardurile (doar materialele cu consum)
  let html = '<div class="prod-grid">';
  let nCarduri = 0;
  state.materiale.forEach(m => {
    const totG = totalGlobal[m.id] || 0;
    const totR = totalRecent[m.id] || 0;
    if (totG === 0) return;
    const mediaG = elZileGlobal ? totG / elZileGlobal : 0;
    const mediaR = elZileRecent ? totR / elZileRecent : 0;
    // trend %
    let trendCls = 'eq', trendArrow = '→', trendVal = '';
    if (mediaG > 0 && mediaR > 0) {
      const diff = ((mediaR - mediaG) / mediaG) * 100;
      if (Math.abs(diff) < 5) { trendCls = 'eq'; trendArrow = '→'; trendVal = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`; }
      else if (diff > 0) { trendCls = 'up'; trendArrow = '↑'; trendVal = `+${diff.toFixed(0)}%`; }
      else { trendCls = 'down'; trendArrow = '↓'; trendVal = `${diff.toFixed(0)}%`; }
    }
    html += `<div class="prod-card">
      <div class="nume">${m.nume}</div>
      <div><span class="val-mare">${mediaG.toFixed(1)}</span><span class="um">${m.um}/el/zi</span></div>
      <div class="recent">
        <span>Ultimele 7 zile: ${mediaR.toFixed(1)} ${m.um}</span>
        <span class="trend ${trendCls}">${trendArrow} ${trendVal}</span>
      </div>
    </div>`;
    nCarduri++;
  });
  html += '</div>';

  if (nCarduri === 0) {
    cont.innerHTML = '<div class="empty">Niciun consum încă</div>';
  } else {
    cont.innerHTML = html;
  }
}

// ============= RAPORTURI AUXILIARE (KPI) =============
function renderRapoarteAuxiliare() {
  const cont = document.getElementById('rapoarteAuxiliare');
  if (!cont) return;
  const data = rapoarteAuxiliarePerTub();
  if (!data) {
    cont.innerHTML = '<div class="empty">Niciun consum cu tub încă</div>';
    return;
  }
  const tub20 = state.materiale.find(m => m.id === 'tub20');
  let html = `<div class="small" style="margin-bottom:8px">Bază calcul: <b>${data.totalTub.toFixed(0)} m</b> tub rigid 20mm consumat istoric</div>`;
  html += '<div class="prod-grid">';
  const ordineMat = ['cot20', 'clema20', 'manson20', 'dibluri', 'suruburi'];
  ordineMat.forEach(id => {
    const m = state.materiale.find(x => x.id === id);
    if (!m) return;
    const ratio = data.ratios[id] || 0;
    const perM = ratio;
    const ex100m = ratio * 100;
    html += `<div class="prod-card">
      <div class="nume">${m.nume}</div>
      <div><span class="val-mare">${perM.toFixed(2)}</span><span class="um">${m.um}/m tub</span></div>
      <div class="recent">
        <span>La 100m tub: <b>${Math.round(ex100m)} ${m.um}</b></span>
      </div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

// ============= PRODUCTIVITATE PER ECHIPĂ =============
function renderProductivitateEchipe() {
  const cont = document.getElementById('productivitateEchipe');
  if (!cont) return;
  if (state.echipe.length === 0) {
    cont.innerHTML = '<div class="empty">Definește echipe în tab Personal</div>';
    return;
  }
  // pentru fiecare echipă: m tub / zi-lucrare, m CYYF / zi-lucrare, ap finalizate
  const perEchipa = {};
  state.echipe.forEach(e => {
    perEchipa[e.id] = { nume: e.nume, culoare: e.culoare, zile: new Set(), apsGata: new Set(), apsInLucru: new Set(), mat: {} };
  });
  state.rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      if (!a.echipaId || !perEchipa[a.echipaId]) return;
      perEchipa[a.echipaId].zile.add(r.data);
      if (a.stareNoua === 'gata') perEchipa[a.echipaId].apsGata.add(a.ap);
      perEchipa[a.echipaId].apsInLucru.add(a.ap);
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        perEchipa[a.echipaId].mat[k] = (perEchipa[a.echipaId].mat[k] || 0) + v;
      });
    });
  });

  const haveData = Object.values(perEchipa).some(e => e.zile.size > 0);
  if (!haveData) {
    cont.innerHTML = '<div class="empty">Atribuie echipe în rapoarte (Raport zilnic → alocare apartament)</div>';
    return;
  }

  let html = '<div class="prod-grid">';
  Object.values(perEchipa).forEach(e => {
    if (e.zile.size === 0) return;
    const zile = e.zile.size;
    const tub = e.mat.tub20 || 0;
    const cyyf = (e.mat.cyyf15 || 0) + (e.mat.cyyf25 || 0) + (e.mat.cyyf4 || 0) + (e.mat.cablu_4x15 || 0);
    html += `<div class="prod-card" style="border-left-color:${e.culoare}">
      <div class="nume" style="color:${e.culoare}">● ${e.nume}</div>
      <div><span class="val-mare">${(tub / zile).toFixed(1)}</span><span class="um">m tub/zi</span></div>
      <div class="recent">
        <span>Cablu: ${(cyyf / zile).toFixed(1)} m/zi</span>
        <span style="font-weight:600">${e.apsGata.size} ap. gata</span>
      </div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

// ============= ALERTE STOC =============
function renderAlerteStoc() {
  const cont = document.getElementById('alerteStoc');
  if (!cont) return;
  const consum = calculeazaConsumTotal();
  const aprovizionat = calculeazaAprovizionatTotal();

  // Ritm consum: cantitate / zile lucrate ultima săptămână per material
  const ultimaZi = state.rapoarte.length ? state.rapoarte.map(r => r.data).sort().slice(-1)[0] : todayISO();
  const d7 = new Date(ultimaZi); d7.setDate(d7.getDate() - 6);
  const start7 = d7.toISOString().slice(0, 10);
  const consum7 = {};
  state.rapoarte.filter(r => r.data >= start7).forEach(r => {
    Object.entries(r.materiale || {}).forEach(([k, v]) => { consum7[k] = (consum7[k] || 0) + v; });
  });

  const alerte = [];
  // ultima aprovizionare per material
  const ultimaAproPerMat = {};
  state.aprovizionari.forEach(a => {
    Object.keys(a.materiale).forEach(k => {
      if (!ultimaAproPerMat[k] || a.data > ultimaAproPerMat[k]) ultimaAproPerMat[k] = a.data;
    });
  });

  state.materiale.forEach(m => {
    const stoc = (aprovizionat[m.id] || 0) - (consum[m.id] || 0);
    const ritm = (consum7[m.id] || 0) / 7;

    // Alertă 1: lipsă aprovizionări dar consum exista
    if ((consum[m.id] || 0) > 0 && !aprovizionat[m.id]) {
      alerte.push({ tip: 'lipsa_apro', mat: m, mesaj: `Ai consumat ${(consum[m.id]).toFixed(1)}${m.um} dar nu ai înregistrat nicio aprovizionare. Verifică stocul!` });
    }
    // Alertă 2: stoc scăzut
    if (stoc > 0 && ritm > 0) {
      const zileRamase = stoc / ritm;
      if (zileRamase < 3) {
        alerte.push({ tip: 'urgent', mat: m, mesaj: `🔴 SE TERMINĂ în ${zileRamase.toFixed(1)} zile (${stoc.toFixed(1)}${m.um} stoc, ritm ${ritm.toFixed(1)}${m.um}/zi)` });
      } else if (zileRamase < 7) {
        alerte.push({ tip: 'avertisment', mat: m, mesaj: `🟡 Atenție: stocul ajunge ~${zileRamase.toFixed(0)} zile (${stoc.toFixed(1)}${m.um})` });
      }
    }
    // Alertă 3: stoc negativ (consumat mai mult decât aprovizionat)
    if (stoc < 0) {
      alerte.push({ tip: 'lipsa_apro', mat: m, mesaj: `⚠️ Stoc negativ: ${stoc.toFixed(1)}${m.um}. Probabil n-ai introdus o aprovizionare.` });
    }
  });

  if (alerte.length === 0) {
    cont.innerHTML = '<div style="text-align:center;padding:14px;color:#10b981;font-weight:600">✅ Niciun risc detectat</div>';
    return;
  }

  cont.innerHTML = alerte.map(a => {
    const bg = a.tip === 'urgent' ? '#fee2e2' : (a.tip === 'avertisment' ? '#fef3c7' : '#dbeafe');
    const colorTxt = a.tip === 'urgent' ? '#991b1b' : (a.tip === 'avertisment' ? '#92400e' : '#1e40af');
    return `<div style="background:${bg};color:${colorTxt};padding:10px 12px;border-radius:6px;margin-bottom:6px;font-size:13px">
      <b>${a.mat.nume}</b><br>${a.mesaj}
    </div>`;
  }).join('');
}

// ============= DURATĂ REALĂ PER APARTAMENT (în tab Apartamente, info popup) =============
function durataApartament(cod) {
  const evenimente = [];
  state.rapoarte.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(r => {
    r.alocari.forEach(a => {
      if (a.ap === cod) evenimente.push({ data: r.data, stare: a.stareNoua });
    });
  });
  if (evenimente.length === 0) return null;
  const start = evenimente[0].data;
  const ap = state.apartamente.find(x => x.cod === cod);
  if (!ap) return null;
  if (ap.stare === 'gata') {
    const end = evenimente.slice().reverse().find(e => e.stare === 'gata');
    if (end) {
      const zile = Math.max(1, Math.round((new Date(end.data) - new Date(start)) / 86400000) + 1);
      return { start, end: end.data, zile, status: 'finalizat' };
    }
  }
  const azi = todayISO();
  const zile = Math.max(1, Math.round((new Date(azi) - new Date(start)) / 86400000) + 1);
  return { start, end: null, zile, status: 'in_lucru' };
}

// ============= KPI NOI v15 =============

function sumPerData() {
  // returnează { 'YYYY-MM-DD': { tub, cablu, oameni, electricieni, sefi, ap } }
  const perData = {};
  state.rapoarte.forEach(r => {
    if (!perData[r.data]) perData[r.data] = { tub: 0, cablu: 0, oameni: 0, electricieni: 0, sefi: 0, ap: new Set(), apGata: new Set() };
    perData[r.data].oameni += r.nrPersoane || 0;
    perData[r.data].electricieni += r.nrElectricieni || 0;
    perData[r.data].sefi += r.nrSefi || 0;
    r.alocari.forEach(a => {
      perData[r.data].ap.add(a.ap);
      if (a.stareNoua === 'gata') perData[r.data].apGata.add(a.ap);
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (k === 'tub20') perData[r.data].tub += v;
        else if (k.startsWith('cyyf') || k === 'cablu_4x15') perData[r.data].cablu += v;
      });
    });
  });
  return perData;
}

function renderCifreCheie() {
  const cont = document.getElementById('cardCheie');
  if (!cont) return;
  const per = sumPerData();
  const datesSorted = Object.keys(per).sort();
  if (datesSorted.length === 0) { cont.innerHTML = '<div class="empty">Niciun raport încă</div>'; return; }

  const ultima = datesSorted[datesSorted.length - 1];
  const penultima = datesSorted.length >= 2 ? datesSorted[datesSorted.length - 2] : null;
  const z1 = per[ultima];
  const z0 = penultima ? per[penultima] : null;

  function arrow(curr, prev) {
    if (!prev || prev === 0) return '';
    const d = ((curr - prev) / prev * 100);
    if (Math.abs(d) < 1) return ' <span style="color:#6b7280">→ 0%</span>';
    if (d > 0) return ` <span style="color:#10b981">↑ +${d.toFixed(0)}%</span>`;
    return ` <span style="color:#dc2626">↓ ${d.toFixed(0)}%</span>`;
  }

  cont.innerHTML = `
    <div class="prod-grid">
      <div class="prod-card" style="border-left-color:#1e40af">
        <div class="nume">Tub 20mm — ${fmtDate(ultima)}</div>
        <div><span class="val-mare">${z1.tub.toFixed(0)}</span><span class="um">m</span></div>
        <div class="recent">
          <span>Ieri: ${z0 ? z0.tub.toFixed(0) + 'm' : '—'}</span>
          <span>${arrow(z1.tub, z0?.tub)}</span>
        </div>
      </div>
      <div class="prod-card" style="border-left-color:#10b981">
        <div class="nume">Cabluri (toate) — ${fmtDate(ultima)}</div>
        <div><span class="val-mare">${z1.cablu.toFixed(0)}</span><span class="um">m</span></div>
        <div class="recent">
          <span>Ieri: ${z0 ? z0.cablu.toFixed(0) + 'm' : '—'}</span>
          <span>${arrow(z1.cablu, z0?.cablu)}</span>
        </div>
      </div>
      <div class="prod-card" style="border-left-color:#f59e0b">
        <div class="nume">Electricieni</div>
        <div><span class="val-mare">${z1.electricieni}</span><span class="um">oameni</span></div>
        <div class="recent">
          <span>Ieri: ${z0 ? z0.electricieni : '—'}</span>
          <span>${arrow(z1.electricieni, z0?.electricieni)}</span>
        </div>
      </div>
      <div class="prod-card" style="border-left-color:#8b5cf6">
        <div class="nume">Tub / electrician</div>
        <div><span class="val-mare">${z1.electricieni ? (z1.tub / z1.electricieni).toFixed(1) : '—'}</span><span class="um">m/el</span></div>
        <div class="recent">
          <span>Ieri: ${z0 && z0.electricieni ? (z0.tub / z0.electricieni).toFixed(1) + 'm/el' : '—'}</span>
        </div>
      </div>
      <div class="prod-card" style="border-left-color:#06b6d4">
        <div class="nume">Cablu / electrician</div>
        <div><span class="val-mare">${z1.electricieni ? (z1.cablu / z1.electricieni).toFixed(1) : '—'}</span><span class="um">m/el</span></div>
        <div class="recent">
          <span>Ieri: ${z0 && z0.electricieni ? (z0.cablu / z0.electricieni).toFixed(1) + 'm/el' : '—'}</span>
        </div>
      </div>
    </div>
  `;
}

function intervalISO(start, end) {
  const out = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}

function agregaInterval(zile) {
  let tub = 0, cablu = 0, electricieni = 0, oameni = 0;
  const aps = new Set(), apsGata = new Set();
  zile.forEach(z => {
    state.rapoarte.filter(r => r.data === z).forEach(r => {
      electricieni += r.nrElectricieni || 0;
      oameni += r.nrPersoane || 0;
      r.alocari.forEach(a => {
        aps.add(a.ap);
        if (a.stareNoua === 'gata') apsGata.add(a.ap);
        Object.entries(a.materiale || {}).forEach(([k, v]) => {
          if (k === 'tub20') tub += v;
          else if (k.startsWith('cyyf') || k === 'cablu_4x15') cablu += v;
        });
      });
    });
  });
  return { tub, cablu, electricieni, oameni, aps: aps.size, apsGata: apsGata.size };
}

function renderComparatieSaptamani() {
  const cont = document.getElementById('comparatieSaptamani');
  if (!cont) return;
  const azi = new Date();
  const ziSapt = azi.getDay() === 0 ? 6 : azi.getDay() - 1;
  const luniCurent = new Date(azi); luniCurent.setDate(azi.getDate() - ziSapt);
  const duminicaCurent = new Date(luniCurent); duminicaCurent.setDate(luniCurent.getDate() + 6);
  const luniAnt = new Date(luniCurent); luniAnt.setDate(luniCurent.getDate() - 7);
  const duminicaAnt = new Date(luniAnt); luniAnt.setDate(luniAnt.getDate());
  const duminicaAnt2 = new Date(luniAnt); duminicaAnt2.setDate(luniAnt.getDate() + 6);

  const fmt = d => d.toISOString().slice(0, 10);
  const acum = agregaInterval(intervalISO(fmt(luniCurent), fmt(duminicaCurent)));
  const inainte = agregaInterval(intervalISO(fmt(luniAnt), fmt(duminicaAnt2)));

  function row(label, curr, prev, unit) {
    let trend = '';
    if (prev > 0) {
      const d = ((curr - prev) / prev * 100);
      if (Math.abs(d) < 1) trend = `<span style="color:#6b7280">→ ${d.toFixed(0)}%</span>`;
      else if (d > 0) trend = `<span style="color:#10b981">↑ +${d.toFixed(0)}%</span>`;
      else trend = `<span style="color:#dc2626">↓ ${d.toFixed(0)}%</span>`;
    }
    return `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6">${label}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${curr.toFixed(unit === 'buc' ? 0 : 1)} ${unit}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">${prev.toFixed(unit === 'buc' ? 0 : 1)} ${unit}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${trend}</td></tr>`;
  }

  cont.innerHTML = `
    <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${fmt(luniCurent)} → ${fmt(duminicaCurent)} vs ${fmt(luniAnt)} → ${fmt(duminicaAnt2)}</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb">Indicator</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb">Acum</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb">Înainte</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb">Trend</th></tr></thead>
      <tbody>
        ${row('Tub 20mm', acum.tub, inainte.tub, 'm')}
        ${row('Cabluri total', acum.cablu, inainte.cablu, 'm')}
        ${row('Apartamente finalizate', acum.apsGata, inainte.apsGata, 'buc')}
        ${row('Apartamente atinse', acum.aps, inainte.aps, 'buc')}
        ${row('Electricieni-zile', acum.electricieni, inainte.electricieni, 'om-zi')}
      </tbody>
    </table>
  `;
}

function renderChartRitm14() {
  const cont = document.getElementById('chartRitm14');
  if (!cont) return;
  const azi = new Date();
  const zile = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(azi); d.setDate(azi.getDate() - i);
    zile.push(d.toISOString().slice(0, 10));
  }
  const tub = zile.map(z => state.rapoarte.filter(r => r.data === z).reduce((s, r) => s + r.alocari.reduce((ss, a) => ss + (a.materiale?.tub20 || 0), 0), 0));
  const cablu = zile.map(z => state.rapoarte.filter(r => r.data === z).reduce((s, r) => {
    let t = 0;
    r.alocari.forEach(a => Object.entries(a.materiale || {}).forEach(([k, v]) => { if (k.startsWith('cyyf') || k === 'cablu_4x15') t += v; }));
    return s + t;
  }, 0));

  const maxV = Math.max(...tub, ...cablu, 1);

  let html = '<div style="display:flex;gap:8px;margin-bottom:10px;font-size:12px"><span><span style="display:inline-block;width:14px;height:10px;background:#1e40af;border-radius:2px"></span> Tub</span><span><span style="display:inline-block;width:14px;height:10px;background:#10b981;border-radius:2px"></span> Cabluri</span></div>';
  html += '<svg width="100%" height="180" viewBox="0 0 700 180" preserveAspectRatio="none" style="display:block">';
  // baseline
  html += '<line x1="40" y1="160" x2="700" y2="160" stroke="#e5e7eb" stroke-width="1" />';
  const w = 660 / zile.length;
  zile.forEach((z, i) => {
    const x = 40 + i * w;
    const ht1 = (tub[i] / maxV) * 140;
    const ht2 = (cablu[i] / maxV) * 140;
    html += `<rect x="${x + 2}" y="${160 - ht1}" width="${w / 2 - 1}" height="${ht1}" fill="#1e40af" />`;
    html += `<rect x="${x + w / 2}" y="${160 - ht2}" width="${w / 2 - 1}" height="${ht2}" fill="#10b981" />`;
    // label dată
    if (i % 2 === 0) {
      const lbl = z.slice(8);
      html += `<text x="${x + w / 2}" y="175" text-anchor="middle" font-size="9" fill="#6b7280">${lbl}</text>`;
    }
  });
  // grila
  for (let i = 0; i < 4; i++) {
    const y = 160 - (i + 1) * 35;
    html += `<line x1="40" y1="${y}" x2="700" y2="${y}" stroke="#f3f4f6" stroke-dasharray="2" />`;
    html += `<text x="35" y="${y + 3}" text-anchor="end" font-size="9" fill="#9ca3af">${((i + 1) * maxV / 4).toFixed(0)}</text>`;
  }
  html += '</svg>';

  cont.innerHTML = html;
}

function renderTopZile() {
  const cont = document.getElementById('topZile');
  if (!cont) return;
  const per = sumPerData();
  const list = Object.entries(per).map(([data, d]) => ({
    data, tub: d.tub, cablu: d.cablu, scor: d.tub + d.cablu, electricieni: d.electricieni, ap: d.ap.size,
  })).sort((a, b) => b.scor - a.scor).slice(0, 5);
  if (list.length === 0) { cont.innerHTML = '<div class="empty">Niciun raport încă</div>'; return; }

  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Loc</th><th style="text-align:left;padding:8px">Data</th><th style="text-align:right;padding:8px">Tub (m)</th><th style="text-align:right;padding:8px">Cablu (m)</th><th style="text-align:right;padding:8px">El.</th><th style="text-align:right;padding:8px">Ap.</th></tr></thead><tbody>';
  list.forEach((z, i) => {
    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
    html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6">${medals[i]}</td><td style="padding:8px;border-bottom:1px solid #f3f4f6"><b>${fmtDate(z.data)}</b></td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${z.tub.toFixed(0)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${z.cablu.toFixed(0)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${z.electricieni}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${z.ap}</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function renderEchipeH2H() {
  const cont = document.getElementById('echipeH2H');
  if (!cont) return;
  if (state.echipe.length === 0) { cont.innerHTML = '<div class="empty">Definește echipe în Personal</div>'; return; }

  const perEch = {};
  state.echipe.forEach(e => {
    perEch[e.id] = { nume: e.nume, culoare: e.culoare, tub: 0, cablu: 0, zile: new Set(), apsGata: new Set() };
  });
  state.rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      if (!a.echipaId || !perEch[a.echipaId]) return;
      perEch[a.echipaId].zile.add(r.data);
      if (a.stareNoua === 'gata') perEch[a.echipaId].apsGata.add(a.ap);
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (k === 'tub20') perEch[a.echipaId].tub += v;
        else if (k.startsWith('cyyf') || k === 'cablu_4x15') perEch[a.echipaId].cablu += v;
      });
    });
  });
  const lista = Object.values(perEch).filter(e => e.zile.size > 0);
  if (lista.length === 0) { cont.innerHTML = '<div class="empty">Atribuie echipe în Raport zilnic la alocări</div>'; return; }

  const maxTub = Math.max(...lista.map(e => e.tub / e.zile.size), 0.1);
  const maxCablu = Math.max(...lista.map(e => e.cablu / e.zile.size), 0.1);

  let html = '<div style="display:flex;flex-direction:column;gap:14px">';
  lista.forEach(e => {
    const tubMed = e.tub / e.zile.size;
    const cabluMed = e.cablu / e.zile.size;
    html += `<div>
      <div style="font-weight:600;color:${e.culoare};margin-bottom:6px">● ${e.nume} <span style="color:#9ca3af;font-weight:400;font-size:11px">(${e.zile.size} zile, ${e.apsGata.size} ap. gata)</span></div>
      <div class="bar-row"><div class="label" style="font-size:11px">Tub/zi</div><div class="bar-container"><div class="bar-fill" style="width:${(tubMed / maxTub * 100)}%;background:${e.culoare}">${tubMed.toFixed(1)}m</div></div></div>
      <div class="bar-row"><div class="label" style="font-size:11px">Cablu/zi</div><div class="bar-container"><div class="bar-fill" style="width:${(cabluMed / maxCablu * 100)}%;background:${e.culoare};opacity:0.7">${cabluMed.toFixed(1)}m</div></div></div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;
}

function renderRankingAp() {
  const cont = document.getElementById('ranikingAp');
  if (!cont) return;
  const durate = calculeazaDurateApartamente();
  if (Object.keys(durate).length === 0) { cont.innerHTML = '<div class="empty">Niciun apartament marcat "Gata"</div>'; return; }

  const perTip = {};
  Object.entries(durate).forEach(([cod, d]) => {
    if (!perTip[d.tip]) perTip[d.tip] = [];
    perTip[d.tip].push({ cod, zile: d.zile });
  });

  let html = '';
  TIPURI_AP.forEach(tip => {
    const lista = perTip[tip];
    if (!lista || lista.length === 0) return;
    lista.sort((a, b) => a.zile - b.zile);
    const rapid = lista[0], lent = lista[lista.length - 1];
    const media = lista.reduce((s, x) => s + x.zile, 0) / lista.length;
    html += `<div style="margin-bottom:14px">
      <div style="font-weight:600;color:#1e40af;margin-bottom:4px">${tip} <span style="color:#9ca3af;font-weight:400;font-size:11px">(${lista.length} apartamente, media ${media.toFixed(1)} zile)</span></div>
      <div style="display:flex;gap:8px">
        <div style="flex:1;background:#d1fae5;padding:8px;border-radius:6px">
          <div style="font-size:11px;color:#065f46">🚀 Cel mai rapid</div>
          <div style="font-weight:700;color:#065f46">${rapid.cod}</div>
          <div style="font-size:12px;color:#047857">${rapid.zile} zile</div>
        </div>
        ${lista.length > 1 ? `<div style="flex:1;background:#fee2e2;padding:8px;border-radius:6px">
          <div style="font-size:11px;color:#991b1b">🐢 Cel mai lent</div>
          <div style="font-weight:700;color:#991b1b">${lent.cod}</div>
          <div style="font-size:12px;color:#b91c1c">${lent.zile} zile</div>
        </div>` : ''}
      </div>
    </div>`;
  });
  if (!html) html = '<div class="empty">Date insuficiente</div>';
  cont.innerHTML = html;
}

function renderCantitatiPerMp() {
  const cont = document.getElementById('cantitatiPerMp');
  if (!cont) return;
  const perTip = {};
  state.rapoarte.forEach(r => {
    r.alocari.forEach(a => {
      const ap = state.apartamente.find(x => x.cod === a.ap);
      if (!ap || !ap.mp) return;
      if (!perTip[ap.tip]) perTip[ap.tip] = { mp: new Map(), mat: {} };
      perTip[ap.tip].mp.set(ap.cod, ap.mp);
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        perTip[ap.tip].mat[k] = (perTip[ap.tip].mat[k] || 0) + v;
      });
    });
  });

  const tipuriDate = Object.entries(perTip).filter(([, d]) => d.mp.size > 0);
  if (tipuriDate.length === 0) {
    cont.innerHTML = '<div class="empty">Setează suprafețe (mp) la apartamente pentru a vedea acest KPI</div>';
    return;
  }

  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Tip</th><th style="text-align:right;padding:8px">Total mp</th><th style="text-align:right;padding:8px">Tub/mp</th><th style="text-align:right;padding:8px">Cablu/mp</th></tr></thead><tbody>';
  tipuriDate.forEach(([tip, d]) => {
    const totalMp = [...d.mp.values()].reduce((s, v) => s + v, 0);
    const cablu = Object.entries(d.mat).reduce((s, [k, v]) => s + ((k.startsWith('cyyf') || k === 'cablu_4x15') ? v : 0), 0);
    const tub = d.mat.tub20 || 0;
    html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6"><b>${tip}</b> <span style="font-size:11px;color:#9ca3af">(${d.mp.size} ap)</span></td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${totalMp.toFixed(0)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6;color:#1e40af;font-weight:600">${(tub / totalMp).toFixed(2)} m/mp</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6;color:#10b981;font-weight:600">${(cablu / totalMp).toFixed(2)} m/mp</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function renderOrePontajProductie() {
  const cont = document.getElementById('orePontajProductie');
  if (!cont) return;
  if (state.prezenta.length === 0) { cont.innerHTML = '<div class="empty">Nu există date de pontaj încă (tab Personal)</div>'; return; }

  // Agregare pe zi: ore totale vs tub + cablu produs
  const perZi = {};
  state.prezenta.forEach(p => {
    perZi[p.data] = (perZi[p.data] || 0) + p.ore;
  });
  const sums = sumPerData();
  const zile = Object.keys(perZi).filter(z => sums[z]).sort();
  if (zile.length === 0) { cont.innerHTML = '<div class="empty">Pontaj nepotrivit cu zile raportate</div>'; return; }

  // m total (tub + cablu) per oră pontaj
  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Data</th><th style="text-align:right;padding:8px">Ore pontaj</th><th style="text-align:right;padding:8px">Tub+Cablu (m)</th><th style="text-align:right;padding:8px">m/oră</th></tr></thead><tbody>';
  let totalOre = 0, totalM = 0;
  zile.slice(-10).forEach(z => {
    const ore = perZi[z];
    const m = sums[z].tub + sums[z].cablu;
    totalOre += ore; totalM += m;
    html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6">${fmtDate(z)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${ore.toFixed(1)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${m.toFixed(0)}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1e40af">${ore ? (m / ore).toFixed(2) : '—'}</td></tr>`;
  });
  html += `<tr style="background:#f9fafb;font-weight:700"><td style="padding:8px">TOTAL</td><td style="text-align:right;padding:8px">${totalOre.toFixed(1)}h</td><td style="text-align:right;padding:8px">${totalM.toFixed(0)}m</td><td style="text-align:right;padding:8px;color:#1e40af">${totalOre ? (totalM / totalOre).toFixed(2) : '—'} m/h</td></tr>`;
  html += '</tbody></table>';
  cont.innerHTML = html;
}

// Hook în renderKPI
const _renderKPI_original = renderKPI;
renderKPI = function () {
  _renderKPI_original();
  renderProgresBar();
  renderCifreCheie();
  renderComparatieSaptamani();
  renderChartRitm14();
  renderTopZile();
  renderEchipeH2H();
  renderRankingAp();
  renderCantitatiPerMp();
  renderOrePontajProductie();
  renderProductivitate();
  renderRapoarteAuxiliare();
  renderProductivitateEchipe();
  renderAlerteStoc();
  renderChartConsum7();
  renderChartDevieri();
  renderDurataPerTip();
  renderPredictieProiect();
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
