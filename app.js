// ===== Raport Execuție IE — iFort Systems =====
// Date stocate în localStorage. Sincronizare Google Sheets în Etapa 2.

const STORAGE_KEY = 'ifort_raport_ie_v1';

const MATERIALE_DEFAULT = [
  { id: 'tub20', nume: 'Tub PVC D20 IPEY', um: 'm', pretEur: 1.15 },
  { id: 'copex20', nume: 'Copex D20mm', um: 'm', pretEur: 0 },
  { id: 'cot20', nume: 'Cot 90° 20mm', um: 'buc', pretEur: 0 },
  { id: 'clema20', nume: 'Clemă 20mm', um: 'buc', pretEur: 0 },
  { id: 'manson20', nume: 'Manșon 20mm', um: 'buc', pretEur: 0 },
  { id: 'cyyf15', nume: 'Cablu CYYF 3x1.5 mmp', um: 'm', pretEur: 0.99 },
  { id: 'cyyf25', nume: 'Cablu CYYF 3x2.5 mmp', um: 'm', pretEur: 1.00 },
  { id: 'cyyf4', nume: 'Cablu CYYF 3x4 mmp', um: 'm', pretEur: 1.40 },
  { id: 'cyyf6', nume: 'Cablu CYYF 3x6 mmp', um: 'm', pretEur: 1.54 },
  { id: 'cablu_4x15', nume: 'Cablu CYYF 4x1.5 mmp', um: 'm', pretEur: 0.99 },
  { id: 'dibluri', nume: 'Dibluri', um: 'buc', pretEur: 0 },
  { id: 'suruburi', nume: 'Șuruburi', um: 'buc', pretEur: 0 },
  // Adăugate pentru viitor (nu apar la rapoarte zilnice până nu le folosești)
  { id: 'cablu_5x25', nume: 'Cablu CYYF 5x2.5 mmp', um: 'm', pretEur: 1.06 },
  { id: 'cablu_4x4', nume: 'Cablu CYYF 4x4 mmp', um: 'm', pretEur: 0 },
  { id: 'cablu_5x4', nume: 'Cablu CYYF 5x4 mmp', um: 'm', pretEur: 1.54 },
  { id: 'cablu_4x6', nume: 'Cablu CYYF 4x6 mmp', um: 'm', pretEur: 0 },
  { id: 'cablu_5x6', nume: 'Cablu CYYF 5x6 mmp', um: 'm', pretEur: 1.66 },
  { id: 'cablu_3x10', nume: 'Cablu CYYF 3x10 mmp', um: 'm', pretEur: 1.84 },
  { id: 'cablu_4x10', nume: 'Cablu CYYF 4x10 mmp', um: 'm', pretEur: 0 },
  { id: 'cablu_4x16', nume: 'Cablu CYYF 4x16 mmp', um: 'm', pretEur: 0 },
  { id: 'cablu_5x16', nume: 'Cablu CYYF 5x16 mmp', um: 'm', pretEur: 1.95 },
  { id: 'cablu_4x240_120', nume: 'Cablu CYYF 4x240+120', um: 'm', pretEur: 13 },
  { id: 'doza_der_100', nume: 'Doză derivație 100x100x40', um: 'buc', pretEur: 7 },
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
  situatiiLucrari: [], // [{ id, nr, data, dataStart, dataEnd, cantitati: {tub20: 1234, cyyf15: 567, ...}, createdAt }]
  beneficiar: 'Kesz Electric SRL',
  adresaObiectiv: 'Str. Coralilor, nr 83-87, Sector 1, București',
  firmaNume: 'iFort Systems SRL',
  firmaAdresa: 'B-vd Timișoara nr.80B, Sector 6, București',
  firmaCUI: 'RO300072700',
  firmaONRC: 'J40/4325/2012',
  firmaIBAN: 'RO29 UGBI 0000 1720 2515 2RON',
  contractInfo: '', // ex: "Contract nr. 123 / 01.01.2026"
  prefixSituatie: 'SL-2026-', // pentru numerotare
  contorBackup: 0, // câte rapoarte de la ultimul backup auto
  ultimaSyncOD: null, // timestamp ultima sincronizare OneDrive
  versiuneState: 0, // contor incrementat la fiecare save — pentru a detecta conflicte
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
  // Defaults pentru câmpuri noi (utilizatori existenți)
  if (!state.beneficiar) state.beneficiar = 'Kesz Electric SRL';
  if (!state.adresaObiectiv) state.adresaObiectiv = 'Str. Coralilor, nr 83-87, Sector 1, București';
  if (!state.firmaNume) state.firmaNume = 'iFort Systems SRL';
  if (!state.firmaAdresa) state.firmaAdresa = 'B-vd Timișoara nr.80B, Sector 6, București';
  if (!state.firmaCUI) state.firmaCUI = 'RO300072700';
  if (!state.firmaONRC) state.firmaONRC = 'J40/4325/2012';
  if (!state.firmaIBAN) state.firmaIBAN = 'RO29 UGBI 0000 1720 2515 2RON';
  if (!state.prefixSituatie) state.prefixSituatie = 'SL-2026-';
  // Migrare: adaugă materiale default lipsă + actualizează denumirile la cele default
  MATERIALE_DEFAULT.forEach(def => {
    const existing = state.materiale.find(m => m.id === def.id);
    if (!existing) {
      state.materiale.push({ ...def });
    } else {
      // FORȚEAZĂ update denumire și UM (sursa adevărului = MATERIALE_DEFAULT)
      existing.nume = def.nume;
      existing.um = def.um;
      // Preț: setează doar dacă nu există deja (păstrează editările utilizatorului)
      if (existing.pretEur === undefined) existing.pretEur = def.pretEur || 0;
    }
  });
  // Migrare defensivă pentru materiale custom (cabluri adăugate manual cu denumiri vechi)
  state.materiale.forEach(m => {
    if (MATERIALE_DEFAULT.some(d => d.id === m.id)) return;
    // Dacă denumirea începe cu "CYYF " (fără "Cablu") → adaugă prefix și sufix
    if (/^CYYF\s/i.test(m.nume) && !/^Cablu/i.test(m.nume)) {
      const needsSuffix = !/mmp\s*$/i.test(m.nume);
      m.nume = 'Cablu ' + m.nume + (needsSuffix ? ' mmp' : '');
    }
  });
  save();
}
function save() {
  state.versiuneState = (state.versiuneState || 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Trigger sync OneDrive (debounced — așteaptă 3s de inactivitate înainte de upload)
  if (typeof OneDrive !== 'undefined' && OneDrive.scheduleAutoSync) {
    OneDrive.scheduleAutoSync();
  }
}

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
    if (btn.dataset.tab === 'stoc') { renderStoc(); renderNecesarPreview(); }
    if (btn.dataset.tab === 'personal') renderPersonal();
    if (btn.dataset.tab === 'situatii') renderSituatii();
    if (btn.dataset.tab === 'analiza') renderAnaliza();
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

  // Auto-completare aux la blur pe tub
  const tubInp = block.querySelector('.mat-qty[data-mat="tub20"]');
  if (tubInp) {
    tubInp.addEventListener('blur', () => autoCompletareAux(block));
    tubInp.addEventListener('change', () => autoCompletareAux(block));
  }

  cont.appendChild(block);
}

// Auto-completează cot/clemă/manșon/dibluri/șuruburi pe baza tubului introdus
// Coeficienți ficși per metru tub (cu variație ±2% pentru naturalețe)
const COEF_AUX = {
  cot20: 0.3,
  clema20: 2.0,
  manson20: 0.1,
  dibluri: 2.0,
  suruburi: 2.0,
};

function autoCompletareAux(block) {
  const tubInp = block.querySelector('.mat-qty[data-mat="tub20"]');
  const tubVal = parseFloat(tubInp?.value);
  if (!tubVal || tubVal <= 0) return;

  Object.entries(COEF_AUX).forEach(([id, coef]) => {
    const inp = block.querySelector(`.mat-qty[data-mat="${id}"]`);
    if (!inp) return;
    // Nu suprascrie dacă utilizatorul a pus deja ceva
    if (inp.value && parseFloat(inp.value) > 0) return;

    // Variație random ±2% pentru naturalețe (nu pare robotic)
    const variatie = 1 + (Math.random() * 0.04 - 0.02); // [0.98 .. 1.02]
    const sugestie = tubVal * coef * variatie;

    const m = state.materiale.find(x => x.id === id);
    if (m && m.um === 'buc') {
      inp.value = Math.max(1, Math.round(sugestie));
    } else {
      inp.value = (Math.round(sugestie * 2) / 2).toFixed(1);
    }
  });
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

  // PAGINĂ PONTAJ (doar PDF intern, dacă există pontaj)
  let pontajPage = '';
  if (!extern && state.prezenta) {
    const pontajZi = state.prezenta.filter(p => p.data === r.data && !p.absent && p.ore > 0);
    if (pontajZi.length > 0) {
      const echipeMap = {};
      state.echipe.forEach(e => e.codMembri.forEach(c => { echipeMap[c] = e; }));
      let totalOre = 0;
      const rows = pontajZi.map(p => {
        const m = state.muncitori.find(x => x.cod === p.cod);
        const nume = m ? m.nume : '—';
        const ech = echipeMap[p.cod];
        const echHTML = ech ? `<span style="background:${ech.culoare};color:white;padding:1px 6px;border-radius:8px;font-size:10px">${ech.nume}</span>` : '—';
        totalOre += p.ore;
        return `<tr>
          <td style="text-align:center">${p.cod}</td>
          <td>${nume}</td>
          <td style="text-align:center">${echHTML}</td>
          <td style="text-align:center">${p.oraStart || '—'}</td>
          <td style="text-align:center">${p.oraFinal || '—'}</td>
          <td style="text-align:center">${p.pauza !== undefined ? p.pauza + 'h' : '1h'}</td>
          <td style="text-align:right;font-weight:700">${p.ore.toFixed(1)}h</td>
        </tr>`;
      }).join('');
      pontajPage = `
<div class="page">
  <div class="header">
    <img src="logo.png" class="logo" alt="iFort" />
    <div class="header-text">
      <div class="company">iFort Systems S.R.L.</div>
      <div class="sub">Pontaj zi — ${fmtDate(r.data)} (intern)</div>
    </div>
  </div>

  <div class="info-grid">
    <div><b>Data:</b> ${fmtDate(r.data)}</div>
    <div><b>Program:</b> ${r.oraStart} — ${r.oraFinal}</div>
    <div><b>Prezenți:</b> ${pontajZi.length} persoane</div>
    <div><b>Total ore lucrate:</b> ${totalOre.toFixed(1)}h</div>
  </div>

  <h2>Pontaj prezență</h2>
  <table>
    <thead><tr>
      <th style="text-align:center;width:50px">Cod</th>
      <th>Nume</th>
      <th style="text-align:center;width:80px">Echipa</th>
      <th style="text-align:center;width:70px">Start</th>
      <th style="text-align:center;width:70px">Final</th>
      <th style="text-align:center;width:60px">Pauză</th>
      <th style="text-align:right;width:80px">Ore</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr style="background:#f3f4f6;font-weight:700">
        <td colspan="6" style="text-align:right">TOTAL</td>
        <td style="text-align:right;color:#1e40af">${totalOre.toFixed(1)}h</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">Document intern — iFort Systems S.R.L.</div>
</div>`;
    }
  }

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
${pontajPage}
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
  document.getElementById('beneficiar').value = state.beneficiar || 'Kesz Electric SRL';
  document.getElementById('antreprenor').value = state.antreprenor || 'KESZ';
  document.getElementById('adresaObiectiv').value = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';
  document.getElementById('santier').value = state.santier || 'Corallis';
  document.getElementById('firmaNume').value = state.firmaNume || 'iFort Systems SRL';
  document.getElementById('firmaAdresa').value = state.firmaAdresa || 'B-vd Timișoara nr.80B, Sector 6, București';
  document.getElementById('firmaCUI').value = state.firmaCUI || 'RO300072700';
  document.getElementById('firmaONRC').value = state.firmaONRC || 'J40/4325/2012';
  document.getElementById('firmaIBAN').value = state.firmaIBAN || 'RO29 UGBI 0000 1720 2515 2RON';
  document.getElementById('prefixSituatie').value = state.prefixSituatie || 'SL-2026-';
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
      state.materiale.splice(i, 1); save(); renderSetari();
    });
    cont.appendChild(row);
  });

  // Editor prețuri
  const contPret = document.getElementById('preturiMaterialeAdmin');
  if (contPret) {
    contPret.innerHTML = '';
    state.materiale.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'material-row';
      row.innerHTML = `
        <span class="nume" style="flex:2">${m.nume}</span>
        <input type="number" class="pret-input" data-id="${m.id}" step="0.01" min="0" value="${(m.pretEur ?? 0).toFixed(2)}" style="flex:1;max-width:90px" />
        <span class="um">EUR/${m.um}</span>
      `;
      row.querySelector('.pret-input').addEventListener('change', (e) => {
        const v = parseFloat(e.target.value) || 0;
        m.pretEur = v;
        save();
        toast(`${m.nume}: ${v.toFixed(2)} EUR ✓`);
      });
      contPret.appendChild(row);
    });
  }
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
  state.beneficiar = document.getElementById('beneficiar').value.trim() || 'Kesz Electric SRL';
  state.antreprenor = document.getElementById('antreprenor').value.trim() || 'KESZ';
  state.adresaObiectiv = document.getElementById('adresaObiectiv').value.trim() || 'Str. Coralilor, nr 83-87, Sector 1, București';
  state.santier = document.getElementById('santier').value.trim() || 'Corallis';
  save();
  toast('Date proiect salvate ✓');
});

document.getElementById('btnSaveFirma').addEventListener('click', () => {
  state.firmaNume = document.getElementById('firmaNume').value.trim();
  state.firmaAdresa = document.getElementById('firmaAdresa').value.trim();
  state.firmaCUI = document.getElementById('firmaCUI').value.trim();
  state.firmaONRC = document.getElementById('firmaONRC').value.trim();
  state.firmaIBAN = document.getElementById('firmaIBAN').value.trim();
  state.prefixSituatie = document.getElementById('prefixSituatie').value.trim() || 'SL-2026-';
  save();
  toast('Date firmă salvate ✓');
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
// ===== NECESAR MATERIALE (estimare comandă furnizor) =====
function calculeazaNecesar(zileIstoric, zileProiect, marjaPct) {
  // Iau ultimele N zile cu activitate (cu rapoarte și cu cantități > 0)
  const zileCuConsum = state.rapoarte
    .filter(r => {
      // are cel puțin un material consumat
      return Object.values(r.materiale || {}).some(v => v > 0);
    })
    .map(r => ({ data: r.data, materiale: r.materiale || {} }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, zileIstoric);

  if (zileCuConsum.length === 0) return null;

  // Sumă per material
  const sume = {};
  zileCuConsum.forEach(z => {
    Object.entries(z.materiale).forEach(([k, v]) => {
      sume[k] = (sume[k] || 0) + v;
    });
  });

  // Medie zilnică × zile proiect × (1 + marjă)
  const marjaFactor = 1 + (marjaPct / 100);
  const necesar = {};
  Object.entries(sume).forEach(([k, total]) => {
    const medieZi = total / zileCuConsum.length;
    necesar[k] = medieZi * zileProiect * marjaFactor;
  });

  return {
    necesar,
    zileBaza: zileCuConsum.length,
    intervalBaza: zileCuConsum.length > 0 ? `${fmtDate(zileCuConsum[zileCuConsum.length - 1].data)} → ${fmtDate(zileCuConsum[0].data)}` : '—',
    sumeBruta: sume,
  };
}

function renderNecesarPreview() {
  const cont = document.getElementById('necesarPreview');
  if (!cont) return;
  const zi = parseInt(document.getElementById('necesarZileIstoric').value, 10) || 5;
  const zp = parseInt(document.getElementById('necesarZileProiect').value, 10) || 5;
  const m = parseFloat(document.getElementById('necesarMarja').value) || 0;

  const rez = calculeazaNecesar(zi, zp, m);
  if (!rez) { cont.innerHTML = '<div class="empty">Niciun consum istoric — introdu rapoarte cu materiale</div>'; return; }

  // Ordonare materiale: mai întâi cele cu cantitate mai mare
  const sortate = Object.entries(rez.necesar)
    .map(([k, v]) => ({ id: k, val: v, mat: state.materiale.find(x => x.id === k) }))
    .filter(x => x.mat && x.val > 0)
    .sort((a, b) => b.val - a.val);

  if (sortate.length === 0) { cont.innerHTML = '<div class="empty">Nimic de comandat</div>'; return; }

  let html = `<p class="small" style="margin-bottom:6px"><b>Bază calcul:</b> ${rez.zileBaza} zile cu consum (${rez.intervalBaza})</p>`;
  html += '<table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr>';
  html += '<th style="text-align:left;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">Material</th>';
  html += '<th style="text-align:center;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">UM</th>';
  html += '<th style="text-align:right;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">Cantitate necesară</th>';
  html += '<th style="text-align:right;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">Medie/zi</th>';
  html += '</tr></thead><tbody>';
  sortate.forEach(x => {
    const medZi = x.val / zp / (1 + m / 100);
    const cant = x.mat.um === 'buc' ? Math.ceil(x.val) : Math.ceil(x.val / 5) * 5; // rotunjește la 5m pt cabluri/tub
    html += `<tr><td style="padding:6px 8px;font-size:13px">${x.mat.nume}</td><td style="text-align:center;padding:6px 8px;font-size:12px">${x.mat.um}</td><td style="text-align:right;padding:6px 8px;font-size:14px;font-weight:700;color:#1e40af">${cant}</td><td style="text-align:right;padding:6px 8px;font-size:11px;color:#6b7280">${medZi.toFixed(1)} ${x.mat.um}/zi</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

// Wire UI
document.addEventListener('DOMContentLoaded', () => {
  const btnR = document.getElementById('btnNecesarRefresh');
  const btnPDF = document.getElementById('btnNecesarPDF');
  const inputs = ['necesarZileIstoric', 'necesarZileProiect', 'necesarMarja'].map(id => document.getElementById(id));
  if (btnR) btnR.addEventListener('click', renderNecesarPreview);
  inputs.forEach(inp => { if (inp) inp.addEventListener('change', renderNecesarPreview); });
  if (btnPDF) btnPDF.addEventListener('click', genereazaNecesarPDF);
});

function genereazaNecesarPDF() {
  const zi = parseInt(document.getElementById('necesarZileIstoric').value, 10) || 5;
  const zp = parseInt(document.getElementById('necesarZileProiect').value, 10) || 5;
  const m = parseFloat(document.getElementById('necesarMarja').value) || 0;
  const rez = calculeazaNecesar(zi, zp, m);
  if (!rez) { toast('Niciun istoric disponibil'); return; }

  const sortate = Object.entries(rez.necesar)
    .map(([k, v]) => ({ id: k, val: v, mat: state.materiale.find(x => x.id === k) }))
    .filter(x => x.mat && x.val > 0)
    .sort((a, b) => b.val - a.val);

  if (sortate.length === 0) { toast('Nimic de comandat'); return; }

  const tableRows = sortate.map((x, i) => {
    const cant = x.mat.um === 'buc' ? Math.ceil(x.val) : Math.ceil(x.val / 5) * 5;
    const medZi = x.val / zp / (1 + m / 100);
    return `<tr><td style="text-align:center">${i + 1}</td><td>${x.mat.nume}</td><td style="text-align:center">${x.mat.um}</td><td style="text-align:right;font-weight:700">${cant}</td><td style="text-align:right;color:#6b7280;font-size:11px">${medZi.toFixed(1)} ${x.mat.um}/zi</td></tr>`;
  }).join('');

  const antetFirma = `
    <div style="font-size:11px;line-height:1.5;color:#374151;margin-bottom:10px">
      <div style="font-weight:700;font-size:13px;color:#1e40af">${state.firmaNume || 'iFort Systems SRL'}</div>
      <div>${state.firmaAdresa || ''}</div>
      <div><b>CUI:</b> ${state.firmaCUI || ''} &nbsp; <b>ONRC:</b> ${state.firmaONRC || ''}</div>
      <div><b>IBAN:</b> <span style="color:#374151">${state.firmaIBAN || ''}</span></div>
    </div>`;

  const beneficiar = state.beneficiar || 'Kesz Electric SRL';
  const adresa = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';
  const dataGenerare = todayISO();

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><title>Necesar materiale ${fmtDate(dataGenerare)}</title>
<style>
*{box-sizing:border-box}
a,a:link,a:visited{color:inherit !important;text-decoration:none !important;cursor:default}
body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
.page{background:white;padding:35px;max-width:780px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:flex-start;gap:18px;border-bottom:3px solid #f59e0b;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px;height:auto;object-fit:contain}
.title{font-size:20px;font-weight:700;text-align:center;margin:18px 0 6px;color:#f59e0b}
.subtitle{font-size:13px;color:#6b7280;text-align:center;margin-bottom:22px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;background:#fffbeb;padding:14px;border-radius:8px;margin-bottom:18px;font-size:14px;border-left:4px solid #f59e0b}
.info-grid b{color:#92400e}
table{width:100%;border-collapse:collapse;margin:10px 0 20px}
th,td{padding:10px 12px;border:1px solid #d1d5db;font-size:14px}
th{background:#f59e0b;color:white;text-align:left;font-weight:600}
.obs{background:#fef3c7;padding:12px;border-radius:6px;font-size:12px;margin-top:10px;color:#92400e}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;z-index:100}
@media print{
  @page{size:A4 portrait;margin:10mm}
  body{background:white;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{margin:0;padding:0;box-shadow:none;max-width:100%;width:100%}
  .no-print{display:none}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  <div class="header"><img src="logo.png" class="logo" />${antetFirma}</div>

  <div class="title">NECESAR MATERIALE / ${fmtDate(dataGenerare)}</div>
  <div class="subtitle">Estimare pentru aprovizionare instalații electrice</div>

  <div class="info-grid">
    <div><b>Beneficiar:</b> ${beneficiar}</div>
    <div><b>Executant:</b> ${state.firmaNume || 'iFort Systems SRL'}</div>
    <div style="grid-column:1/-1"><b>Adresa obiectiv:</b> ${adresa}</div>
    <div><b>Bază calcul:</b> ${rez.zileBaza} zile cu consum</div>
    <div><b>Proiectat pentru:</b> ${zp} zile lucrate</div>
    <div><b>Interval bază:</b> ${rez.intervalBaza}</div>
    <div><b>Marjă siguranță:</b> +${m}%</div>
  </div>

  <h3 style="font-size:14px;color:#92400e;margin-top:8px;margin-bottom:6px;border-bottom:1px solid #fde68a;padding-bottom:4px">Materiale necesare a fi comandate</h3>
  <table>
    <thead>
      <tr><th style="width:40px;text-align:center">Nr.</th><th>Denumire material</th><th style="width:50px;text-align:center">UM</th><th style="width:110px;text-align:right">Cantitate</th><th style="width:120px;text-align:right">Ritm zilnic</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="obs">
    <b>⚠️ Notă:</b> Cantitățile sunt estimate pe baza consumului mediu istoric (ultimele ${rez.zileBaza} zile cu activitate), proiectat pe ${zp} zile, cu marjă de siguranță +${m}%.
    Verificați stocul existent înainte de plasarea comenzii.
  </div>

  <div class="footer">Document generat — ${state.firmaNume || 'iFort Systems SRL'} — ${fmtDate(dataGenerare)}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

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
  renderPontajEchipeRapid();
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

// Calculează ore lucrate efectiv (cu pauza scăzută)
function calcOreLucrate(oraStart, oraFinal, pauza) {
  if (!oraStart || !oraFinal) return 0;
  const [h1, m1] = oraStart.split(':').map(Number);
  const [h2, m2] = oraFinal.split(':').map(Number);
  const start = h1 + m1 / 60;
  const final = h2 + m2 / 60;
  let total = final - start;
  if (total < 0) total += 24; // în caz că trece miezul nopții
  total -= (pauza || 0);
  return Math.max(0, Math.round(total * 2) / 2); // pas 0.5h
}

function renderPontajEchipeRapid() {
  const cont = document.getElementById('pontajEchipeRapid');
  if (!cont) return;
  const data = document.getElementById('pontajData').value || todayISO();
  const activi = muncitoriiActiviLaData(data);
  const echipeCuMembriActivi = state.echipe.filter(e =>
    e.codMembri.some(cod => activi.some(m => m.cod === cod))
  );
  if (echipeCuMembriActivi.length === 0) { cont.innerHTML = ''; return; }
  let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:#6b7280">Pontaj rapid:</span>';
  echipeCuMembriActivi.forEach(e => {
    html += `<button type="button" class="btn-secondary btn-pontaj-grup" data-echipa="${e.id}" style="font-size:12px;padding:6px 10px;border-left:3px solid ${e.culoare}">📋 Echipa ${e.nume} (07:30–17:00)</button>`;
  });
  html += '<button type="button" class="btn-secondary" id="btnPontajToti" style="font-size:12px;padding:6px 10px">📋 Toți (07:30–17:00)</button>';
  html += '</div>';
  cont.innerHTML = html;

  cont.querySelectorAll('.btn-pontaj-grup').forEach(b => b.addEventListener('click', () => {
    const e = state.echipe.find(x => x.id === b.dataset.echipa);
    if (!e) return;
    e.codMembri.forEach(cod => setPontajRapid(cod, '07:30', '17:00', 1, false));
    actualizeazaSumarPontaj();
    toast(`Echipa ${e.nume} pontaj 07:30–17:00 ✓`);
  }));
  const btnToti = document.getElementById('btnPontajToti');
  if (btnToti) btnToti.addEventListener('click', () => {
    activi.forEach(m => setPontajRapid(m.cod, '07:30', '17:00', 1, false));
    actualizeazaSumarPontaj();
    toast('Pontaj 07:30–17:00 pentru toți ✓');
  });
}

function setPontajRapid(cod, oraStart, oraFinal, pauza, absent) {
  const row = document.querySelector(`.pontaj-row[data-cod="${cod}"]`);
  if (!row) return;
  if (absent) {
    row.querySelector('.pontaj-absent').checked = true;
    row.querySelector('.pontaj-start').value = '';
    row.querySelector('.pontaj-final').value = '';
  } else {
    row.querySelector('.pontaj-absent').checked = false;
    row.querySelector('.pontaj-start').value = oraStart;
    row.querySelector('.pontaj-final').value = oraFinal;
    row.querySelector('.pontaj-pauza').value = pauza;
  }
  actualizeazaOreRand(row);
}

function actualizeazaOreRand(row) {
  const absent = row.querySelector('.pontaj-absent').checked;
  const start = row.querySelector('.pontaj-start').value;
  const final = row.querySelector('.pontaj-final').value;
  const pauza = parseFloat(row.querySelector('.pontaj-pauza').value) || 0;
  const oreEl = row.querySelector('.pontaj-ore-calc');
  if (absent) {
    oreEl.textContent = 'absent';
    oreEl.style.color = '#dc2626';
    row.style.opacity = 0.5;
  } else {
    const ore = calcOreLucrate(start, final, pauza);
    oreEl.textContent = ore > 0 ? `${ore.toFixed(1)}h` : '—';
    oreEl.style.color = ore > 0 ? '#10b981' : '#9ca3af';
    row.style.opacity = 1;
  }
}

function actualizeazaSumarPontaj() {
  const info = document.getElementById('pontajInfo');
  if (!info) return;
  const rows = document.querySelectorAll('.pontaj-row');
  let totalOre = 0, totalPrezenti = 0;
  rows.forEach(r => {
    if (r.querySelector('.pontaj-absent').checked) return;
    const start = r.querySelector('.pontaj-start').value;
    const final = r.querySelector('.pontaj-final').value;
    const pauza = parseFloat(r.querySelector('.pontaj-pauza').value) || 0;
    const ore = calcOreLucrate(start, final, pauza);
    if (ore > 0) { totalOre += ore; totalPrezenti++; }
  });
  info.innerHTML = `<b>Total:</b> ${totalPrezenti} prezenți × ore = <b style="color:#1e40af">${totalOre.toFixed(1)} ore lucrate</b>`;
  // Validare vs raport zilnic
  const data = document.getElementById('pontajData').value;
  if (data && state.rapoarte) {
    const raport = state.rapoarte.find(r => r.data === data);
    if (raport) {
      const nrEl = raport.nrElectricieni || 0;
      if (nrEl !== totalPrezenti && totalPrezenti > 0) {
        info.innerHTML += `<br><span style="color:#f59e0b">⚠️ Raportul zilei zice ${nrEl} electricieni, dar în pontaj ai ${totalPrezenti} prezenți</span>`;
      } else if (nrEl === totalPrezenti && totalPrezenti > 0) {
        info.innerHTML += ` <span style="color:#10b981">✓ Coincide cu raportul</span>`;
      }
    }
  }
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

  // Pentru fiecare muncitor: găsește echipa lui
  function echipaMuncitorului(cod) {
    return state.echipe.find(e => e.codMembri.includes(cod));
  }

  let html = '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">';
  activi.forEach(m => {
    const p = prezentaZi.find(x => x.cod === m.cod);
    const oraStart = p?.oraStart || '';
    const oraFinal = p?.oraFinal || '';
    const pauza = p?.pauza !== undefined ? p.pauza : 1;
    const absent = p?.absent || false;
    const ech = echipaMuncitorului(m.cod);
    const echBadge = ech ? `<span style="display:inline-block;background:${ech.culoare};color:white;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:6px">${ech.nume}</span>` : '';

    html += `<div class="pontaj-row" data-cod="${m.cod}" style="background:#f9fafb;padding:8px 10px;border-radius:6px;border-left:3px solid ${ech ? ech.culoare : '#9ca3af'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:600"><b>${m.cod}</b> ${m.nume}${echBadge}</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;margin:0">
          <input type="checkbox" class="pontaj-absent" ${absent ? 'checked' : ''} />
          Absent
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 70px 60px;gap:6px;align-items:center">
        <label style="font-size:11px;color:#6b7280;margin:0">Start
          <input type="time" class="pontaj-start" value="${oraStart}" step="1800" style="margin-top:2px" />
        </label>
        <label style="font-size:11px;color:#6b7280;margin:0">Final
          <input type="time" class="pontaj-final" value="${oraFinal}" step="1800" style="margin-top:2px" />
        </label>
        <label style="font-size:11px;color:#6b7280;margin:0">Pauză
          <input type="number" class="pontaj-pauza" value="${pauza}" min="0" max="3" step="0.5" style="margin-top:2px" />
        </label>
        <div style="text-align:center;font-weight:700;font-size:14px" class="pontaj-ore-calc">—</div>
      </div>
    </div>`;
  });
  html += '</div>';
  cont.innerHTML = html;

  // Listeners pentru recalculare live
  cont.querySelectorAll('.pontaj-row').forEach(row => {
    actualizeazaOreRand(row);
    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        actualizeazaOreRand(row);
        actualizeazaSumarPontaj();
      });
    });
  });
  actualizeazaSumarPontaj();
}

document.getElementById('pontajData').addEventListener('change', () => {
  renderListaMuncitoriPrezenta();
  renderPontajEchipeRapid();
});

document.getElementById('btnSavePontaj').addEventListener('click', () => {
  const data = document.getElementById('pontajData').value || todayISO();
  state.prezenta = state.prezenta.filter(p => p.data !== data);
  let totalSalvat = 0;
  document.querySelectorAll('.pontaj-row').forEach(row => {
    const cod = row.dataset.cod;
    const absent = row.querySelector('.pontaj-absent').checked;
    const oraStart = row.querySelector('.pontaj-start').value;
    const oraFinal = row.querySelector('.pontaj-final').value;
    const pauza = parseFloat(row.querySelector('.pontaj-pauza').value) || 0;
    if (absent) {
      state.prezenta.push({ data, cod, ore: 0, absent: true });
      return;
    }
    if (!oraStart || !oraFinal) return;
    const ore = calcOreLucrate(oraStart, oraFinal, pauza);
    if (ore > 0) {
      state.prezenta.push({ data, cod, ore, oraStart, oraFinal, pauza });
      totalSalvat++;
    }
  });
  save();
  toast(`Pontaj salvat: ${totalSalvat} prezenți ✓`);
  renderSumarPrezenta();
});

const btnPontajClear = document.getElementById('btnPontajClear');
if (btnPontajClear) btnPontajClear.addEventListener('click', () => {
  const data = document.getElementById('pontajData').value || todayISO();
  if (!confirm(`Ștergi pontajul pentru ${fmtDate(data)}?`)) return;
  state.prezenta = state.prezenta.filter(p => p.data !== data);
  save();
  renderListaMuncitoriPrezenta();
  toast('Pontaj șters ✓');
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

// ===== PONTAJ LUNAR PDF (matrice) =====
document.getElementById('btnPontajLunarPDF').addEventListener('click', () => {
  const luna = document.getElementById('sumarLuna').value;
  if (!luna) { toast('Selectează o lună'); return; }
  const [an, lunaNr] = luna.split('-').map(Number);
  const ultimaZi = new Date(an, lunaNr, 0).getDate();
  const start = `${luna}-01`;
  const end = `${luna}-${String(ultimaZi).padStart(2, '0')}`;
  const lunaNume = new Date(an, lunaNr - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  // Muncitorii activi cel puțin 1 zi în lună
  const muncitoriLuna = state.muncitori.filter(m =>
    m.dataStart <= end && (!m.dataEnd || m.dataEnd >= start)
  ).sort((a, b) => a.cod.localeCompare(b.cod));

  if (muncitoriLuna.length === 0) {
    toast('Niciun muncitor în această lună');
    return;
  }

  // Echipe map
  const echipeMap = {};
  state.echipe.forEach(e => e.codMembri.forEach(c => { echipeMap[c] = e; }));

  // Prezența lunii: { 'cod-yyyy-mm-dd': ore } + flag absent
  const prez = {};
  state.prezenta.filter(p => p.data >= start && p.data <= end).forEach(p => {
    prez[`${p.cod}-${p.data}`] = p;
  });

  // Identifică weekend
  function isWeekend(zi) {
    const d = new Date(an, lunaNr - 1, zi);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  // Header tabel: Nr | Cod | Nume | Echipa | Z1 ... Zn | Total
  let header = '<tr>';
  header += '<th style="padding:4px;font-size:9px">Cod</th>';
  header += '<th style="padding:4px;font-size:9px;text-align:left">Nume</th>';
  header += '<th style="padding:4px;font-size:9px">Echipa</th>';
  for (let z = 1; z <= ultimaZi; z++) {
    const we = isWeekend(z) ? 'background:#fef3c7' : '';
    header += `<th style="padding:2px;font-size:9px;text-align:center;width:22px;${we}">${z}</th>`;
  }
  header += '<th style="padding:4px;font-size:10px;text-align:right;background:#e0e7ff">Total</th>';
  header += '</tr>';

  // Rânduri per muncitor
  let totalGeneralOre = 0;
  const totalPerZi = new Array(ultimaZi + 1).fill(0);
  let rows = '';
  muncitoriLuna.forEach(m => {
    const ech = echipeMap[m.cod];
    let totalMuncitor = 0;
    let celule = '';
    for (let z = 1; z <= ultimaZi; z++) {
      const dataZi = `${luna}-${String(z).padStart(2, '0')}`;
      const p = prez[`${m.cod}-${dataZi}`];
      const we = isWeekend(z) ? 'background:#fef9c3' : '';
      if (!p) {
        celule += `<td style="text-align:center;padding:2px;font-size:9px;color:#d1d5db;${we}">-</td>`;
      } else if (p.absent) {
        celule += `<td style="text-align:center;padding:2px;font-size:9px;color:#dc2626;font-weight:700;${we}">A</td>`;
      } else if (p.ore > 0) {
        totalMuncitor += p.ore;
        totalPerZi[z] += p.ore;
        const ore = p.ore === Math.floor(p.ore) ? p.ore.toFixed(0) : p.ore.toFixed(1);
        celule += `<td style="text-align:center;padding:2px;font-size:9px;color:#1e40af;${we}">${ore}</td>`;
      } else {
        celule += `<td style="text-align:center;padding:2px;font-size:9px;color:#d1d5db;${we}">-</td>`;
      }
    }
    totalGeneralOre += totalMuncitor;
    const echHTML = ech ? `<span style="background:${ech.culoare};color:white;padding:1px 4px;border-radius:6px;font-size:9px">${ech.nume}</span>` : '—';
    rows += `<tr>
      <td style="padding:3px;font-size:10px;text-align:center;font-weight:700">${m.cod}</td>
      <td style="padding:3px;font-size:10px">${m.nume}</td>
      <td style="padding:3px;font-size:10px;text-align:center">${echHTML}</td>
      ${celule}
      <td style="padding:3px;font-size:11px;text-align:right;font-weight:700;background:#e0e7ff;color:#1e40af">${totalMuncitor.toFixed(1)}h</td>
    </tr>`;
  });
  // Total per zi rând
  let totalRow = `<tr style="background:#f3f4f6;font-weight:700">
    <td colspan="3" style="padding:4px;text-align:right;font-size:10px">TOTAL zi</td>`;
  for (let z = 1; z <= ultimaZi; z++) {
    const we = isWeekend(z) ? 'background:#fef9c3' : '';
    totalRow += `<td style="padding:2px;font-size:9px;text-align:center;${we}">${totalPerZi[z] > 0 ? totalPerZi[z].toFixed(0) : '-'}</td>`;
  }
  totalRow += `<td style="padding:4px;font-size:12px;text-align:right;background:#1e40af;color:white">${totalGeneralOre.toFixed(1)}h</td></tr>`;

  // HTML complet
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><title>Pontaj ${lunaNume}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
a,a:link,a:visited{color:inherit !important;text-decoration:none !important}
.page{background:white;padding:20px;max-width:100%;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1e40af;padding-bottom:8px;margin-bottom:12px}
.header .logo{width:60px}
.header-text .company{font-size:16px;font-weight:700;color:#1e40af}
.header-text .sub{font-size:11px;color:#6b7280}
.intern-badge{background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:6px;font-weight:600;font-size:11px;text-align:center;margin-bottom:8px;display:inline-block}
.title{font-size:16px;font-weight:700;text-align:center;margin:4px 0;color:#1e40af}
.subtitle{font-size:11px;color:#6b7280;text-align:center;margin-bottom:12px}
.info-box{background:#f9fafb;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:11px;display:flex;gap:18px;flex-wrap:wrap}
.info-box b{color:#1e40af}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{background:#1e40af;color:white;border:1px solid #1e40af}
td{border:1px solid #e5e7eb}
.legend{font-size:10px;color:#6b7280;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:4px}
.legend-cell{display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:100}
.footer{margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
@media print{
  @page{size:A4 landscape;margin:8mm}
  body{background:white}
  .page{margin:0;padding:0;box-shadow:none}
  .no-print{display:none}
  -webkit-print-color-adjust:exact;print-color-adjust:exact
}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  <div class="intern-badge">📊 DOCUMENT INTERN — arhivă firmă</div>
  <div class="header"><img src="logo.png" class="logo" /><div class="header-text"><div class="company">${state.firmaNume || 'iFort Systems SRL'}</div><div class="sub">Pontaj lunar — ${state.santier || 'Corallis'}</div></div></div>

  <div class="title">PONTAJ ${lunaNume.toUpperCase()}</div>
  <div class="subtitle">Generat: ${fmtDate(todayISO())}</div>

  <div class="info-box">
    <div><b>Muncitori activi:</b> ${muncitoriLuna.length}</div>
    <div><b>Zile lunare:</b> ${ultimaZi}</div>
    <div><b>Total ore lucrate:</b> ${totalGeneralOre.toFixed(1)}h</div>
  </div>

  <table>
    <thead>${header}</thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>

  <div class="legend">
    <div class="legend-item"><span class="legend-cell" style="background:#fef9c3">XX</span> Weekend</div>
    <div class="legend-item"><span class="legend-cell" style="background:#fee2e2;color:#dc2626;font-weight:700">A</span> Absent</div>
    <div class="legend-item"><span class="legend-cell" style="color:#d1d5db">-</span> Fără pontaj</div>
    <div class="legend-item"><span class="legend-cell" style="color:#1e40af">8.5</span> Ore lucrate</div>
  </div>

  <div class="footer">Document intern — ${state.firmaNume || 'iFort Systems SRL'} — generat ${fmtDate(todayISO())}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
});

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

// ============= SITUAȚII DE LUCRĂRI =============
// Materialele care apar în Situații (NUMAI tub + cabluri, ordine fixă)
const MATERIALE_SITUATIE = ['cyyf15', 'cablu_4x15', 'cyyf25', 'cablu_5x25', 'cyyf4', 'cablu_4x4', 'cablu_5x4', 'cyyf6', 'cablu_4x6', 'cablu_5x6', 'cablu_3x10', 'cablu_4x10', 'cablu_4x16', 'cablu_5x16', 'cablu_4x240_120', 'tub20', 'doza_der_100'];

function calculeazaCantitatiInterval(startISO, endISO) {
  const cantitati = {};
  state.rapoarte.forEach(r => {
    if (r.data < startISO || r.data > endISO) return;
    r.alocari.forEach(a => {
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (!MATERIALE_SITUATIE.includes(k)) return;
        cantitati[k] = (cantitati[k] || 0) + v;
      });
    });
  });
  return cantitati;
}

function dataStartProiect() {
  // prima zi din rapoarte (totul cumulat de la început)
  const dates = state.rapoarte.map(r => r.data).sort();
  return dates[0] || todayISO();
}

function dataEndProiect() {
  // ultima zi raportată
  const dates = state.rapoarte.map(r => r.data).sort();
  return dates[dates.length - 1] || todayISO();
}

// Apartamente finalizate / în lucru până la dataEnd (din rapoarte)
function statusApartamenteLaData(endISO) {
  const stareLaData = {}; // cod -> ultima stare cronologică ≤ endISO
  state.rapoarte.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(r => {
    if (r.data > endISO) return;
    r.alocari.forEach(a => {
      if (a.stareNoua) stareLaData[a.ap] = a.stareNoua;
    });
  });
  const finalizate = Object.entries(stareLaData).filter(([, s]) => s === 'gata').map(([c]) => c).sort();
  const inLucru = Object.entries(stareLaData).filter(([, s]) => s === 'in_lucru' || s === 'blocat').map(([c]) => c).sort();
  return { finalizate, inLucru };
}

function renderSituatii() {
  const dataStart = dataStartProiect();
  const dataEnd = dataEndProiect();
  document.getElementById('sitDataEnd').textContent = fmtDate(dataEnd);

  // Preview tabel
  const cant = calculeazaCantitatiInterval(dataStart, dataEnd);
  const prev = document.getElementById('sitPreview');
  // Doar liniile cu cantitate > 0
  const linii = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id), val: cant[id] || 0 }))
    .filter(x => x.mat && x.val > 0);

  if (linii.length === 0) {
    prev.innerHTML = '<div class="empty">Nimic de raportat în acest interval</div>';
  } else {
    let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Nr.</th><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Denumire</th><th style="text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">UM</th><th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Cantitate</th></tr></thead><tbody>';
    linii.forEach((l, i) => {
      html += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6">${i + 1}</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">${l.mat.nume}</td><td style="text-align:center;padding:8px;border-bottom:1px solid #f3f4f6">${l.mat.um}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6;font-weight:700;color:#1e40af">${Math.round(l.val)}</td></tr>`;
    });
    html += '</tbody></table>';
    prev.innerHTML = html;
  }

  // Istoric
  const ist = document.getElementById('istoricSituatii');
  if (state.situatiiLucrari.length === 0) {
    ist.innerHTML = '<div class="empty">Nicio situație generată încă</div>';
  } else {
    ist.innerHTML = '';
    state.situatiiLucrari.slice().reverse().forEach(s => {
      const item = document.createElement('div');
      item.className = 'raport-item';
      const totaluri = Object.entries(s.cantitati).map(([k, v]) => {
        const m = state.materiale.find(x => x.id === k);
        return m ? `${m.nume.replace('Cablu ', '').replace(' mmp', '')}: ${v.toFixed(0)}${m.um}` : '';
      }).filter(Boolean).join(' • ');
      const nrAfisat = `${state.prefixSituatie || 'SL-2026-'}${String(s.nr).padStart(3, '0')}`;
      item.innerHTML = `
        <div class="head">
          <strong>Situație ${nrAfisat}</strong>
          <span class="info">${fmtDate(s.dataStart)} → ${fmtDate(s.dataEnd)}</span>
        </div>
        <div class="info">${totaluri}</div>
        <div class="btns">
          <button class="btn-secondary" data-sit-pdf="${s.id}">📄 PDF</button>
          <button class="btn-secondary" data-sit-excel="${s.id}">📊 Excel</button>
          <button class="btn-del" data-sit-del="${s.id}">Șterge</button>
        </div>
      `;
      item.querySelector('[data-sit-pdf]').addEventListener('click', () => genereazaSituatiePDF(s));
      item.querySelector('[data-sit-excel]').addEventListener('click', () => genereazaSituatieExcel(s));
      item.querySelector('[data-sit-del]').addEventListener('click', () => {
        if (!confirm(`Ștergi situația nr. ${s.nr}? Vei pierde înregistrarea oficială.`)) return;
        state.situatiiLucrari = state.situatiiLucrari.filter(x => x.id !== s.id);
        // Renumerotare
        state.situatiiLucrari.forEach((x, i) => { x.nr = i + 1; });
        save(); renderSituatii();
      });
      ist.appendChild(item);
    });
  }
}

function construiesteSituatieObj() {
  const dataStart = dataStartProiect();
  const dataEnd = dataEndProiect();
  const cantitati = calculeazaCantitatiInterval(dataStart, dataEnd);
  Object.keys(cantitati).forEach(k => { if (cantitati[k] === 0) delete cantitati[k]; });
  const { finalizate, inLucru } = statusApartamenteLaData(dataEnd);
  const nr = state.situatiiLucrari.length + 1;
  return {
    id: uid(), nr, data: todayISO(), dataStart, dataEnd, cantitati,
    finalizate, inLucru,
    createdAt: new Date().toISOString(),
  };
}

// Detaliu cantități per apartament (pentru intern)
function calculeazaCantitatiPerAp(startISO, endISO) {
  const perAp = {}; // cod -> { mat: {tub20: x, cyyf15: y} }
  state.rapoarte.forEach(r => {
    if (r.data < startISO || r.data > endISO) return;
    r.alocari.forEach(a => {
      if (!perAp[a.ap]) perAp[a.ap] = {};
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (!MATERIALE_SITUATIE.includes(k)) return;
        perAp[a.ap][k] = (perAp[a.ap][k] || 0) + v;
      });
    });
  });
  return perAp;
}

// Resurse umane cumulate
function calculeazaResurseInterval(startISO, endISO) {
  let persoaneZile = 0, electricieniZile = 0, sefiZile = 0;
  state.rapoarte.forEach(r => {
    if (r.data < startISO || r.data > endISO) return;
    persoaneZile += r.nrPersoane || 0;
    electricieniZile += r.nrElectricieni || 0;
    sefiZile += r.nrSefi || 0;
  });
  const oreTotal = state.prezenta
    .filter(p => p.data >= startISO && p.data <= endISO)
    .reduce((s, p) => s + (p.ore || 0), 0);
  return { persoaneZile, electricieniZile, sefiZile, oreTotal };
}

document.getElementById('btnSitGenereaza').addEventListener('click', () => {
  const s = construiesteSituatieObj();
  if (Object.keys(s.cantitati).length === 0) {
    toast('Nimic de raportat în acest interval');
    return;
  }
  const nrAfisat = `${state.prefixSituatie || 'SL-2026-'}${String(s.nr).padStart(3, '0')}`;
  if (!confirm(`Generezi Situația de lucrări ${nrAfisat} (${fmtDate(s.dataStart)} → ${fmtDate(s.dataEnd)})?\n\nIntervalul include toate datele de la începutul proiectului până la ultima zi raportată.`)) return;
  state.situatiiLucrari.push(s);
  save();
  renderSituatii();
  genereazaSituatiePDF(s);
  toast('Situație înregistrată ✓');
});

document.getElementById('btnSitPreviewPDF').addEventListener('click', () => {
  const s = construiesteSituatieObj();
  if (Object.keys(s.cantitati).length === 0) {
    toast('Nimic de raportat în acest interval');
    return;
  }
  genereazaSituatiePDF(s, true);
});

document.getElementById('btnSitExcel').addEventListener('click', () => {
  const s = construiesteSituatieObj();
  if (Object.keys(s.cantitati).length === 0) {
    toast('Nimic de raportat în acest interval');
    return;
  }
  genereazaSituatieExcel(s, true);
});

function genereazaSituatiePDF(s, isPreview = false) {
  const linii = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id), val: s.cantitati[id] || 0 }))
    .filter(x => x.mat && x.val > 0);

  // Calcul preț total per linie + total general
  let totalEur = 0;
  linii.forEach(l => {
    l.pret = l.mat.pretEur || 0;
    l.total = l.val * l.pret;
    totalEur += l.total;
  });

  const tableRows = linii.map((l, i) =>
    `<tr><td style="text-align:center">${i + 1}</td><td>${l.mat.nume}</td><td style="text-align:center">${l.mat.um}</td><td style="text-align:right;font-weight:700">${Math.round(l.val)}</td><td style="text-align:right">${l.pret.toFixed(2)}</td><td style="text-align:right;font-weight:700">${l.total.toFixed(2)}</td></tr>`
  ).join('');
  const totalRowEur = `<tr style="background:#f3f4f6;font-weight:700;font-size:13px"><td colspan="5" style="text-align:right">TOTAL EUR</td><td style="text-align:right;color:#1e40af">${totalEur.toFixed(2)}</td></tr>`;

  // Detaliu pe zile — sumar compact pentru verificare
  // Materialele utilizate (cu val > 0) — ordinea din MATERIALE_SITUATIE
  const matUtilSit = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id) }))
    .filter(x => x.mat && (s.cantitati[x.id] || 0) > 0);

  // Construiește map zi → { matId: cantitate }
  const perZi = {};
  state.rapoarte.forEach(r => {
    if (r.data < s.dataStart || r.data > s.dataEnd) return;
    r.alocari.forEach(a => {
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (!MATERIALE_SITUATIE.includes(k)) return;
        if (!perZi[r.data]) perZi[r.data] = {};
        perZi[r.data][k] = (perZi[r.data][k] || 0) + v;
      });
    });
  });
  const zileSortate = Object.keys(perZi).sort();

  // Denumiri scurte pentru header (economie de spațiu)
  function numeScurt(mat) {
    if (mat.id === 'tub20') return 'Tub';
    return mat.nume.replace('Cablu CYYF ', '').replace(' mmp', '');
  }
  const headerZilnic = `<tr><th style="text-align:left">Data</th>${matUtilSit.map(x => `<th style="text-align:right">${numeScurt(x.mat)}</th>`).join('')}</tr>`;
  const randuriZilnic = zileSortate.map(d => {
    const celule = matUtilSit.map(x => {
      const v = perZi[d][x.id] || 0;
      return `<td style="text-align:right">${v > 0 ? Math.round(v) : '—'}</td>`;
    }).join('');
    return `<tr><td>${fmtDate(d)}</td>${celule}</tr>`;
  }).join('');
  const randTotal = `<tr style="background:#f3f4f6;font-weight:700"><td>TOTAL</td>${matUtilSit.map(x => `<td style="text-align:right;color:#1e40af">${Math.round(s.cantitati[x.id] || 0)}</td>`).join('')}</tr>`;

  const tabelZilnic = zileSortate.length > 0 ? `
  <div class="page-break"></div>
  <div class="zilnic-wrap">
    <h3 style="font-size:13px;color:#1e40af;margin-top:0;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Detaliu pe zile (verificare)</h3>
    <table style="font-size:11px">
      <thead>${headerZilnic}</thead>
      <tbody>${randuriZilnic}${randTotal}</tbody>
    </table>
    <p style="font-size:10px;color:#6b7280;margin-top:2px">Toate cantitățile sunt în <b>m</b>. Suma zilnică = totalul situației.</p>
  </div>
  ` : '';

  const beneficiar = state.beneficiar || 'Kesz Electric SRL';
  const adresa = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';
  const nrSituatie = `${state.prefixSituatie || 'SL-2026-'}${String(s.nr).padStart(3, '0')}`;
  const antetFirma = `
    <div style="font-size:11px;line-height:1.5;color:#374151;margin-bottom:10px">
      <div style="font-weight:700;font-size:13px;color:#1e40af">${state.firmaNume || 'iFort Systems SRL'}</div>
      <div>${state.firmaAdresa || ''}</div>
      <div><b>CUI:</b> ${state.firmaCUI || ''} &nbsp; <b>ONRC:</b> ${state.firmaONRC || ''}</div>
      <div><b>IBAN:</b> <span style="color:#374151;text-decoration:none">${state.firmaIBAN || ''}</span></div>
    </div>`;
  const previewBadge = isPreview ? '<div style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:6px;margin-bottom:14px;font-size:13px;text-align:center"><b>PREVIEW</b> — Această situație NU este înregistrată oficial</div>' : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><meta name="x-apple-disable-message-reformatting"><title>Situatie lucrari nr ${s.nr}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
a,a:link,a:visited{color:inherit !important;text-decoration:none !important;cursor:default}
.page{background:white;padding:35px;max-width:780px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px}.header-text .company{font-size:22px;font-weight:700;color:#1e40af}.header-text .sub{font-size:13px;color:#6b7280}
.title{font-size:20px;font-weight:700;text-align:center;margin:18px 0 6px;color:#1e40af}
.subtitle{font-size:13px;color:#6b7280;text-align:center;margin-bottom:22px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:18px;font-size:14px}
.info-grid b{color:#1e40af}
table{width:100%;border-collapse:collapse;margin:10px 0 20px}
th,td{padding:10px 12px;border:1px solid #d1d5db;font-size:14px}
th{background:#1e40af;color:white;text-align:left;font-weight:600}
tfoot td{background:#f3f4f6;font-weight:700;font-size:15px}
.semnaturi{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:60px}
.semnaturi .sem{text-align:center}
.semnaturi .sem-titlu{font-weight:600;margin-bottom:60px;font-size:13px}
.semnaturi .sem-linie{border-top:1px solid #6b7280;padding-top:6px;font-size:12px;color:#6b7280}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:100}
.page-break{display:block;page-break-before:always;break-before:page;height:0;overflow:hidden}
.zilnic-wrap{page-break-before:always;break-before:page}
@media screen{.page-break{display:none}.zilnic-wrap{page-break-before:auto;break-before:auto;margin-top:14px}}
@media print{
  @page{size:A4 portrait;margin:10mm}
  html,body{background:white}
  body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{margin:0;padding:0;box-shadow:none;max-width:100%;width:100%}
  .no-print{display:none}
  .header{padding-bottom:6px;margin-bottom:8px}
  .header .logo{width:55px}
  .title{font-size:16px;margin:6px 0 2px}
  .subtitle{font-size:11px;margin-bottom:8px}
  .info-grid{padding:8px 10px;margin-bottom:10px;font-size:11px;gap:4px 14px}
  table{margin:4px 0 8px;page-break-inside:auto}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th,td{padding:4px 8px;font-size:10px}
  h3{font-size:12px;margin-top:8px;margin-bottom:3px;page-break-after:avoid}
  p{font-size:11px;line-height:1.4;margin:3px 0}
  .semnaturi{margin-top:14px;gap:30px;page-break-inside:avoid}
  .semnaturi .sem-titlu{margin-bottom:30px;font-size:11px}
  .semnaturi .sem-linie{font-size:10px;padding-top:3px}
  .footer{margin-top:10px;padding-top:6px;font-size:9px}
}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  ${previewBadge}
  <div class="header" style="align-items:flex-start"><img src="logo.png" class="logo" />${antetFirma}</div>

  <div class="title">SITUAȚIE DE LUCRĂRI nr. ${nrSituatie} / ${fmtDate(s.data)}</div>
  <div class="subtitle">Lucrări executate — instalații electrice apartamente</div>

  <div class="info-grid">
    <div><b>Beneficiar:</b> ${beneficiar}</div>
    <div><b>Executant:</b> iFort Systems S.R.L.</div>
    <div style="grid-column:1/-1"><b>Adresa obiectiv:</b> ${adresa}</div>
    <div style="grid-column:1/-1"><b>Perioada:</b> ${fmtDate(s.dataStart)} — ${fmtDate(s.dataEnd)}</div>
  </div>

  <h3 style="font-size:14px;color:#1e40af;margin-top:8px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Cantități executate de iFort Systems SRL în perioada raportată</h3>
  <table>
    <thead>
      <tr><th style="width:40px;text-align:center">Nr.</th><th>Denumire material</th><th style="width:50px;text-align:center">UM</th><th style="width:100px;text-align:right">Cantitate</th><th style="width:90px;text-align:right">Preț unitar (EUR)</th><th style="width:100px;text-align:right">Preț total (EUR)</th></tr>
    </thead>
    <tbody>${tableRows}${totalRowEur}</tbody>
  </table>

  ${tabelZilnic}

  <h3 style="font-size:14px;color:#1e40af;margin-top:18px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Apartamente finalizate (${(s.finalizate || []).length})</h3>
  <p style="font-size:13px;line-height:1.7;margin:6px 0">${(s.finalizate || []).length > 0 ? s.finalizate.join(', ') : '<i style="color:#9ca3af">Niciun apartament finalizat</i>'}</p>

  <h3 style="font-size:14px;color:#92400e;margin-top:14px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Apartamente în lucru (${(s.inLucru || []).length})</h3>
  <p style="font-size:13px;line-height:1.7;margin:6px 0">${(s.inLucru || []).length > 0 ? s.inLucru.join(', ') : '<i style="color:#9ca3af">Niciun apartament în lucru</i>'}</p>

  <div class="semnaturi">
    <div class="sem">
      <div class="sem-titlu">EXECUTANT<br>${state.firmaNume || 'iFort Systems SRL'}</div>
      <div class="sem-linie">Semnătură / Ștampilă</div>
    </div>
    <div class="sem">
      <div class="sem-titlu">BENEFICIAR<br>${beneficiar}</div>
      <div class="sem-linie">Semnătură / Ștampilă</div>
    </div>
  </div>

  <div class="footer">Document generat — ${state.firmaNume || 'iFort Systems SRL'} — ${fmtDate(s.data)}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

function genereazaSituatieExcel(s, isPreview = false) {
  const linii = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id), val: s.cantitati[id] || 0 }))
    .filter(x => x.mat && x.val > 0);

  const beneficiar = state.beneficiar || 'Kesz Electric SRL';
  const adresa = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';
  const nrSit = `${state.prefixSituatie || 'SL-2026-'}${String(s.nr).padStart(3, '0')}`;

  // Format CSV cu BOM pentru Excel (caractere RO)
  let csv = '﻿';
  csv += `Situație de lucrări nr. ${nrSit} / ${fmtDate(s.data)}\n`;
  csv += `Executant:,"${state.firmaNume || 'iFort Systems SRL'}"\n`;
  csv += `Adresa executant:,"${state.firmaAdresa || ''}"\n`;
  csv += `CUI:,${state.firmaCUI || ''},ONRC:,${state.firmaONRC || ''}\n`;
  csv += `IBAN:,${state.firmaIBAN || ''}\n`;
  csv += `Beneficiar:,"${beneficiar}"\n`;
  csv += `Adresa obiectiv:,"${adresa}"\n`;
  csv += `Perioada:,${fmtDate(s.dataStart)} - ${fmtDate(s.dataEnd)}\n`;
  csv += `\n`;
  csv += `Nr.,Denumire,UM,Cantitate,Pret unitar (EUR),Pret total (EUR)\n`;
  let totalEur = 0;
  linii.forEach((l, i) => {
    const pret = l.mat.pretEur || 0;
    const total = l.val * pret;
    totalEur += total;
    csv += `${i + 1},"${l.mat.nume}",${l.mat.um},${Math.round(l.val)},${pret.toFixed(2)},${total.toFixed(2)}\n`;
  });
  csv += `,,,,TOTAL EUR,${totalEur.toFixed(2)}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const suffix = isPreview ? '-preview' : '';
  a.href = url; a.download = `situatie-lucrari-nr-${s.nr}${suffix}-${s.data}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Excel descărcat ✓');
}

// ============= SITUAȚIE INTERN =============
function genereazaSituatieInternPDF() {
  const dataStart = dataStartProiect();
  const dataEnd = dataEndProiect();
  if (state.rapoarte.length === 0) { toast('Niciun raport pentru situație'); return; }
  const cantitati = calculeazaCantitatiInterval(dataStart, dataEnd);
  const { finalizate, inLucru } = statusApartamenteLaData(dataEnd);
  const perAp = calculeazaCantitatiPerAp(dataStart, dataEnd);
  const resurse = calculeazaResurseInterval(dataStart, dataEnd);
  const beneficiar = state.beneficiar || 'Kesz Electric SRL';
  const adresa = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';

  const linii = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id), val: cantitati[id] || 0 }))
    .filter(x => x.mat && x.val > 0);

  let totalEur = 0;
  const tableRows = linii.map((l, i) => {
    const pret = l.mat.pretEur || 0;
    const total = l.val * pret;
    totalEur += total;
    return `<tr><td style="text-align:center">${i + 1}</td><td>${l.mat.nume}</td><td style="text-align:center">${l.mat.um}</td><td style="text-align:right;font-weight:700">${Math.round(l.val)}</td><td style="text-align:right">${pret.toFixed(2)}</td><td style="text-align:right;font-weight:700">${total.toFixed(2)}</td></tr>`;
  }).join('');
  const totalRowEur = `<tr style="background:#f3f4f6;font-weight:700;font-size:13px"><td colspan="5" style="text-align:right">TOTAL EUR</td><td style="text-align:right;color:#1e40af">${totalEur.toFixed(2)}</td></tr>`;

  // Tabel detaliu per apartament
  const materialeUtilizate = MATERIALE_SITUATIE.filter(id => cantitati[id] > 0);
  const headerDetaliuMat = materialeUtilizate.map(id => {
    const m = state.materiale.find(x => x.id === id);
    return `<th style="text-align:right;font-size:11px">${m ? m.nume.replace('Cablu ', '').replace(' mmp', '').replace('Tub PVC ', '') : id}</th>`;
  }).join('');
  const codSortati = Object.keys(perAp).sort();
  const detaliuRows = codSortati.map(cod => {
    const ap = state.apartamente.find(x => x.cod === cod);
    const tip = ap ? ap.tip : '—';
    const stareLetra = finalizate.includes(cod) ? '🟢' : (inLucru.includes(cod) ? '🟡' : '⚪');
    const celule = materialeUtilizate.map(id => {
      const v = perAp[cod][id] || 0;
      return `<td style="text-align:right;font-size:12px">${v > 0 ? v.toFixed(1) : '—'}</td>`;
    }).join('');
    return `<tr><td style="font-size:12px">${stareLetra} <b>${cod}</b></td><td style="font-size:11px;color:#6b7280">${tip}</td>${celule}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><title>Situatie INTERN ${fmtDate(dataEnd)}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
.page{background:white;padding:35px;max-width:900px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:18px}
.header .logo{width:80px}.header-text .company{font-size:22px;font-weight:700;color:#1e40af}.header-text .sub{font-size:13px;color:#6b7280}
.intern-badge{background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:6px;font-weight:600;font-size:13px;text-align:center;margin-bottom:14px;display:inline-block}
.title{font-size:20px;font-weight:700;text-align:center;margin:10px 0 6px;color:#1e40af}
.subtitle{font-size:13px;color:#6b7280;text-align:center;margin-bottom:18px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:18px;font-size:14px}
.info-grid b{color:#1e40af}
h2{font-size:14px;color:#1e40af;margin-top:22px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin:8px 0 14px}
th,td{padding:8px 10px;border:1px solid #d1d5db;font-size:13px}
th{background:#1e40af;color:white;text-align:left;font-weight:600}
.lista-ap{font-size:13px;line-height:1.7;margin:6px 0}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:100}
@media print{body{background:white}.page{margin:0;box-shadow:none}.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>
<div class="page">
  <div class="intern-badge">🔒 DOCUMENT INTERN — NU PENTRU BENEFICIAR</div>
  <div class="header" style="align-items:flex-start"><img src="logo.png" class="logo" />
    <div style="font-size:11px;line-height:1.5;color:#374151">
      <div style="font-weight:700;font-size:13px;color:#1e40af">${state.firmaNume || 'iFort Systems SRL'}</div>
      <div>${state.firmaAdresa || ''}</div>
      <div><b>CUI:</b> ${state.firmaCUI || ''} &nbsp; <b>ONRC:</b> ${state.firmaONRC || ''}</div>
      <div><b>IBAN:</b> ${state.firmaIBAN || ''}</div>
    </div>
  </div>

  <div class="title">SITUAȚIE INTERNĂ DE LUCRĂRI</div>
  <div class="subtitle">Generată: ${fmtDate(todayISO())}</div>

  <div class="info-grid">
    <div><b>Beneficiar:</b> ${beneficiar}</div>
    <div><b>Executant:</b> iFort Systems S.R.L.</div>
    <div style="grid-column:1/-1"><b>Adresa obiectiv:</b> ${adresa}</div>
    <div style="grid-column:1/-1"><b>Perioada:</b> ${fmtDate(dataStart)} — ${fmtDate(dataEnd)}</div>
  </div>

  <h2>1. Total cantități executate de iFort Systems SRL</h2>
  <table>
    <thead><tr><th style="width:40px;text-align:center">Nr.</th><th>Denumire material</th><th style="width:50px;text-align:center">UM</th><th style="width:80px;text-align:right">Cantitate</th><th style="width:80px;text-align:right">Preț unitar (EUR)</th><th style="width:90px;text-align:right">Preț total (EUR)</th></tr></thead>
    <tbody>${tableRows}${totalRowEur}</tbody>
  </table>

  <h2>2. Detaliu cantități per apartament</h2>
  <table>
    <thead><tr><th style="font-size:11px">Apartament</th><th style="font-size:11px">Tip</th>${headerDetaliuMat}</tr></thead>
    <tbody>${detaliuRows || `<tr><td colspan="${materialeUtilizate.length + 2}" style="text-align:center;color:#9ca3af">Niciun detaliu</td></tr>`}</tbody>
  </table>
  <p class="small" style="font-size:11px;color:#6b7280">🟢 Finalizat • 🟡 În lucru • ⚪ Alt status</p>

  <h2>3. Apartamente finalizate (${finalizate.length})</h2>
  <p class="lista-ap">${finalizate.length > 0 ? finalizate.join(', ') : '<i style="color:#9ca3af">Niciunul</i>'}</p>

  <h2>4. Apartamente în lucru (${inLucru.length})</h2>
  <p class="lista-ap">${inLucru.length > 0 ? inLucru.join(', ') : '<i style="color:#9ca3af">Niciunul</i>'}</p>

  <h2>5. Resurse umane cumulate</h2>
  <table>
    <thead><tr><th>Indicator</th><th style="text-align:right;width:160px">Valoare</th></tr></thead>
    <tbody>
      <tr><td>Persoane-zile (total)</td><td style="text-align:right;font-weight:700">${resurse.persoaneZile}</td></tr>
      <tr><td>din care Electricieni-zile</td><td style="text-align:right;font-weight:700">${resurse.electricieniZile}</td></tr>
      <tr><td>din care Șefi de echipă-zile</td><td style="text-align:right;font-weight:700">${resurse.sefiZile}</td></tr>
      <tr><td>Ore pontaj total</td><td style="text-align:right;font-weight:700">${resurse.oreTotal.toFixed(1)} h</td></tr>
    </tbody>
  </table>

  <div class="footer">Document intern — ${state.firmaNume || 'iFort Systems SRL'} — ${fmtDate(todayISO())}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

function genereazaSituatieInternExcel() {
  const dataStart = dataStartProiect();
  const dataEnd = dataEndProiect();
  if (state.rapoarte.length === 0) { toast('Niciun raport pentru situație'); return; }
  const cantitati = calculeazaCantitatiInterval(dataStart, dataEnd);
  const { finalizate, inLucru } = statusApartamenteLaData(dataEnd);
  const perAp = calculeazaCantitatiPerAp(dataStart, dataEnd);
  const resurse = calculeazaResurseInterval(dataStart, dataEnd);
  const beneficiar = state.beneficiar || 'Kesz Electric SRL';
  const adresa = state.adresaObiectiv || 'Str. Coralilor, nr 83-87, Sector 1, București';

  let csv = '﻿';
  csv += `SITUAȚIE INTERNĂ DE LUCRĂRI\n`;
  csv += `Executant:,"${state.firmaNume || 'iFort Systems SRL'}"\n`;
  csv += `Adresa executant:,"${state.firmaAdresa || ''}"\n`;
  csv += `CUI:,${state.firmaCUI || ''},ONRC:,${state.firmaONRC || ''}\n`;
  csv += `IBAN:,${state.firmaIBAN || ''}\n`;
  csv += `Beneficiar:,"${beneficiar}"\n`;
  csv += `Adresa obiectiv:,"${adresa}"\n`;
  csv += `Perioada:,${fmtDate(dataStart)} - ${fmtDate(dataEnd)}\n\n`;

  csv += `1. Total cantitati executate\n`;
  csv += `Nr.,Denumire,UM,Cantitate,Pret unitar (EUR),Pret total (EUR)\n`;
  const linii = MATERIALE_SITUATIE
    .map(id => ({ id, mat: state.materiale.find(m => m.id === id), val: cantitati[id] || 0 }))
    .filter(x => x.mat && x.val > 0);
  let totalEurInt = 0;
  linii.forEach((l, i) => {
    const pret = l.mat.pretEur || 0;
    const total = l.val * pret;
    totalEurInt += total;
    csv += `${i + 1},"${l.mat.nume}",${l.mat.um},${Math.round(l.val)},${pret.toFixed(2)},${total.toFixed(2)}\n`;
  });
  csv += `,,,,TOTAL EUR,${totalEurInt.toFixed(2)}\n`;
  csv += `\n`;

  csv += `2. Detaliu per apartament\n`;
  const matUtil = MATERIALE_SITUATIE.filter(id => cantitati[id] > 0);
  csv += `Apartament,Tip,Stare,${matUtil.map(id => {
    const m = state.materiale.find(x => x.id === id);
    return `"${m.nume} (${m.um})"`;
  }).join(',')}\n`;
  Object.keys(perAp).sort().forEach(cod => {
    const ap = state.apartamente.find(x => x.cod === cod);
    const stare = finalizate.includes(cod) ? 'Finalizat' : (inLucru.includes(cod) ? 'In lucru' : 'Alta');
    const celule = matUtil.map(id => (perAp[cod][id] || 0).toFixed(2)).join(',');
    csv += `"${cod}","${ap ? ap.tip : '-'}",${stare},${celule}\n`;
  });
  csv += `\n`;

  csv += `3. Apartamente finalizate (${finalizate.length})\n`;
  csv += `"${finalizate.join(', ')}"\n\n`;

  csv += `4. Apartamente in lucru (${inLucru.length})\n`;
  csv += `"${inLucru.join(', ')}"\n\n`;

  csv += `5. Resurse umane cumulate\n`;
  csv += `Persoane-zile total,${resurse.persoaneZile}\n`;
  csv += `Electricieni-zile,${resurse.electricieniZile}\n`;
  csv += `Sefi de echipa-zile,${resurse.sefiZile}\n`;
  csv += `Ore pontaj total,${resurse.oreTotal.toFixed(1)}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `situatie-INTERN-${dataEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Excel intern descărcat ✓');
}

document.getElementById('btnSitInternPDF').addEventListener('click', genereazaSituatieInternPDF);
document.getElementById('btnSitInternExcel').addEventListener('click', genereazaSituatieInternExcel);

// ============= ANALIZĂ — Dashboard focusat =============
let analizaPerioada = { start: null, end: null };

function setPerioadaAnaliza(tip) {
  const azi = todayISO();
  if (tip === 'ultima-situatie') {
    if (state.situatiiLucrari.length > 0) {
      const u = state.situatiiLucrari[state.situatiiLucrari.length - 1];
      analizaPerioada = { start: u.dataStart, end: u.dataEnd };
    } else {
      analizaPerioada = { start: dataStartProiect(), end: dataEndProiect() };
    }
  } else if (tip === 'tot') {
    analizaPerioada = { start: dataStartProiect(), end: dataEndProiect() };
  } else if (tip === 'saptamana') {
    const d = new Date(azi); d.setDate(d.getDate() - 6);
    analizaPerioada = { start: d.toISOString().slice(0, 10), end: azi };
  } else if (tip === 'luna') {
    const d = new Date(azi); d.setMonth(d.getMonth() - 1);
    analizaPerioada = { start: d.toISOString().slice(0, 10), end: azi };
  }
  document.getElementById('analizaStart').value = analizaPerioada.start;
  document.getElementById('analizaEnd').value = analizaPerioada.end;
}

function renderAnaliza() {
  // Default = ultima situație
  if (!analizaPerioada.start) setPerioadaAnaliza('ultima-situatie');

  const s = document.getElementById('analizaStart').value || analizaPerioada.start;
  const e = document.getElementById('analizaEnd').value || analizaPerioada.end;
  analizaPerioada = { start: s, end: e };

  document.getElementById('analizaInfoPerioada').innerHTML =
    `Perioadă selectată: <b>${fmtDate(s)} — ${fmtDate(e)}</b>`;

  renderAnalizaCifre(s, e);
  renderAnalizaGrafic(s, e);
  renderAnalizaTabelZilnic(s, e);
  renderAnalizaApartamente(s, e);
  renderAnalizaTipuri(s, e);
}

document.querySelectorAll('[data-perioada]').forEach(btn => {
  btn.addEventListener('click', () => {
    setPerioadaAnaliza(btn.dataset.perioada);
    renderAnaliza();
  });
});
document.getElementById('analizaStart').addEventListener('change', renderAnaliza);
document.getElementById('analizaEnd').addEventListener('change', renderAnaliza);

// Medii istorice pe TOT proiectul (pentru benchmark scor)
function calculeazaMediileIstorice() {
  let totalTub = 0, totalCablu = 0, totalEl = 0, totalZile = 0;
  let totalMpLucrat = 0, totalMatPeMp = 0, contZileCuMp = 0;
  const zileLucrate = new Set();
  let nrFinalizariTotal = 0;

  state.rapoarte.forEach(r => {
    zileLucrate.add(r.data);
    totalEl += r.nrElectricieni || 0;
    let mpZi = 0, matZi = 0;
    r.alocari.forEach(a => {
      if (a.stareNoua === 'gata') nrFinalizariTotal++;
      const ap = state.apartamente.find(x => x.cod === a.ap);
      const mpAp = ap?.mp || 0;
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (k === 'tub20') { totalTub += v; matZi += v; }
        else if (k.startsWith('cyyf') || k === 'cablu_4x15') { totalCablu += v; matZi += v; }
      });
      if (mpAp > 0) mpZi += mpAp;
    });
    if (mpZi > 0 && matZi > 0) {
      totalMpLucrat += mpZi;
      totalMatPeMp += matZi;
      contZileCuMp++;
    }
  });
  totalZile = zileLucrate.size;

  return {
    mPerElectricianZi: totalEl ? (totalTub + totalCablu) / totalEl : 0,
    tubPerElectricianZi: totalEl ? totalTub / totalEl : 0,
    cabluPerElectricianZi: totalEl ? totalCablu / totalEl : 0,
    mPerMp: totalMpLucrat ? totalMatPeMp / totalMpLucrat : 0,
    zileTotal: totalZile,
    mediaElPerZi: totalZile ? totalEl / totalZile : 0,
    nrFinalizariTotal,
  };
}

function colectDateAnaliza(startISO, endISO) {
  // Returnează agregare completă pentru perioada dată
  const perZi = {}; // data -> { tub, cablu, electricieni, persoane, sefi, ap: Set }
  const perApart = {}; // cod -> { tub, cablu, oameni, zile: Set }
  let totalTub = 0, totalCablu = 0, totalEl = 0, totalPers = 0, totalSefi = 0;
  const apsAtinse = new Set(), apsFinalizate = new Set(), apsStartate = new Set();

  state.rapoarte.forEach(r => {
    if (r.data < startISO || r.data > endISO) return;
    if (!perZi[r.data]) perZi[r.data] = { tub: 0, cablu: 0, electricieni: 0, persoane: 0, sefi: 0, ap: new Set() };
    perZi[r.data].electricieni += r.nrElectricieni || 0;
    perZi[r.data].persoane += r.nrPersoane || 0;
    perZi[r.data].sefi += r.nrSefi || 0;
    totalEl += r.nrElectricieni || 0;
    totalPers += r.nrPersoane || 0;
    totalSefi += r.nrSefi || 0;

    r.alocari.forEach(a => {
      apsAtinse.add(a.ap);
      perZi[r.data].ap.add(a.ap);
      if (!perApart[a.ap]) perApart[a.ap] = { tub: 0, cablu: 0, oameni: 0, zile: new Set(), stareFinala: null };
      perApart[a.ap].oameni += a.oameni || 0;
      perApart[a.ap].zile.add(r.data);
      if (a.stareNoua) perApart[a.ap].stareFinala = a.stareNoua;
      Object.entries(a.materiale || {}).forEach(([k, v]) => {
        if (k === 'tub20') { perZi[r.data].tub += v; totalTub += v; perApart[a.ap].tub += v; }
        else if (k.startsWith('cyyf') || k === 'cablu_4x15') { perZi[r.data].cablu += v; totalCablu += v; perApart[a.ap].cablu += v; }
      });
    });
  });

  // Apartamentele "Gata": determinăm starea REALĂ din state.apartamente + toate rapoartele
  // (nu doar din alocările perioadei selectate)
  apsAtinse.forEach(cod => {
    const ap = state.apartamente.find(x => x.cod === cod);
    // Prioritate 1: state.apartamente[].stare (sursa adevărului — setat la salvare/edit raport/manual)
    if (ap && ap.stare === 'gata') {
      apsFinalizate.add(cod);
      if (perApart[cod]) perApart[cod].stareFinala = 'gata';
      return;
    }
    // Prioritate 2: ultima stareNoua din TOATE rapoartele (sortate cronologic)
    let ultimaStare = null;
    state.rapoarte.slice().sort((a, b) => a.data.localeCompare(b.data) || (a.createdAt || '').localeCompare(b.createdAt || '')).forEach(r => {
      r.alocari.forEach(a => {
        if (a.ap === cod && a.stareNoua) ultimaStare = a.stareNoua;
      });
    });
    if (ultimaStare === 'gata') {
      apsFinalizate.add(cod);
      if (perApart[cod]) perApart[cod].stareFinala = 'gata';
    } else if (perApart[cod]) {
      // Suprascrie stareFinala din perioada selectata cu cea cronologic ultima
      perApart[cod].stareFinala = ultimaStare || (ap?.stare) || perApart[cod].stareFinala;
    }
  });

  // Ore pontaj în perioadă
  const orePontaj = state.prezenta
    .filter(p => p.data >= startISO && p.data <= endISO)
    .reduce((s, p) => s + (p.ore || 0), 0);

  return { perZi, perApart, totalTub, totalCablu, totalEl, totalPers, totalSefi, orePontaj, apsAtinse, apsFinalizate };
}

function renderAnalizaCifre(startISO, endISO) {
  const cont = document.getElementById('analizaCifre');
  const d = colectDateAnaliza(startISO, endISO);
  const zile = Object.keys(d.perZi).length;
  if (zile === 0) { cont.innerHTML = '<div class="empty">Niciun raport în perioadă</div>'; return; }

  const tubMed = d.totalEl ? (d.totalTub / d.totalEl) : 0;
  const cabluMed = d.totalEl ? (d.totalCablu / d.totalEl) : 0;
  const mPerOra = d.orePontaj ? ((d.totalTub + d.totalCablu) / d.orePontaj) : 0;

  cont.innerHTML = `
    <div class="prod-card" style="border-left-color:#1e40af"><div class="nume">Tub total</div><div><span class="val-mare">${Math.round(d.totalTub)}</span><span class="um">m</span></div><div class="recent"><span>${tubMed.toFixed(1)} m/electrician-zi</span></div></div>
    <div class="prod-card" style="border-left-color:#10b981"><div class="nume">Cabluri total</div><div><span class="val-mare">${Math.round(d.totalCablu)}</span><span class="um">m</span></div><div class="recent"><span>${cabluMed.toFixed(1)} m/electrician-zi</span></div></div>
    <div class="prod-card" style="border-left-color:#f59e0b"><div class="nume">Zile lucrate</div><div><span class="val-mare">${zile}</span><span class="um">zile</span></div></div>
    <div class="prod-card" style="border-left-color:#8b5cf6"><div class="nume">Electricieni-zile</div><div><span class="val-mare">${d.totalEl}</span><span class="um">om-zi</span></div><div class="recent"><span>Medie/zi: ${(d.totalEl/zile).toFixed(1)}</span></div></div>
    <div class="prod-card" style="border-left-color:#06b6d4"><div class="nume">Apartamente</div><div><span class="val-mare">${d.apsFinalizate.size}/${state.apartamente.length}</span><span class="um">finalizate</span></div><div class="recent"><span>Atinse în perioadă: ${d.apsAtinse.size}</span></div></div>
  `;
}

function renderAnalizaGrafic(startISO, endISO) {
  const cont = document.getElementById('analizaGrafic');
  const d = colectDateAnaliza(startISO, endISO);
  const zile = Object.keys(d.perZi).sort();
  if (zile.length === 0) { cont.innerHTML = '<div class="empty">Niciun raport</div>'; return; }

  const tub = zile.map(z => d.perZi[z].tub);
  const cablu = zile.map(z => d.perZi[z].cablu);
  const el = zile.map(z => d.perZi[z].electricieni);
  const maxMat = Math.max(...tub, ...cablu, 1);
  const maxEl = Math.max(...el, 1);

  const W = Math.max(700, zile.length * 60);
  const H = 240;
  const margin = { top: 20, right: 50, bottom: 50, left: 50 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  function x(i) { return margin.left + (zile.length === 1 ? innerW / 2 : (i / (zile.length - 1)) * innerW); }
  function yMat(v) { return margin.top + innerH - (v / maxMat) * innerH; }
  function yEl(v) { return margin.top + innerH - (v / maxEl) * innerH; }

  function path(values, mapY) {
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${mapY(v).toFixed(1)}`).join(' ');
  }

  // Axa Y stânga (material)
  let yAxis = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxMat * i / 4);
    const py = yMat(v);
    yAxis += `<line x1="${margin.left}" y1="${py}" x2="${margin.left + innerW}" y2="${py}" stroke="#f3f4f6" stroke-dasharray="2"/>`;
    yAxis += `<text x="${margin.left - 5}" y="${py + 3}" font-size="9" fill="#9ca3af" text-anchor="end">${Math.round(v)}</text>`;
  }
  // Axa Y dreapta (electricieni)
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(maxEl * i / 4);
    const py = yEl(v);
    yAxis += `<text x="${margin.left + innerW + 5}" y="${py + 3}" font-size="9" fill="#f59e0b" text-anchor="start">${v}</text>`;
  }
  // Axa X (date)
  let xAxis = '';
  zile.forEach((z, i) => {
    if (zile.length <= 14 || i % Math.ceil(zile.length / 10) === 0) {
      const xx = x(i);
      const lbl = z.slice(5).replace('-', '/');
      xAxis += `<text x="${xx}" y="${margin.top + innerH + 14}" font-size="9" fill="#6b7280" text-anchor="middle" transform="rotate(-25 ${xx} ${margin.top + innerH + 14})">${lbl}</text>`;
      xAxis += `<line x1="${xx}" y1="${margin.top + innerH}" x2="${xx}" y2="${margin.top + innerH + 3}" stroke="#9ca3af"/>`;
    }
  });

  // Puncte
  let dotsTub = zile.map((_, i) => `<circle cx="${x(i)}" cy="${yMat(tub[i])}" r="2.5" fill="#1e40af"/>`).join('');
  let dotsCablu = zile.map((_, i) => `<circle cx="${x(i)}" cy="${yMat(cablu[i])}" r="2.5" fill="#10b981"/>`).join('');
  let dotsEl = zile.map((_, i) => `<circle cx="${x(i)}" cy="${yEl(el[i])}" r="2.5" fill="#f59e0b"/>`).join('');

  cont.innerHTML = `
    <svg width="${W}" height="${H}" style="display:block;min-width:100%">
      ${yAxis}
      <path d="${path(tub, yMat)}" stroke="#1e40af" stroke-width="2" fill="none"/>
      <path d="${path(cablu, yMat)}" stroke="#10b981" stroke-width="2" fill="none"/>
      <path d="${path(el, yEl)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 2" fill="none"/>
      ${dotsTub}${dotsCablu}${dotsEl}
      ${xAxis}
      <text x="10" y="14" font-size="10" fill="#1e40af" font-weight="600">m (tub/cablu)</text>
      <text x="${W - 10}" y="14" font-size="10" fill="#f59e0b" font-weight="600" text-anchor="end">electricieni</text>
    </svg>
  `;
}

function renderAnalizaTabelZilnic(startISO, endISO) {
  const cont = document.getElementById('analizaTabelZilnic');
  const d = colectDateAnaliza(startISO, endISO);
  const zile = Object.keys(d.perZi).sort();
  if (zile.length === 0) { cont.innerHTML = '<div class="empty">Niciun raport</div>'; return; }

  // Eficiența medie
  const mediiTub = d.totalEl ? d.totalTub / d.totalEl : 0;
  const mediiCablu = d.totalEl ? d.totalCablu / d.totalEl : 0;

  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
  html += '<th style="text-align:left;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Data</th>';
  html += '<th style="text-align:right;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">El.</th>';
  html += '<th style="text-align:right;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Tub (m)</th>';
  html += '<th style="text-align:right;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Cablu (m)</th>';
  html += '<th style="text-align:right;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Tub/el</th>';
  html += '<th style="text-align:right;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Cablu/el</th>';
  html += '<th style="text-align:center;padding:8px;font-size:11px;border-bottom:1px solid #e5e7eb">Eficiență</th>';
  html += '</tr></thead><tbody>';

  zile.forEach(z => {
    const zi = d.perZi[z];
    const tubEl = zi.electricieni ? zi.tub / zi.electricieni : 0;
    const cabluEl = zi.electricieni ? zi.cablu / zi.electricieni : 0;
    const eff = (tubEl + cabluEl) / (mediiTub + mediiCablu || 1);
    let efIcon = '→', efCol = '#6b7280';
    if (eff > 1.15) { efIcon = '↑↑'; efCol = '#10b981'; }
    else if (eff > 1.05) { efIcon = '↑'; efCol = '#10b981'; }
    else if (eff < 0.85) { efIcon = '↓↓'; efCol = '#dc2626'; }
    else if (eff < 0.95) { efIcon = '↓'; efCol = '#dc2626'; }
    html += `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:12px"><b>${fmtDate(z)}</b></td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px">${zi.electricieni}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px">${Math.round(zi.tub)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px">${Math.round(zi.cablu)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px">${tubEl.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px">${cabluEl.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:700;color:${efCol}">${efIcon} ${(eff * 100).toFixed(0)}%</td>
    </tr>`;
  });
  // Totaluri
  html += `<tr style="background:#f9fafb;font-weight:700">
    <td style="padding:8px">TOTAL / MEDIA</td>
    <td style="padding:8px;text-align:right">${d.totalEl}</td>
    <td style="padding:8px;text-align:right;color:#1e40af">${Math.round(d.totalTub)}</td>
    <td style="padding:8px;text-align:right;color:#10b981">${Math.round(d.totalCablu)}</td>
    <td style="padding:8px;text-align:right">${mediiTub.toFixed(1)}</td>
    <td style="padding:8px;text-align:right">${mediiCablu.toFixed(1)}</td>
    <td style="padding:8px;text-align:center">—</td>
  </tr>`;
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function renderAnalizaApartamente(startISO, endISO) {
  const cont = document.getElementById('analizaApartamente');
  const d = colectDateAnaliza(startISO, endISO);
  const coduri = Object.keys(d.perApart).sort();
  if (coduri.length === 0) { cont.innerHTML = '<div class="empty">Nicio activitate per apartament</div>'; return; }

  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
  ['Cod', 'Tip', 'mp', 'Stare', 'Zile lucru', 'Tub (m)', 'Cablu (m)', 'Tub/mp', 'Cablu/mp', 'Om-zile'].forEach(h =>
    html += `<th style="text-align:left;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${h}</th>`);
  html += '</tr></thead><tbody>';

  coduri.forEach(cod => {
    const ap = state.apartamente.find(x => x.cod === cod);
    const tip = ap ? ap.tip : '—';
    const mp = ap?.mp || null;
    const a = d.perApart[cod];
    const stareIcon = a.stareFinala === 'gata' ? '🟢' : (a.stareFinala === 'blocat' ? '🔴' : '🟡');
    html += `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600">${stareIcon} ${cod}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">${tip}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right">${mp || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px">${{gata:'Gata',in_lucru:'În lucru',blocat:'Blocat'}[a.stareFinala] || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right">${a.zile.size}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right;color:#1e40af">${Math.round(a.tub)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right;color:#10b981">${Math.round(a.cablu)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right">${mp ? (a.tub / mp).toFixed(2) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right">${mp ? (a.cablu / mp).toFixed(2) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right">${a.oameni}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function renderAnalizaTipuri(startISO, endISO) {
  const cont = document.getElementById('analizaTipuri');
  const d = colectDateAnaliza(startISO, endISO);

  const perTip = {};
  Object.entries(d.perApart).forEach(([cod, a]) => {
    const ap = state.apartamente.find(x => x.cod === cod);
    if (!ap) return;
    if (!perTip[ap.tip]) perTip[ap.tip] = { aps: [], totalMp: 0, totalTub: 0, totalCablu: 0, totalOameni: 0, totalZile: new Set() };
    perTip[ap.tip].aps.push(cod);
    if (ap.mp) perTip[ap.tip].totalMp += ap.mp;
    perTip[ap.tip].totalTub += a.tub;
    perTip[ap.tip].totalCablu += a.cablu;
    perTip[ap.tip].totalOameni += a.oameni;
    a.zile.forEach(z => perTip[ap.tip].totalZile.add(z));
  });

  if (Object.keys(perTip).length === 0) { cont.innerHTML = '<div class="empty">Nicio activitate</div>'; return; }

  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
  ['Tip', 'Nr. ap', 'Total mp', 'Tub/ap', 'Cablu/ap', 'Tub/mp', 'Cablu/mp', 'Om-zi/ap'].forEach(h =>
    html += `<th style="text-align:left;padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${h}</th>`);
  html += '</tr></thead><tbody>';

  TIPURI_AP.forEach(tip => {
    const t = perTip[tip];
    if (!t) return;
    const n = t.aps.length;
    html += `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1e40af">${tip}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${n}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${t.totalMp ? t.totalMp.toFixed(0) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;color:#1e40af">${(t.totalTub / n).toFixed(0)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;color:#10b981">${(t.totalCablu / n).toFixed(0)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${t.totalMp ? (t.totalTub / t.totalMp).toFixed(2) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${t.totalMp ? (t.totalCablu / t.totalMp).toFixed(2) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${(t.totalOameni / n).toFixed(1)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

// ============= PDF Analiză =============
function genereazaAnalizaPDF() {
  const startISO = analizaPerioada.start || dataStartProiect();
  const endISO = analizaPerioada.end || dataEndProiect();
  const d = colectDateAnaliza(startISO, endISO);
  const zile = Object.keys(d.perZi).sort();
  if (zile.length === 0) { toast('Niciun raport în perioadă'); return; }

  const tubMed = d.totalEl ? (d.totalTub / d.totalEl) : 0;
  const cabluMed = d.totalEl ? (d.totalCablu / d.totalEl) : 0;
  const mPerElMed = tubMed + cabluMed;

  // Scor zilnic = m/electrician comparat cu media (nu pe volum!)
  // Asta tine cont ca daca ai 3 oameni vs 10, ce conteaza e cati metri/om
  // Medii istorice = benchmark pentru scor (compară cu cum mergi tu, în general)
  const istoric = calculeazaMediileIstorice();

  // Calculează m/mp lucrat în ZIUA respectivă (suma mp apartamentelor atinse în acea zi)
  function calcMpZiua(zi, zData) {
    let mp = 0, finalizari = 0;
    state.rapoarte.filter(r => r.data === zData).forEach(r => {
      r.alocari.forEach(a => {
        const ap = state.apartamente.find(x => x.cod === a.ap);
        if (ap?.mp) mp += ap.mp;
        if (a.stareNoua === 'gata') finalizari++;
      });
    });
    return { mp, finalizari };
  }

  // Scor: combinație productivitate per electrician + eficiență per mp
  // Comparat cu mediile ISTORICE (tot proiectul), nu doar perioada selectată
  function scorZi(zi, zData) {
    if (!zi.electricieni) return null;
    const mPerEl = (zi.tub + zi.cablu) / zi.electricieni;
    const benchmarkMPerEl = istoric.mPerElectricianZi || mPerElMed || 1;

    // Sub-scor 1: productivitate
    const scorProd = Math.min(100, Math.max(0, (mPerEl / benchmarkMPerEl) * 50));

    // Sub-scor 2: eficiență/mp (doar dacă avem mp)
    const { mp, finalizari } = calcMpZiua(zi, zData);
    let scorMp = null;
    if (mp > 0 && istoric.mPerMp > 0) {
      const mPerMpZi = (zi.tub + zi.cablu) / mp;
      scorMp = Math.min(100, Math.max(0, (mPerMpZi / istoric.mPerMp) * 50));
    }

    // Scor final
    let scorFinal;
    if (scorMp !== null) {
      scorFinal = Math.round((scorProd * 0.5 + scorMp * 0.5));
    } else {
      scorFinal = Math.round(scorProd);
    }

    return {
      total: scorFinal,
      scorProd: Math.round(scorProd),
      scorMp: scorMp !== null ? Math.round(scorMp) : null,
      mPerEl: mPerEl,
      mPerMp: mp > 0 ? (zi.tub + zi.cablu) / mp : null,
      mpLucrati: mp,
      finalizari,
      anomalie: (zi.tub + zi.cablu) > benchmarkMPerEl * 3 * (zi.electricieni || 1), // >3× media → suspect
    };
  }
  function culoareScor(s) {
    if (s === null) return '#9ca3af';
    if (s >= 65) return '#10b981'; // verde
    if (s >= 40) return '#f59e0b'; // galben
    return '#dc2626'; // rosu
  }
  function bulinaScor(s) {
    if (s === null) return '⚪';
    if (s >= 65) return '🟢';
    if (s >= 40) return '🟡';
    return '🔴';
  }

  // Top performeri
  const zileCuScor = zile.map(z => {
    const sObj = scorZi(d.perZi[z], z);
    return { data: z, ...d.perZi[z], scorObj: sObj, scor: sObj ? sObj.total : null };
  }).filter(x => x.scor !== null);
  const ceaMaiBuna = zileCuScor.slice().sort((a, b) => b.scor - a.scor)[0];
  const ceaMaiSlaba = zileCuScor.slice().sort((a, b) => a.scor - b.scor)[0];

  // Anomalii (cantități >3× media istorică/electrician)
  const zileAnomalii = zileCuScor.filter(x => x.scorObj?.anomalie);

  // Predicție ritm pe baza ultimelor 14 zile (sau toată perioada dacă mai puțin)
  const ultZile14 = zile.slice(-14);
  let ritmRecent = 0, elZileRecent = 0;
  ultZile14.forEach(z => {
    ritmRecent += d.perZi[z].tub + d.perZi[z].cablu;
    elZileRecent += d.perZi[z].electricieni;
  });
  const mPerElZiRecent = elZileRecent ? ritmRecent / elZileRecent : 0;
  // Apartamente rămase
  const apsRamase = state.apartamente.filter(ap => ap.stare !== 'gata').length;
  // Estimare m total rămase: folosim medii istorice m/ap din toate apartamentele cu date
  let mPerApMediu = 0;
  if (Object.keys(d.perApart).length > 0) {
    const sumMatPerApFinalizate = Object.entries(d.perApart)
      .filter(([cod]) => state.apartamente.find(x => x.cod === cod)?.stare === 'gata')
      .reduce((s, [, a]) => s + a.tub + a.cablu, 0);
    const nrFinalizate = Object.entries(d.perApart).filter(([cod]) => state.apartamente.find(x => x.cod === cod)?.stare === 'gata').length;
    mPerApMediu = nrFinalizate ? sumMatPerApFinalizate / nrFinalizate : 0;
  }
  const mRamasiEstimat = apsRamase * mPerApMediu;
  const ritmMediuZiCalendar = ultZile14.length ? ritmRecent / ultZile14.length : 0;
  const zileRamaseEstimat = ritmMediuZiCalendar > 0 ? Math.round(mRamasiEstimat / ritmMediuZiCalendar) : null;
  const saptRamaseEstimat = zileRamaseEstimat ? (zileRamaseEstimat / 5).toFixed(1) : null;

  // Comparație cu media istorică
  const trendVsIstoric = istoric.mPerElectricianZi ? ((mPerElZiRecent - istoric.mPerElectricianZi) / istoric.mPerElectricianZi * 100) : 0;

  // Concluzii apartamente
  const apsArr = Object.entries(d.perApart).map(([cod, a]) => {
    const ap = state.apartamente.find(x => x.cod === cod);
    return { cod, tip: ap?.tip, mp: ap?.mp || null, ...a, total: a.tub + a.cablu };
  });
  const apMax = apsArr.slice().sort((a, b) => b.total - a.total)[0];
  const apEficient = apsArr.filter(a => a.mp).slice().sort((a, b) => (a.tub + a.cablu) / a.mp - (b.tub + b.cablu) / b.mp)[0];
  const apIneficient = apsArr.filter(a => a.mp).slice().sort((a, b) => (b.tub + b.cablu) / b.mp - (a.tub + a.cablu) / a.mp)[0];

  // === GRAFIC SVG: bare scor zile ===
  // Width fix 780 (încape pe pagina A4 cu margine 10mm)
  const Gw = 780;
  const Gh = 200;
  const Gmar = { top: 20, right: 20, bottom: 40, left: 40 };
  const Giw = Gw - Gmar.left - Gmar.right;
  const Gih = Gh - Gmar.top - Gmar.bottom;
  function gx(i) { return Gmar.left + (i + 0.5) * (Giw / zile.length); }
  const barWidth = Math.max(8, Giw / zile.length - 4);

  let grilaScor = '';
  [0, 25, 50, 75, 100].forEach(v => {
    const py = Gmar.top + Gih - (v / 100) * Gih;
    grilaScor += `<line x1="${Gmar.left}" y1="${py}" x2="${Gmar.left + Giw}" y2="${py}" stroke="#f3f4f6" stroke-dasharray="2"/>`;
    grilaScor += `<text x="${Gmar.left - 5}" y="${py + 3}" font-size="9" fill="#9ca3af" text-anchor="end">${v}</text>`;
  });
  // praguri colorate
  const yMed = Gmar.top + Gih - (65 / 100) * Gih;
  const ySlab = Gmar.top + Gih - (40 / 100) * Gih;

  let bareScor = '';
  zile.forEach((z, i) => {
    const zi = d.perZi[z];
    const sObj = scorZi(zi, z);
    if (sObj === null) return;
    const s = sObj.total;
    const h = (s / 100) * Gih;
    const py = Gmar.top + Gih - h;
    const col = culoareScor(s);
    bareScor += `<rect x="${gx(i) - barWidth / 2}" y="${py}" width="${barWidth}" height="${h}" fill="${col}" rx="2"/>`;
    bareScor += `<text x="${gx(i)}" y="${py - 3}" font-size="9" fill="${col}" text-anchor="middle" font-weight="700">${s}</text>`;
    // electricieni jos
    bareScor += `<text x="${gx(i)}" y="${Gmar.top + Gih + 12}" font-size="8" fill="#9ca3af" text-anchor="middle">${zi.electricieni}el</text>`;
    if (zile.length <= 20 || i % Math.ceil(zile.length / 14) === 0) {
      bareScor += `<text x="${gx(i)}" y="${Gmar.top + Gih + 24}" font-size="8" fill="#6b7280" text-anchor="middle">${z.slice(5).replace('-', '/')}</text>`;
    }
  });

  const graficSVG = `<svg viewBox="0 0 ${Gw} ${Gh}" width="100%" height="${Gh}" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:100%">
    ${grilaScor}
    <line x1="${Gmar.left}" y1="${yMed}" x2="${Gmar.left + Giw}" y2="${yMed}" stroke="#10b981" stroke-width="0.5" stroke-dasharray="3 3"/>
    <text x="${Gmar.left + Giw - 5}" y="${yMed - 3}" font-size="8" fill="#10b981" text-anchor="end">prag bun (65)</text>
    <line x1="${Gmar.left}" y1="${ySlab}" x2="${Gmar.left + Giw}" y2="${ySlab}" stroke="#dc2626" stroke-width="0.5" stroke-dasharray="3 3"/>
    <text x="${Gmar.left + Giw - 5}" y="${ySlab - 3}" font-size="8" fill="#dc2626" text-anchor="end">prag slab (40)</text>
    ${bareScor}
  </svg>`;

  // === GRAFIC LINIE PRODUCTIE PER ELECTRICIAN (m/el zilnic) ===
  const tubPerEl = zile.map(z => d.perZi[z].electricieni ? d.perZi[z].tub / d.perZi[z].electricieni : 0);
  const cabluPerEl = zile.map(z => d.perZi[z].electricieni ? d.perZi[z].cablu / d.perZi[z].electricieni : 0);
  const maxLine = Math.max(...tubPerEl, ...cabluPerEl, 1);
  const Lw = 780;
  const Lh = 180;
  const Lmar = { top: 20, right: 20, bottom: 40, left: 40 };
  const Liw = Lw - Lmar.left - Lmar.right;
  const Lih = Lh - Lmar.top - Lmar.bottom;
  function lx(i) { return Lmar.left + (zile.length === 1 ? Liw / 2 : (i / (zile.length - 1)) * Liw); }
  function ly(v) { return Lmar.top + Lih - (v / maxLine) * Lih; }

  let grilaLin = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxLine * i / 4);
    const py = ly(v);
    grilaLin += `<line x1="${Lmar.left}" y1="${py}" x2="${Lmar.left + Liw}" y2="${py}" stroke="#f3f4f6" stroke-dasharray="2"/>`;
    grilaLin += `<text x="${Lmar.left - 5}" y="${py + 3}" font-size="9" fill="#9ca3af" text-anchor="end">${v.toFixed(0)}</text>`;
  }
  // linie medie tub
  const yMedTub = ly(tubMed);
  const yMedCablu = ly(cabluMed);
  const pathTub = tubPerEl.map((v, i) => `${i === 0 ? 'M' : 'L'}${lx(i).toFixed(1)},${ly(v).toFixed(1)}`).join(' ');
  const pathCablu = cabluPerEl.map((v, i) => `${i === 0 ? 'M' : 'L'}${lx(i).toFixed(1)},${ly(v).toFixed(1)}`).join(' ');
  let dotsTub = zile.map((_, i) => `<circle cx="${lx(i)}" cy="${ly(tubPerEl[i])}" r="2.5" fill="#1e40af"/>`).join('');
  let dotsCablu = zile.map((_, i) => `<circle cx="${lx(i)}" cy="${ly(cabluPerEl[i])}" r="2.5" fill="#10b981"/>`).join('');
  let xLabels = '';
  zile.forEach((z, i) => {
    if (zile.length <= 14 || i % Math.ceil(zile.length / 10) === 0) {
      xLabels += `<text x="${lx(i)}" y="${Lmar.top + Lih + 12}" font-size="8" fill="#6b7280" text-anchor="middle">${z.slice(5).replace('-', '/')}</text>`;
    }
  });

  const graficLinieSVG = `<svg viewBox="0 0 ${Lw} ${Lh}" width="100%" height="${Lh}" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:100%">
    ${grilaLin}
    <line x1="${Lmar.left}" y1="${yMedTub}" x2="${Lmar.left + Liw}" y2="${yMedTub}" stroke="#1e40af" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.5"/>
    <text x="${Lmar.left + Liw - 5}" y="${yMedTub - 3}" font-size="8" fill="#1e40af" text-anchor="end">med tub: ${tubMed.toFixed(1)}</text>
    <line x1="${Lmar.left}" y1="${yMedCablu}" x2="${Lmar.left + Liw}" y2="${yMedCablu}" stroke="#10b981" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.5"/>
    <text x="${Lmar.left + Liw - 5}" y="${yMedCablu - 3}" font-size="8" fill="#10b981" text-anchor="end">med cablu: ${cabluMed.toFixed(1)}</text>
    <path d="${pathTub}" stroke="#1e40af" stroke-width="2" fill="none"/>
    <path d="${pathCablu}" stroke="#10b981" stroke-width="2" fill="none"/>
    ${dotsTub}${dotsCablu}
    ${xLabels}
  </svg>`;

  // === TABEL ZILE CU SCOR ===
  let zilnicRows = '';
  zile.forEach(z => {
    const zi = d.perZi[z];
    const tubEl = zi.electricieni ? zi.tub / zi.electricieni : 0;
    const cabluEl = zi.electricieni ? zi.cablu / zi.electricieni : 0;
    const sObj = scorZi(zi, z);
    const s = sObj ? sObj.total : null;
    const colS = culoareScor(s);
    const detaliuScor = sObj ?
      (sObj.scorMp !== null ? `${sObj.scorProd}/${sObj.scorMp}` : `${sObj.scorProd}`) :
      '—';
    const anomFlag = sObj?.anomalie ? ' ⚠️' : '';
    zilnicRows += `<tr><td>${bulinaScor(s)} <b>${fmtDate(z)}</b>${anomFlag}</td><td style="text-align:right">${zi.electricieni}</td><td style="text-align:right">${Math.round(zi.tub)}</td><td style="text-align:right">${Math.round(zi.cablu)}</td><td style="text-align:right;font-weight:700">${tubEl.toFixed(1)}</td><td style="text-align:right;font-weight:700">${cabluEl.toFixed(1)}</td><td style="text-align:center;font-weight:700;color:${colS}">${s !== null ? s : '—'}</td><td style="text-align:center;font-size:9px;color:#6b7280">${detaliuScor}</td></tr>`;
  });
  zilnicRows += `<tr style="background:#f3f4f6;font-weight:700"><td>MEDIA</td><td style="text-align:right">${d.totalEl}</td><td style="text-align:right">${Math.round(d.totalTub)}</td><td style="text-align:right">${Math.round(d.totalCablu)}</td><td style="text-align:right">${tubMed.toFixed(1)}</td><td style="text-align:right">${cabluMed.toFixed(1)}</td><td style="text-align:center">—</td><td></td></tr>`;

  // === TABEL APARTAMENTE (sortat după total) ===
  const apartSortate = apsArr.slice().sort((a, b) => b.total - a.total);
  let apartRows = '';
  apartSortate.forEach(a => {
    apartRows += `<tr><td><b>${a.cod}</b></td><td>${a.tip || '—'}</td><td style="text-align:right">${a.mp || '—'}</td><td>${{gata:'🟢 Gata',in_lucru:'🟡 În lucru',blocat:'🔴 Blocat'}[a.stareFinala] || '—'}</td><td style="text-align:right">${a.zile.size}</td><td style="text-align:right;color:#1e40af;font-weight:600">${Math.round(a.tub)}</td><td style="text-align:right;color:#10b981;font-weight:600">${Math.round(a.cablu)}</td><td style="text-align:right">${a.mp ? (a.tub / a.mp).toFixed(2) : '—'}</td><td style="text-align:right">${a.mp ? (a.cablu / a.mp).toFixed(2) : '—'}</td><td style="text-align:right">${a.oameni}</td></tr>`;
  });

  // === MEDII TIP ===
  const perTip = {};
  apsArr.forEach(a => {
    if (!a.tip) return;
    if (!perTip[a.tip]) perTip[a.tip] = { aps: [], totalMp: 0, totalTub: 0, totalCablu: 0, totalOameni: 0 };
    perTip[a.tip].aps.push(a.cod);
    if (a.mp) perTip[a.tip].totalMp += a.mp;
    perTip[a.tip].totalTub += a.tub;
    perTip[a.tip].totalCablu += a.cablu;
    perTip[a.tip].totalOameni += a.oameni;
  });
  let tipRows = '';
  TIPURI_AP.forEach(tip => {
    const t = perTip[tip]; if (!t) return;
    const n = t.aps.length;
    tipRows += `<tr><td><b>${tip}</b></td><td style="text-align:right">${n}</td><td style="text-align:right">${t.totalMp ? t.totalMp.toFixed(0) : '—'}</td><td style="text-align:right">${(t.totalTub / n).toFixed(0)}</td><td style="text-align:right">${(t.totalCablu / n).toFixed(0)}</td><td style="text-align:right;font-weight:600">${t.totalMp ? (t.totalTub / t.totalMp).toFixed(2) : '—'}</td><td style="text-align:right;font-weight:600">${t.totalMp ? (t.totalCablu / t.totalMp).toFixed(2) : '—'}</td><td style="text-align:right">${(t.totalOameni / n).toFixed(1)}</td></tr>`;
  });

  // === CONCLUZII TEXT ===
  let concluzii = '';
  if (ceaMaiBuna) {
    concluzii += `<div style="background:#d1fae5;padding:10px;border-left:4px solid #10b981;border-radius:4px;margin-bottom:6px"><b>🚀 Cea mai bună zi:</b> ${fmtDate(ceaMaiBuna.data)} cu scor <b>${ceaMaiBuna.scor}</b> — ${ceaMaiBuna.electricieni} electricieni au făcut ${Math.round(ceaMaiBuna.tub)}m tub + ${Math.round(ceaMaiBuna.cablu)}m cablu</div>`;
  }
  if (ceaMaiSlaba && ceaMaiSlaba.data !== ceaMaiBuna?.data) {
    concluzii += `<div style="background:#fee2e2;padding:10px;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:6px"><b>🐢 Cea mai slabă zi:</b> ${fmtDate(ceaMaiSlaba.data)} cu scor <b>${ceaMaiSlaba.scor}</b> — ${ceaMaiSlaba.electricieni} electricieni, ${Math.round(ceaMaiSlaba.tub)}m tub + ${Math.round(ceaMaiSlaba.cablu)}m cablu</div>`;
  }
  if (apMax) {
    concluzii += `<div style="background:#dbeafe;padding:10px;border-left:4px solid #1e40af;border-radius:4px;margin-bottom:6px"><b>🏗️ Cel mai consumator apartament:</b> ${apMax.cod}${apMax.tip ? ` (${apMax.tip})` : ''} — ${Math.round(apMax.tub)}m tub + ${Math.round(apMax.cablu)}m cablu (${apMax.zile.size} zile)</div>`;
  }
  if (apEficient && apIneficient && apEficient.cod !== apIneficient.cod) {
    const effE = (apEficient.tub + apEficient.cablu) / apEficient.mp;
    const effI = (apIneficient.tub + apIneficient.cablu) / apIneficient.mp;
    concluzii += `<div style="background:#f9fafb;padding:10px;border-left:4px solid #6b7280;border-radius:4px;margin-bottom:6px"><b>📐 Consum/mp:</b> <span style="color:#10b981">cel mai eficient ${apEficient.cod} (${effE.toFixed(2)} m/mp)</span> vs <span style="color:#dc2626">cel mai consumator ${apIneficient.cod} (${effI.toFixed(2)} m/mp)</span></div>`;
  }
  // Trend vs istoric
  if (istoric.zileTotal > 0 && mPerElZiRecent > 0) {
    const trendIcon = trendVsIstoric > 5 ? '↑' : trendVsIstoric < -5 ? '↓' : '→';
    const trendCol = trendVsIstoric > 5 ? '#10b981' : trendVsIstoric < -5 ? '#dc2626' : '#6b7280';
    const sign = trendVsIstoric > 0 ? '+' : '';
    concluzii += `<div style="background:#eff6ff;padding:10px;border-left:4px solid #1e40af;border-radius:4px;margin-bottom:6px"><b>📊 Ritm recent vs istoric proiect:</b> ${mPerElZiRecent.toFixed(1)} m/electrician-zi (ultimele ${ultZile14.length} zile) vs medie istorică ${istoric.mPerElectricianZi.toFixed(1)} m/electrician-zi → <span style="color:${trendCol};font-weight:700">${trendIcon} ${sign}${trendVsIstoric.toFixed(0)}%</span></div>`;
  }
  // Predicție
  if (zileRamaseEstimat && apsRamase > 0) {
    concluzii += `<div style="background:#fef3c7;padding:10px;border-left:4px solid #f59e0b;border-radius:4px;margin-bottom:6px"><b>📅 Predicție rămas proiect:</b> ${apsRamase} apartamente neterminate × ${Math.round(mPerApMediu)}m mediu = aprox <b>${Math.round(mRamasiEstimat)}m</b> de instalat. La ritmul actual (${ritmMediuZiCalendar.toFixed(0)} m/zi), termini în ~<b>${zileRamaseEstimat} zile lucrătoare</b> (≈${saptRamaseEstimat} săpt.)</div>`;
  }
  // Anomalii
  if (zileAnomalii.length > 0) {
    const liste = zileAnomalii.slice(0, 3).map(x => `${fmtDate(x.data)} (${Math.round(x.tub + x.cablu)}m)`).join(', ');
    concluzii += `<div style="background:#fee2e2;padding:10px;border-left:4px solid #dc2626;border-radius:4px"><b>⚠️ Cantități suspect mari</b> (>3× media pentru nr electricieni): ${liste}${zileAnomalii.length > 3 ? ` + alte ${zileAnomalii.length - 3}` : ''}. Verifică să nu fie typing greșit la zecimale.</div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><title>Analiză ${fmtDate(startISO)} - ${fmtDate(endISO)}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;background:#e5e7eb}
a,a:link{color:inherit !important;text-decoration:none !important}
.page{background:white;padding:25px;max-width:900px;margin:15px auto;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e40af;padding-bottom:10px;margin-bottom:14px}
.header .logo{width:65px}.header-text .company{font-size:18px;font-weight:700;color:#1e40af}.header-text .sub{font-size:11px;color:#6b7280}
.intern-badge{background:#dbeafe;color:#1e40af;padding:5px 12px;border-radius:6px;font-weight:600;font-size:11px;text-align:center;margin-bottom:10px;display:inline-block}
.title{font-size:17px;font-weight:700;text-align:center;margin:6px 0;color:#1e40af}
.subtitle{font-size:11px;color:#6b7280;text-align:center;margin-bottom:14px}
h2{font-size:13px;color:#1e40af;margin-top:18px;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
h3{font-size:11px;color:#374151;margin-top:8px;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px}
th,td{padding:5px 7px;border-bottom:1px solid #e5e7eb;font-size:10px}
th{background:#1e40af;color:white;text-align:left;font-weight:600;font-size:10px}
.cifre-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
.cifra{background:#f9fafb;padding:8px;border-radius:6px;border-left:3px solid #1e40af;text-align:center}
.cifra .val{font-size:18px;font-weight:700;color:#1e40af;line-height:1}
.cifra .lbl{font-size:10px;color:#6b7280;margin-top:3px}
.legend{font-size:10px;color:#6b7280;display:flex;gap:14px;justify-content:center;margin-bottom:6px}
.legend-item{display:flex;align-items:center;gap:4px}
.legend-color{width:12px;height:8px;border-radius:2px}
.grafic-box{border:1px solid #e5e7eb;border-radius:6px;padding:8px;margin-bottom:8px;background:#fafbfc;overflow:hidden}
.footer{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;text-align:center}
.no-print{position:fixed;top:10px;right:10px;padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;z-index:100}
.page-break{display:block;page-break-before:always;break-before:page;height:0}
@media screen{.page-break{display:none}}
@media print{@page{size:A4;margin:8mm}body{background:white}.page{margin:0;box-shadow:none;padding:8mm}.no-print{display:none}tr{page-break-inside:avoid}thead{display:table-header-group}h2{page-break-after:avoid}}
</style></head><body>
<button class="no-print" onclick="window.print()">🖨️ Tipărește / Salvează PDF</button>

<!-- PAGINA 1: SUMAR -->
<div class="page">
  <div class="intern-badge">📊 RAPORT ANALIZĂ INTERNĂ — arhivă firmă</div>
  <div class="header"><img src="logo.png" class="logo" /><div class="header-text"><div class="company">${state.firmaNume || 'iFort Systems SRL'}</div><div class="sub">Raport analiză — ${state.santier || 'Corallis'}</div></div></div>

  <div class="title">Analiză perioada ${fmtDate(startISO)} — ${fmtDate(endISO)}</div>
  <div class="subtitle">${zile.length} zile lucrate • ${state.apartamente.length} apartamente în proiect (${d.apsAtinse.size} atinse în perioadă) • ${d.totalEl} electricieni-zile</div>

  <div class="cifre-grid">
    <div class="cifra"><div class="val">${Math.round(d.totalTub)}</div><div class="lbl">m tub TOTAL</div></div>
    <div class="cifra" style="border-left-color:#10b981"><div class="val" style="color:#10b981">${Math.round(d.totalCablu)}</div><div class="lbl">m cabluri TOTAL</div></div>
    <div class="cifra" style="border-left-color:#f59e0b"><div class="val" style="color:#f59e0b">${tubMed.toFixed(1)}</div><div class="lbl">m tub / electrician-zi</div></div>
    <div class="cifra" style="border-left-color:#8b5cf6"><div class="val" style="color:#8b5cf6">${cabluMed.toFixed(1)}</div><div class="lbl">m cablu / electrician-zi</div></div>
    <div class="cifra"><div class="val">${d.apsFinalizate.size}/${state.apartamente.length}</div><div class="lbl">apartamente finalizate</div></div>
    <div class="cifra" style="border-left-color:#06b6d4"><div class="val" style="color:#06b6d4">${(d.totalEl/zile.length).toFixed(1)}</div><div class="lbl">electricieni medie/zi</div></div>
  </div>

  <h2>📌 Concluzii cheie</h2>
  ${concluzii || '<div style="color:#9ca3af;font-style:italic;padding:10px">Date insuficiente pentru concluzii</div>'}

  <h2>📊 Scor zile (productivitate per electrician)</h2>
  <div class="legend">
    <div class="legend-item"><div class="legend-color" style="background:#10b981"></div>Zi bună (≥65)</div>
    <div class="legend-item"><div class="legend-color" style="background:#f59e0b"></div>Zi medie (40-64)</div>
    <div class="legend-item"><div class="legend-color" style="background:#dc2626"></div>Zi slabă (&lt;40)</div>
  </div>
  <div class="grafic-box">${graficSVG}</div>
  <p style="font-size:10px;color:#6b7280;margin:4px 0">Scorul ține cont DOAR de cât a tras un electrician în medie. Nr. electricieni nu afectează scorul — dacă ai 3 oameni care au făcut treabă bună, ziua e bună chiar dacă volumul total e mic.</p>
</div>

<!-- PAGINA 2: GRAFIC TREND + TABEL ZILNIC -->
<div class="page-break"></div>
<div class="page">
  <h2>📈 Trend producție per electrician (m/zi)</h2>
  <div class="legend">
    <div class="legend-item"><div class="legend-color" style="background:#1e40af"></div>Tub/electrician</div>
    <div class="legend-item"><div class="legend-color" style="background:#10b981"></div>Cabluri/electrician</div>
  </div>
  <div class="grafic-box">${graficLinieSVG}</div>

  <h2>📋 Detaliu zi cu zi</h2>
  <table>
    <thead><tr><th>Data</th><th style="text-align:right">El.</th><th style="text-align:right">Tub</th><th style="text-align:right">Cablu</th><th style="text-align:right">Tub/el</th><th style="text-align:right">Cablu/el</th><th style="text-align:center">Scor</th><th style="text-align:center" title="Sub-scoruri: productivitate / eficiență per mp">P/MP</th></tr></thead>
    <tbody>${zilnicRows}</tbody>
  </table>
  <p style="font-size:10px;color:#6b7280">🟢 ≥65 zi bună • 🟡 40-64 zi medie • 🔴 &lt;40 zi slabă • ⚠️ cantitate suspect mare (verifică) • P/MP = sub-scor productivitate / sub-scor eficiență per mp</p>
</div>

<!-- PAGINA 3: APARTAMENTE -->
<div class="page-break"></div>
<div class="page">
  <h2>🏠 Performanță apartamente (sortate după consum total)</h2>
  <table>
    <thead><tr><th>Cod</th><th>Tip</th><th style="text-align:right">mp</th><th>Stare</th><th style="text-align:right">Zile</th><th style="text-align:right">Tub</th><th style="text-align:right">Cablu</th><th style="text-align:right">Tub/mp</th><th style="text-align:right">Cablu/mp</th><th style="text-align:right">Om-zile</th></tr></thead>
    <tbody>${apartRows}</tbody>
  </table>

  <h2>🏗️ Medii pe tip apartament</h2>
  <table>
    <thead><tr><th>Tip</th><th style="text-align:right">Nr. ap</th><th style="text-align:right">Total mp</th><th style="text-align:right">Tub/ap</th><th style="text-align:right">Cablu/ap</th><th style="text-align:right">Tub/mp</th><th style="text-align:right">Cablu/mp</th><th style="text-align:right">Om-zi/ap</th></tr></thead>
    <tbody>${tipRows || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">Niciun apartament cu tip definit</td></tr>'}</tbody>
  </table>

  <div class="footer">Document intern — ${state.firmaNume || 'iFort Systems SRL'} — generat ${fmtDate(todayISO())}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

document.getElementById('btnAnalizaPDF').addEventListener('click', genereazaAnalizaPDF);

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

// ============= ONEDRIVE SYNC (Microsoft Graph) =============
const OneDrive = (function () {
  const MSAL_CONFIG = {
    auth: {
      clientId: 'dcccb5ef-66db-4d8c-adfb-6ca291a0b7b1',
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: location.origin + location.pathname,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  };
  const SCOPES = ['Files.ReadWrite.AppFolder', 'offline_access', 'User.Read'];
  const FILE_NAME = 'ifort-date-aplicatie.json';
  // AppFolder API folosește calea specială "approot:"
  const FILE_PATH = `/me/drive/special/approot:/${FILE_NAME}:/content`;
  const FILE_META_PATH = `/me/drive/special/approot:/${FILE_NAME}`;

  let msalInstance = null;
  let account = null;
  let isInitialized = false;
  let syncTimer = null;
  let isSyncing = false;
  let lastFileEtag = null;

  function setStatus(msg, color) {
    const el = document.getElementById('odStatus');
    if (el) {
      el.textContent = msg;
      el.style.color = color || '#6b7280';
    }
  }

  function updateUI() {
    const loginBtn = document.getElementById('btnODLogin');
    const logoutBtn = document.getElementById('btnODLogout');
    const syncBtn = document.getElementById('btnODSyncNow');
    const pullBtn = document.getElementById('btnODPullCloud');
    const ultimaSyncEl = document.getElementById('odUltimaSync');

    if (account) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = '';
      if (syncBtn) syncBtn.style.display = '';
      if (pullBtn) pullBtn.style.display = '';
      setStatus(`✅ Conectat: ${account.username}`, '#10b981');
      if (state.ultimaSyncOD && ultimaSyncEl) {
        const d = new Date(state.ultimaSyncOD);
        ultimaSyncEl.textContent = `Ultima sincronizare: ${d.toLocaleString('ro-RO')}`;
      }
    } else {
      if (loginBtn) loginBtn.style.display = '';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (syncBtn) syncBtn.style.display = 'none';
      if (pullBtn) pullBtn.style.display = 'none';
      setStatus('🔒 Neconectat la OneDrive. Datele sunt doar pe acest dispozitiv.', '#dc2626');
    }
  }

  async function init() {
    if (isInitialized) return;
    if (typeof msal === 'undefined') {
      setStatus('⚠️ Biblioteca MSAL nu s-a încărcat (verifică internet)', '#dc2626');
      return;
    }
    try {
      msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
      await msalInstance.initialize();
      // Verifică dacă există deja un cont logat
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        account = accounts[0];
      }
      // Handle redirect response (după login)
      try {
        const result = await msalInstance.handleRedirectPromise();
        if (result && result.account) {
          account = result.account;
        }
      } catch (e) { console.warn('Redirect handle:', e); }
      isInitialized = true;
      updateUI();
      // Auto-pull la inițializare dacă suntem logați
      if (account) {
        await tryAutoPull();
      }
    } catch (e) {
      console.error('MSAL init error:', e);
      setStatus('❌ Eroare inițializare MSAL: ' + e.message, '#dc2626');
    }
  }

  async function login() {
    if (!isInitialized) await init();
    if (!msalInstance) return;
    try {
      setStatus('🔄 Se deschide fereastra login...', '#1e40af');
      // Pe iPhone PWA pop-up-urile pot fi blocate → folosim redirect
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (isPWA) {
        // Redirect (după login va reveni la aplicație)
        await msalInstance.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
        // Funcția se oprește aici — pagina face redirect
      } else {
        const result = await msalInstance.loginPopup({ scopes: SCOPES, prompt: 'select_account' });
        account = result.account;
        msalInstance.setActiveAccount(account);
        updateUI();
        toast('Conectat cu succes ✓');
        await tryAutoPull();
      }
    } catch (e) {
      console.error('Login error:', e);
      toast('Eroare login: ' + (e.errorMessage || e.message));
      setStatus('❌ Login eșuat: ' + (e.errorMessage || e.message), '#dc2626');
    }
  }

  async function logout() {
    if (!msalInstance || !account) return;
    if (!confirm('Te deloghezi din OneDrive? Datele rămân pe acest dispozitiv, dar nu se mai sincronizează.')) return;
    try {
      await msalInstance.logoutPopup({ account });
      account = null;
      updateUI();
      toast('Delogat');
    } catch (e) {
      console.error('Logout error:', e);
    }
  }

  async function getAccessToken() {
    if (!account) throw new Error('Nu ești logat');
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: SCOPES, account });
      return result.accessToken;
    } catch (e) {
      // Token expirat → re-login interactiv
      console.warn('Silent token failed, falling back to popup:', e);
      const result = await msalInstance.acquireTokenPopup({ scopes: SCOPES, account });
      return result.accessToken;
    }
  }

  async function uploadToOneDrive() {
    if (!account) { toast('Nu ești logat în OneDrive'); return false; }
    if (isSyncing) { console.log('Deja în sync'); return false; }
    isSyncing = true;
    setStatus('🔄 Se sincronizează...', '#1e40af');
    try {
      const token = await getAccessToken();
      const json = JSON.stringify(state, null, 2);
      const resp = await fetch(`https://graph.microsoft.com${FILE_PATH}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: json,
      });
      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errTxt}`);
      }
      const meta = await resp.json();
      lastFileEtag = meta.eTag;
      state.ultimaSyncOD = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateUI();
      console.log('✅ Sync OneDrive OK', meta);
      toast('💾 Salvat în OneDrive ✓');
      return true;
    } catch (e) {
      console.error('Upload error:', e);
      setStatus('❌ Eroare sincronizare: ' + e.message, '#dc2626');
      toast('Eroare sync: ' + e.message);
      return false;
    } finally {
      isSyncing = false;
    }
  }

  async function downloadFromOneDrive() {
    if (!account) { toast('Nu ești logat'); return null; }
    try {
      const token = await getAccessToken();
      // Verifică dacă fișierul există
      const metaResp = await fetch(`https://graph.microsoft.com/v1.0${FILE_META_PATH}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (metaResp.status === 404) {
        console.log('Fișier inexistent în OneDrive — primul upload');
        return null;
      }
      if (!metaResp.ok) throw new Error('Eroare metadata: ' + metaResp.status);
      const meta = await metaResp.json();
      lastFileEtag = meta.eTag;
      // Descarcă conținutul
      const contentResp = await fetch(`https://graph.microsoft.com${FILE_PATH}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!contentResp.ok) throw new Error('Eroare descărcare: ' + contentResp.status);
      const data = await contentResp.json();
      return { data, meta };
    } catch (e) {
      console.error('Download error:', e);
      toast('Eroare descărcare: ' + e.message);
      return null;
    }
  }

  // La login/init: dacă cloud-ul are date mai noi decât localStorage → întreabă utilizatorul
  async function tryAutoPull() {
    if (!account) return;
    setStatus('🔄 Verific OneDrive...', '#1e40af');
    const cloud = await downloadFromOneDrive();
    if (!cloud) {
      // Niciun fișier în cloud — upload state actual
      setStatus('☁️ Primul upload în OneDrive...', '#1e40af');
      await uploadToOneDrive();
      return;
    }
    const cloudVers = cloud.data.versiuneState || 0;
    const localVers = state.versiuneState || 0;
    const localGol = (!state.rapoarte || state.rapoarte.length === 0) && (!state.apartamente || state.apartamente.length === 0);
    const cloudGol = (!cloud.data.rapoarte || cloud.data.rapoarte.length === 0) && (!cloud.data.apartamente || cloud.data.apartamente.length === 0);

    if (cloudGol && !localGol) {
      // Local are date, cloud gol → upload
      await uploadToOneDrive();
      return;
    }
    if (!cloudGol && localGol) {
      // Cloud are date, local gol → înlocuim local cu cloud (fără întrebare — caz tipic device nou)
      state = cloud.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      setStatus('✅ Date încărcate din OneDrive', '#10b981');
      toast('📥 Date sincronizate din OneDrive');
      updateUI();
      return;
    }
    if (cloudVers > localVers) {
      // Cloud mai nou — întreabă
      if (confirm(`OneDrive are o versiune mai recentă (v${cloudVers}) decât cea locală (v${localVers}).\n\nÎnlocuiești datele locale cu cele din OneDrive?\n\nDA = înlocuiește (recomandat)\nNU = păstrează local (va suprascrie cloud-ul la următoarea salvare)`)) {
        state = cloud.data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        toast('📥 Date încărcate din OneDrive');
      }
    } else if (localVers > cloudVers) {
      // Local mai nou → upload
      await uploadToOneDrive();
    } else {
      setStatus('✅ Sincronizat (v' + localVers + ')', '#10b981');
    }
    updateUI();
  }

  function scheduleAutoSync() {
    if (!account) return;
    if (syncTimer) clearTimeout(syncTimer);
    // Așteaptă 3 secunde de inactivitate înainte de upload (evită spam la editări rapide)
    syncTimer = setTimeout(() => {
      uploadToOneDrive();
    }, 3000);
  }

  // Public API
  return {
    init,
    login,
    logout,
    syncNow: uploadToOneDrive,
    pullFromCloud: tryAutoPull,
    forcePullFromCloud: async function () {
      if (!account) { toast('Nu ești logat'); return; }
      const cloud = await downloadFromOneDrive();
      if (!cloud) { toast('Nu există date în OneDrive'); return; }
      if (!confirm('Înlocuiești TOATE datele locale cu cele din OneDrive?')) return;
      state = cloud.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      toast('Date încărcate din OneDrive ✓');
      updateUI();
    },
    scheduleAutoSync,
    isLoggedIn: () => !!account,
  };
})();

// Wire UI events pentru OneDrive
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => OneDrive.init(), 500);
  const bLogin = document.getElementById('btnODLogin');
  const bLogout = document.getElementById('btnODLogout');
  const bSync = document.getElementById('btnODSyncNow');
  const bPull = document.getElementById('btnODPullCloud');
  if (bLogin) bLogin.addEventListener('click', () => OneDrive.login());
  if (bLogout) bLogout.addEventListener('click', () => OneDrive.logout());
  if (bSync) bSync.addEventListener('click', () => OneDrive.syncNow());
  if (bPull) bPull.addEventListener('click', () => OneDrive.forcePullFromCloud());
});

function init() {
  load();
  document.getElementById('data').value = todayISO();
  document.getElementById('numeIntrodus').value = state.utilizator || '';
  renderAll();

  // Service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Auto-reload când SW se actualizează
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'SW_UPDATED') {
        console.log('SW updated to', e.data.version, '- reloading');
        setTimeout(() => location.reload(), 500);
      }
    });
    // Verifică update la fiecare focus pe tab
    navigator.serviceWorker.ready.then(reg => {
      window.addEventListener('focus', () => reg.update());
    });
  }
}

init();
