# iFort — Aplicație Raport Execuție Instalații Electrice

PWA (Progressive Web App) pentru gestionarea rapoartelor zilnice de execuție pe șantier, pontaj, situații de lucrări, analize KPI și finanțe.

## Caracteristici

- **Rapoarte zilnice** pe apartament + cantități materiale + poze
- **Apartamente** cu suprafețe (mp), tip, stare (Neînceput / În lucru / Gata / Blocat)
- **Pontaj muncitori** cu ore start/final + pauză + echipe
- **Situații de lucrări** oficiale (extern KESZ) și interne, cu prețuri și TOTAL EUR
- **Stoc materiale** + necesar de comandat pentru furnizor
- **Analiză KPI** cu scor zile, trend producție, performanță apartamente
- **Finanțe** — producție valoare facturabilă pe zile/săptămâni
- **PDF + Excel** export pentru toate documentele
- **Funcționează offline** (PWA cu service worker)

## Tehnologie

- **HTML + CSS + JavaScript vanilla** (fără framework, fără build step)
- **localStorage** pentru date (separate pe fiecare device)
- **Service Worker** pentru offline + cache versiune
- **MSAL.js** pentru sync OneDrive (opțional)

## Hosting

Aplicația rulează pe **GitHub Pages** la:
`https://aserban97.github.io/raport-executie-ie_rezidential/`

Pentru a o muta pe alt cont GitHub:
1. Faceți fork la repository
2. Activați GitHub Pages din Settings → Pages → Branch: main
3. Actualizați referințele MSAL (vezi mai jos)

## Structura fișierelor

```
Aplicatie executie/
├── index.html         # Interfața HTML cu toate tab-urile
├── app.js             # Logica completă (~5000 linii)
├── styles.css         # Aspect vizual
├── sw.js              # Service worker (cache + offline)
├── manifest.json      # Config PWA
├── logo.png           # Logo iFort pentru documente PDF
├── icon-192.png       # Icon Home Screen
├── icon-512.png       # Icon Home Screen mare
└── README.md          # Acest fișier
```

## Tab-uri în aplicație

1. **Raport** — Introdu raport zilnic cu apartamente, cantități, poze
2. **Istoric** — Calendar cu toate rapoartele + descărcare PDF zi/săptămână
3. **Apart.** — Listă apartamente, stare, hartă vizuală
4. **Stoc** — Aprovizionări, stoc curent, **necesar comandă furnizor**
5. **Personal** — Muncitori, pontaj zilnic, echipe, sumar lunar
6. **Analiză** — Dashboard cu cifre cheie, scor zile, performanță apartamente
7. **KPI+** — KPI suplimentare (rapoarte aux/tub, distribuție pe tip ap.)
8. **Finanțe** — Producție valoare facturabilă pe zile/săptămâni
9. **Situații** — Generare Situație de Lucrări oficială cu prețuri și TOTAL EUR
10. **Setări** — Date proiect, date firmă, prețuri materiale, sync OneDrive

## Configurare după clonare

### 1. Setări firmă (în aplicație → Setări → Date firmă executant)
- Denumire firmă, Adresă, CUI, ONRC, IBAN
- Prefix numerotare situații (ex: SL-2026-)

### 2. Setări proiect (în aplicație → Setări → Date proiect)
- Beneficiar
- Antreprenor general (afișaj scurt)
- Adresa obiectiv
- Nume scurt obiectiv

### 3. Prețuri materiale (în aplicație → Setări → Prețuri materiale)
- Setează prețul EUR/UM pentru fiecare material facturabil (cabluri, tub, jgheab)

### 4. Adaugă apartamentele (în aplicație → Apart.)
- Cod, tip (2/3/4 camere / Penthouse / Zonă comună), suprafață mp

### 5. (Opțional) Sync OneDrive
Vezi secțiunea "Sync OneDrive cu Microsoft Graph" mai jos.

## Sync OneDrive (opțional, pentru multi-device)

Aplicația poate salva automat datele în OneDrive pentru:
- Backup automat (versiuni 30 zile la Microsoft)
- Sincronizare între telefon + PC + laptop
- Predabilitate (datele sunt în folderul firmei)

### Setup Azure App Registration (o singură dată)

1. Mergeți la https://portal.azure.com → **App registrations** → **+ New registration**
2. Name: `iFort Raport Executie`
3. Supported account types: **Multitenant + personal Microsoft accounts**
4. Redirect URI: **Single-page application (SPA)** → URL-ul aplicației (ex: `https://YOURUSER.github.io/raport-executie-ie_rezidential/`)
5. Apăsați **Register**
6. Copiați **Application (client) ID** și înlocuiți în `app.js` la linia `clientId:` (caută `MSAL_CONFIG`)
7. Mergeți la **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**:
   - `Files.ReadWrite.AppFolder`
   - `offline_access`
   - `User.Read`
8. Apăsați **Add permissions**

## Cum funcționează datele

⚠️ **IMPORTANT**: Datele sunt salvate în **localStorage al browserului** (separate pe fiecare device).

### Backup recomandat
- **Manual**: Setări → "Export backup (JSON)" → trimite fișierul pe email/OneDrive
- **Automat**: La fiecare 10 rapoarte, aplicația descarcă automat un backup JSON
- **Recomandat**: Configurați sync OneDrive pentru backup automat în cloud

### Import backup
- Setări → "Import backup" → selectează fișier JSON exportat anterior

## Suport browseri

- ✅ Safari iOS (iPhone) — PWA recomandat (Add to Home Screen)
- ✅ Chrome Android — PWA recomandat
- ✅ Chrome / Edge / Firefox / Safari pe Desktop
- ✅ Funcționează offline (service worker)

## Licență / Drepturi

Aplicație internă iFort Systems SRL. Toate drepturile rezervate.

## Versiune curentă

v42 (Iunie 2026) — Tab Finanțe + producție valoare facturabilă

## Contact

iFort Systems SRL
B-vd Timișoara nr.80B, Sector 6, București
CUI: RO300072700
