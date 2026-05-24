// PWA: Service Worker registrieren & persistenten Speicher anfragen
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(g=>console.log('Persistent storage:', g));
}

// ---- IndexedDB Wrapper ----
const DB_NAME = 'rechnung-db';
const DB_VER = 1;
let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (ev)=>{
      const db = ev.target.result;
      if(!db.objectStoreNames.contains('form')) db.createObjectStore('form');            // key: 'current'
      if(!db.objectStoreNames.contains('customers')) db.createObjectStore('customers');  // key: nameLower
      if(!db.objectStoreNames.contains('history')) db.createObjectStore('history');      // key: id
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');    // misc
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return _dbPromise;
}
function idbGet(store, key){
  return openDB().then(db=> new Promise((res,rej)=>{
    const tx = db.transaction(store,'readonly'); const st = tx.objectStore(store);
    const q = st.get(key); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error);
  }));
}
function idbSet(store, key, val){
  return openDB().then(db=> new Promise((res,rej)=>{
    const tx = db.transaction(store,'readwrite'); const st = tx.objectStore(store);
    const q = st.put(val, key); q.onsuccess=()=>res(true); q.onerror=()=>rej(q.error);
  }));
}
function idbDel(store, key){
  return openDB().then(db=> new Promise((res,rej)=>{
    const tx = db.transaction(store,'readwrite'); const st = tx.objectStore(store);
    const q = st.delete(key); q.onsuccess=()=>res(true); q.onerror=()=>rej(q.error);
  }));
}
function idbAll(store){
  return openDB().then(db=> new Promise((res,rej)=>{
    const tx = db.transaction(store,'readonly'); const st = tx.objectStore(store);
    const out = []; const cur = st.openCursor();
    cur.onsuccess = (e)=>{
      const c = e.target.result; if(c){ out.push({key:c.key, value:c.value}); c.continue(); } else res(out);
    };
    cur.onerror = ()=> rej(cur.error);
  }));
}

// ---- UI Helpers ----
const $ = (sel) => document.querySelector(sel);

function nf(locale, currency){
  return new Intl.NumberFormat(locale || 'de-DE', { style:'currency', currency: currency || 'EUR', minimumFractionDigits:2, maximumFractionDigits:2 });
}
function pf(val){
  if(typeof val === 'number') return val;
  if(!val) return 0;
  return parseFloat(String(val).replace(/\./g,'').replace(',', '.')) || 0;
}
function todayStr(){
  const d = new Date(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
function escapeHTML(s){
  return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function slug(s){
  return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
}
function initials(s){ return (s||'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,6).toLowerCase(); }
function shortName(s){ const sl=slug(s); if(sl.length&&sl.length<=16) return sl; const ini=initials(s); return ini||sl.slice(0,16)||'x'; }
function makeBaseName(data){
  const date = (data.invoiceDate||'').replaceAll('-','') || new Date().toISOString().slice(0,10).replaceAll('-','');
  const client = shortName(data.clientName) || 'kunde';
  const proj   = shortName(data.projectName) || 'projekt';
  const num    = (data.invoiceNumber||'ohneNummer').replace(/[^a-z0-9\-_.]+/gi,'_');
  const doc    = (data.docType||'Rechnung');
  return `${doc}_${num}_${client}_${proj}_${date}`;
}

// ---- Kundenbuch (IndexedDB) ----
function normalizeName(s){ return String(s||'').trim(); }
async function loadCustomerListToDatalist(){
  const dl = $('#customerList'); dl.innerHTML='';
  const rows = await idbAll('customers');
  const arr = rows.map(r=> r.value).filter(Boolean).sort((a,b)=> (a.name||'').localeCompare(b.name||'','de'));
  for(const c of arr){
    const opt = document.createElement('option');
    opt.value = c.name || '';
    opt.label = c.contact ? `${c.name} — ${c.contact}` : (c.name||'');
    dl.appendChild(opt);
  }
}
async function findCustomerByName(name){
  const key = normalizeName(name).toLowerCase();
  return await idbGet('customers', key);
}
async function upsertCustomer(entry){
  const key = normalizeName(entry.name).toLowerCase();
  await idbSet('customers', key, entry);
}
async function deleteCustomerByName(name){
  const key = normalizeName(name).toLowerCase();
  await idbDel('customers', key);
}
async function exportCustomerBook(){
  const rows = await idbAll('customers');
  const book = { version:1, customers: rows.map(r=>r.value) };
  const blob = new Blob([JSON.stringify(book,null,2)], {type:'application/json;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='customers.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),0);
}
async function importCustomerBook(file){
  const text = await file.text();
  const json = JSON.parse(text);
  if(!json || !Array.isArray(json.customers)) throw new Error('Ungültiges Kundenbuch');
  const rows = await idbAll('customers');
  const byName = new Map(rows.map(r=>[normalizeName(r.value.name).toLowerCase(), r.value]));
  const replace = confirm('Kundenbuch ERSETZEN? (OK = ersetzen, Abbrechen = mergen)');
  if(replace){
    for(const r of rows){ await idbDel('customers', normalizeName(r.value.name).toLowerCase()); }
    for(const c of json.customers){ await upsertCustomer(c); }
  }else{
    for(const c of json.customers){
      const k = normalizeName(c.name).toLowerCase();
      byName.set(k, c);
    }
    for(const [k,v] of byName){ await idbSet('customers', k, v); }
  }
  await loadCustomerListToDatalist();
  alert('Kundenbuch importiert.');
}

// ---- Positionen ----
const itemsBody = document.getElementById('itemsBody');
function addItemRow(data={}){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="num qty" inputmode="decimal" placeholder="1" value="${data.qty ?? ''}"></td>
    <td><input class="unit" placeholder="Stk / Std / ..." value="${data.unit ?? ''}"></td>
    <td><textarea class="desc" placeholder="Beschreibung">${data.desc ?? ''}</textarea></td>
    <td><input class="num price" inputmode="decimal" placeholder="0,00" value="${data.price ?? ''}"></td>
    <td class="num lineTotal">–</td>
    <td><button title="Zeile entfernen" class="btn secondary del">✕</button></td>
  `;
  tr.querySelector('.del').addEventListener('click', () => { tr.remove(); updateTotals(); autosave(); });
  ['qty','price','unit','desc'].forEach(c=> tr.querySelector('.'+c).addEventListener('input', ()=>{ updateTotals(); autosave(); }));
  itemsBody.appendChild(tr);
}
function addHeadingRow(text='***Neue Sektion***'){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td colspan="6"><input class="heading" value="${text}" /></td>`;
  tr.querySelector('.heading').addEventListener('input', ()=> autosave());
  itemsBody.appendChild(tr);
}

// ---- Daten sammeln / befüllen ----
function serialize(){
  const rows = [];
  itemsBody.querySelectorAll('tr').forEach(tr=>{
    const heading = tr.querySelector('.heading');
    if(heading){ rows.push({ type:'heading', text: heading.value }); return; }
    const qty = tr.querySelector('.qty')?.value ?? '';
    const unit = tr.querySelector('.unit')?.value ?? '';
    const desc = tr.querySelector('.desc')?.value ?? '';
    const price = tr.querySelector('.price')?.value ?? '';
    if(qty || unit || desc || price){ rows.push({ type:'item', qty, unit, desc, price }); }
  });
  return {
    docType: $('#docType').value,
    invoiceNumber: $('#invoiceNumber').value,
    invoiceDate: $('#invoiceDate').value,
    deliveryDate: $('#deliveryDate').value,
    projectName: $('#projectName').value,
    clientName: $('#clientName').value,
    clientAddress: $('#clientAddress').value,
    clientRef: $('#clientRef').value,
    clientContact: $('#clientContact').value,
    vatRate: $('#vatRate').value || 19,
    currency: $('#currency').value || 'EUR',
    locale: $('#locale').value || 'de-DE',
    rows
  };
}
function populate(data){
  $('#docType').value = data.docType ?? 'Rechnung';
  $('#invoiceNumber').value = data.invoiceNumber ?? '';
  $('#invoiceDate').value = data.invoiceDate ?? '';
  $('#deliveryDate').value = data.deliveryDate ?? '';
  $('#projectName').value = data.projectName ?? '';
  $('#clientName').value = data.clientName ?? '';
  $('#clientAddress').value = data.clientAddress ?? '';
  $('#clientRef').value = data.clientRef ?? '';
  $('#clientContact').value = data.clientContact ?? '';
  $('#vatRate').value = data.vatRate ?? 19;
  $('#currency').value = data.currency ?? 'EUR';
  $('#locale').value = data.locale ?? 'de-DE';
  itemsBody.innerHTML = '';
  (data.rows ?? []).forEach(r=>{ if(r.type==='heading') addHeadingRow(r.text); else if(r.type==='item') addItemRow(r); });
  if((data.rows ?? []).length===0) addItemRow();
  updateTotals();
}

// ---- Summen & Vorschau ----
function updateTotals(){
  const locale = $('#locale').value || 'de-DE';
  const currency = $('#currency').value || 'EUR';
  const fmt = nf(locale, currency);
  let net = 0;
  itemsBody.querySelectorAll('tr').forEach(tr=>{
    const qtyEl = tr.querySelector('.qty'); const priceEl = tr.querySelector('.price'); const totalEl = tr.querySelector('.lineTotal');
    if(!qtyEl || !priceEl){ if(totalEl) totalEl.textContent=''; return; }
    const line = pf(qtyEl.value) * pf(priceEl.value);
    if(!isNaN(line)){ net += line; totalEl.textContent = line ? fmt.format(line) : '–'; } else totalEl.textContent='–';
  });
  const vatRate = pf($('#vatRate').value || 19);
  const vat = net * (vatRate/100);
  const gross = net + vat;
  return { net, vat, gross, fmt, vatRate };
}
function buildPreviewHTML(data){
  const { net, vat, gross, fmt, vatRate } = updateTotals();
  const dt = (s)=> s ? new Date(s).toLocaleDateString(data.locale || 'de-DE') : '';
  const money = (n)=> fmt.format(+n || 0);
  let rowsHTML = '';
  for(const r of (data.rows || [])){
    if(r.type==='heading'){
      rowsHTML += `<tr><td colspan="5" style="background:#f8fafc;font-weight:700">${escapeHTML(r.text || '')}</td></tr>`;
    } else if(r.type==='item'){
      const qty = pf(r.qty), price = pf(r.price), total = qty*price;
      rowsHTML += `
        <tr>
          <td class="right">${escapeHTML(r.qty || '')}</td>
          <td>${escapeHTML(r.unit || '')}</td>
          <td>${escapeHTML(r.desc || '')}</td>
          <td class="right">${r.price ? money(price) : ''}</td>
          <td class="right">${total ? money(total) : ''}</td>
        </tr>`;
    }
  }
  const docTitle = `${data.docType || 'Rechnung'} ${data.invoiceNumber || ''}`.trim();
  const delivery = data.deliveryDate ? `<div><small>Geliefert/Leistung am:</small><br>${dt(data.deliveryDate)}</div>` : '';
  const yourRef = data.clientRef ? `<div><small>Ihr Zeichen:</small><br>${escapeHTML(data.clientRef)}</div>` : '';
  const project = data.projectName ? `<div><small>Projekt:</small><br>${escapeHTML(data.projectName)}</div>` : '';
  return `
    <div class="head">
      <div>
        <div style="font-weight:700">Schreinermeister Carsten Hilbert</div>
        <div class="muted tiny" style="white-space:pre-wrap">Wormser Str. 12\n60598 Frankfurt am Main\nTel 069 / 123 456 – mail@example.com</div>
      </div>
      <div class="badge">${escapeHTML(data.docType || 'Rechnung')}</div>
    </div>
    <hr>
    <div class="grid2">
      <div>
        <div class="muted tiny">Rechnung an</div>
        <div style="font-weight:700">${escapeHTML(data.clientName || '')}</div>
        <div style="white-space:pre-wrap">${escapeHTML(data.clientAddress || '')}</div>
        ${data.clientContact ? `<div class="tiny muted">${escapeHTML(data.clientContact)}</div>` : ''}
      </div>
      <div class="right">
        <h1>${escapeHTML(docTitle)}</h1>
        <div>${dt(data.invoiceDate)}</div>
        ${project}
        ${yourRef}
        ${delivery}
      </div>
    </div>

    <hr>
    <table class="items">
      <thead>
        <tr>
          <th class="right" style="width:70px">Anz.</th>
          <th style="width:70px">Einh.</th>
          <th>Gegenstand / Beschreibung</th>
          <th class="right" style="width:120px">E-Preis</th>
          <th class="right" style="width:120px">G-Preis</th>
        </tr>
      </thead>
      <tbody>${rowsHTML || `<tr><td colspan="5" class="muted">Keine Positionen.</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div class="line"><div class="right muted">Netto</div><div class="right">${money(net)}</div></div>
      <div class="line"><div class="right muted">USt ${vatRate.toFixed(1).replace('.0','')} %</div><div class="right">${money(vat)}</div></div>
      <div class="line"><div class="right" style="font-weight:700">Gesamt</div><div class="right" style="font-weight:700">${money(gross)}</div></div>
    </div>

    <hr>
    <div class="foot tiny">
      Bitte zahlen Sie den Rechnungsbetrag innerhalb von 14 Tagen ohne Abzug. IBAN: DE00 0000 0000 0000 0000 00 · BIC: BANKDEFFXXX
    </div>
  `;
}
function updatePreview(){
  const data = serialize();
  document.getElementById('preview').innerHTML = buildPreviewHTML(data);
}

// ---- Autosave (IndexedDB) ----
async function autosave(){ await idbSet('form','current', serialize()); }
async function autoload(){
  const data = await idbGet('form','current');
  if(data){ populate(data); } else { document.getElementById('invoiceDate').value = todayStr(); addItemRow(); }
}

// ---- Historie (IndexedDB) ----
function makeHistoryKey(d){ return `${d.docType||'Rechnung'}|${(d.invoiceNumber||'').trim()}|${(d.clientName||'').trim()}|${d.invoiceDate||''}`; }
async function loadHistory(){ return (await idbAll('history')).map(r=>({id:r.key, ...r.value})); }
async function renderHistorySelect(){
  const sel = document.getElementById('historySelect');
  const q = (historyFilterText||'').toLowerCase().trim();
  const hist = (await loadHistory())
    .sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))
    .filter(e=>{
      if(!q) return true;
      const d = e.data || {};
      const hay = [d.docType,d.invoiceNumber,d.projectName,d.clientName,d.clientAddress,d.clientRef,d.clientContact,d.invoiceDate,e.createdAt]
        .map(x=> String(x||'').toLowerCase()).join(' ');
      return hay.includes(q);
    });
  sel.innerHTML='';
  const placeholder = document.createElement('option');
  placeholder.value=''; placeholder.textContent='— Auswahl —'; sel.appendChild(placeholder);
  for(const h of hist){
    const d = h.data||{}; const date = d.invoiceDate || (h.createdAt ? h.createdAt.slice(0,10) : '');
    const o = document.createElement('option');
    o.value = h.id; o.textContent = `${d.docType||'Rechnung'} ${d.invoiceNumber||''} · ${d.clientName||''} · ${date}`;
    sel.appendChild(o);
  }
}
let historyFilterText='';

function download(name, content, type='text/plain;charset=utf-8'){
  const blob = new Blob([content], {type}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),0);
}
function buildStandaloneHTML(data){
  const inner = buildPreviewHTML(data);
  const title = `${data.docType || 'Rechnung'} ${data.invoiceNumber || ''}`.trim() || 'Rechnung';
  const configScript = '<script>const CONFIG='+JSON.stringify({})+';<\/script>';
  return '<!doctype html>\
<html lang="de"><head><meta charset="utf-8">\
<meta name="viewport" content="width=device-width, initial-scale=1">\
<title>'+escapeHTML(title)+'</title>\
<style>\
  body{font:14px/1.45 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;color:#111;margin:0;padding:24px}\
  .doc{max-width:900px;margin:0 auto;background:#fff;padding:28px;border:1px solid #e5e7eb;border-radius:12px}\
  .right{text-align:right}.muted{color:#555}.tiny{font-size:12px}\
  .items{width:100%;border-collapse:collapse}\
  .items th,.items td{border:1px solid #e5e7eb;padding:6px 8px;vertical-align:top}\
  .items th{background:#f8fafc}\
  .totals{margin-top:12px;display:grid;gap:6px;justify-content:end}\
  .totals .line{display:grid;grid-template-columns:180px 160px;gap:8px;align-items:center}\
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;border:none;border-radius:0;max-width:none}}\
</style>\
</head><body>'+configScript+'\
<div class="doc">'+inner+'</div>\
</body></html>';
}

// ---- CSV Parser & Import ----
function parseCSV(text){
  const semi = (text.match(/;/g) || []).length;
  const comma = (text.match(/,/g) || []).length;
  const delim = semi > comma ? ';' : ',';
  const rows = [];
  let i=0, cur='', inQ=false, row=[];
  function pushCell(){ row.push(cur); cur=''; }
  function pushRow(){ rows.push(row); row=[]; }
  while(i < text.length){
    const c = text[i];
    if(c === '"'){
      if(inQ && text[i+1] === '"'){ cur += '"'; i+=2; continue; }
      inQ = !inQ; i++; continue;
    }
    if(!inQ && (c === '\n' || c === '\r')){
      pushCell(); pushRow();
      if(c === '\r' && text[i+1] === '\n') i++;
      i++; continue;
    }
    if(!inQ && c === delim){ pushCell(); i++; continue; }
    cur += c; i++;
  }
  if(cur.length || row.length) { pushCell(); pushRow(); }
  const header = (rows.shift() || []).map(h=> String(h||'').trim());
  return rows.filter(r=> r.length && r.some(x=> String(x||'').trim()!=='')).map(r=>{
    const obj = {}; header.forEach((h,idx)=> obj[h] = (r[idx] ?? '').trim()); return obj;
  });
}
function coerceInvoiceFromCSVRow(row){
  const d = {
    docType: row.docType || 'Rechnung',
    invoiceNumber: row.invoiceNumber || '',
    invoiceDate: row.invoiceDate || '',
    deliveryDate: row.deliveryDate || '',
    projectName: row.projectName || '',
    clientName: row.clientName || '',
    clientAddress: row.clientAddress || '',
    clientRef: row.clientRef || '',
    clientContact: row.clientContact || '',
    vatRate: row.vatRate || 19,
    currency: row.currency || 'EUR',
    locale: row.locale || 'de-DE',
    rows: []
  };
  if(row.items_json){
    try{
      const arr = JSON.parse(row.items_json);
      if(Array.isArray(arr)){
        for(const it of arr){
          if(it && (it.desc||it.qty||it.price||it.unit)){
            d.rows.push({ type:'item', qty:String(it.qty||''), unit:String(it.unit||''), desc:String(it.desc||''), price:String(it.price||'') });
          }
        }
      }
    }catch{}
  }
  if(d.rows.length===0){
    for(let n=1;n<=50;n++){
      const desc=row[`item${n}_desc`], qty=row[`item${n}_qty`], price=row[`item${n}_price`], unit=row[`item${n}_unit`];
      if(desc||qty||price||unit){ d.rows.push({ type:'item', qty:String(qty||''), unit:String(unit||''), desc:String(desc||''), price:String(price||'') }); }
    }
  }
  return d;
}

// ---- Events & Init ----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  const btn = document.getElementById('installBtn'); btn.style.display='inline-block';
  btn.onclick = async ()=>{
    if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; btn.style.display='none'; }
  };
});

(function start(){
  // Init data
  autoload().then(updatePreview);
  loadCustomerListToDatalist();
  renderHistorySelect();

  // preview toggle
  document.getElementById('togglePreview').addEventListener('click', ()=>{
    const main = document.getElementById('layout');
    const hidden = main.classList.toggle('preview-hidden');
    document.getElementById('togglePreview').textContent = hidden ? 'Vorschau einblenden' : 'Vorschau ausblenden';
  });

  // Items buttons
  document.getElementById('addItem').addEventListener('click', ()=>{ addItemRow(); autosave(); });
  document.getElementById('addHeading').addEventListener('click', ()=>{ addHeadingRow('***Arbeitsbereich***'); autosave(); });
  document.getElementById('clearItems').addEventListener('click', ()=>{
    if(!confirm('Alle Positionen wirklich entfernen?')) return;
    itemsBody.innerHTML=''; addItemRow(); updateTotals(); autosave();
  });

  // Form change
  ['docType','invoiceNumber','invoiceDate','deliveryDate','projectName','clientName','clientAddress','clientRef','clientContact','vatRate','currency','locale']
  .forEach(id=> document.getElementById(id).addEventListener('input', ()=>{ updateTotals(); autosave(); }));

  // Kundenbuch
  document.getElementById('saveCustomer').addEventListener('click', async ()=>{
    const name = normalizeName($('#clientName').value);
    if(!name) return alert('Bitte Kundennamen eingeben.');
    await upsertCustomer({ name, address: $('#clientAddress').value, contact: $('#clientContact').value });
    await loadCustomerListToDatalist();
    alert('Kunde gespeichert/aktualisiert.');
  });
  document.getElementById('renameCustomer').addEventListener('click', async ()=>{
    const oldName = normalizeName($('#clientName').value);
    if(!oldName) return alert('Bitte Kundennamen eingeben/auswählen.');
    const entry = await findCustomerByName(oldName);
    if(!entry) return alert('Kunde nicht im Kundenbuch.');
    const newName = prompt('Neuer Kundenname:', oldName);
    if(!newName || normalizeName(newName)===oldName) return;
    const exists = await findCustomerByName(newName);
    if(exists && exists.name.toLowerCase() !== oldName.toLowerCase()){
      if(!confirm('Kunde mit diesem Namen existiert bereits. Überschreiben?')) return;
      await deleteCustomerByName(newName);
    }
    entry.name = newName;
    await deleteCustomerByName(oldName);
    await upsertCustomer(entry);
    await loadCustomerListToDatalist();
    if(normalizeName($('#clientName').value).toLowerCase()===oldName.toLowerCase()) $('#clientName').value=newName;
    alert('Kunde umbenannt.');
  });
  document.getElementById('deleteCustomer').addEventListener('click', async ()=>{
    const name = normalizeName($('#clientName').value);
    if(!name) return alert('Bitte Kundennamen eingeben/auswählen.');
    const entry = await findCustomerByName(name);
    if(!entry) return alert('Kunde nicht im Kundenbuch.');
    if(!confirm(`Kunde „${entry.name}“ wirklich löschen?`)) return;
    await deleteCustomerByName(name);
    await loadCustomerListToDatalist();
    alert('Kunde gelöscht.');
  });
  document.getElementById('exportCustomerBook').addEventListener('click', exportCustomerBook);
  document.getElementById('importCustomerBookInput').addEventListener('change', async (ev)=>{
    const f = ev.target.files?.[0]; if(!f) return; try{ await importCustomerBook(f); }catch{ alert('Ungültige Kundenbuch-Datei.'); } ev.target.value='';
  });
  document.getElementById('clientName').addEventListener('change', async ()=>{
    const c = await findCustomerByName($('#clientName').value);
    if(c){ $('#clientAddress').value=c.address||''; $('#clientContact').value=c.contact||''; autosave(); }
  });

  // Preview
  document.getElementById('updatePreview').addEventListener('click', updatePreview);

  // Downloads
  document.getElementById('downloadHTML').addEventListener('click', async ()=>{
    const data = serialize();
    const base = makeBaseName(data);
    const html = buildStandaloneHTML(data);
    download(`${base}.html`, html, 'text/html;charset=utf-8');
    if($('#saveJsonTogether').checked){
      download(`${base}.json`, JSON.stringify(data,null,2), 'application/json;charset=utf-8');
    }
    await idbSet('history', Date.now()+Math.random(), { key: makeHistoryKey(data), createdAt: new Date().toISOString(), data });
    await renderHistorySelect();
  });
  document.getElementById('saveJSON').addEventListener('click', ()=>{
    const data = serialize();
    const base = makeBaseName(data);
    download(`${base}.json`, JSON.stringify(data,null,2), 'application/json;charset=utf-8');
  });
  document.getElementById('loadJSONInput').addEventListener('change', async (ev)=>{
    const f = ev.target.files?.[0]; if(!f) return;
    try{ const data = JSON.parse(await f.text()); populate(data); await autosave(); updatePreview(); }catch{ alert('Fehler beim Einlesen der JSON-Datei.'); }
    ev.target.value='';
  });

  // Historie
  const searchInput = document.getElementById('historySearch');
  let t=null; searchInput.addEventListener('input', ()=>{ clearTimeout(t); const v=searchInput.value; t=setTimeout(async ()=>{ historyFilterText=v; await renderHistorySelect(); }, 150); });
  document.getElementById('importHistoryCsvInput').addEventListener('change', async (ev)=>{
    const f = ev.target.files?.[0]; if(!f) return;
    try{
      const text = await f.text();
      const rows = parseCSV(text);
      if(!rows.length) return alert('CSV enthält keine Daten.');
      const asInvoices = rows.map(coerceInvoiceFromCSVRow);
      const existing = await loadHistory();
      const replace = confirm('CSV-Aufträge in Historie ERSETZEN? (OK = ersetzen, Abbrechen = mergen)');
      if(replace){
        for(const e of existing){ await idbDel('history', e.id); }
      }
      const byKey = new Map((await loadHistory()).map(h=>[h.key,h]));
      for(const d of asInvoices){
        const rec = { id: Date.now()+Math.random(), key: makeHistoryKey(d), createdAt: new Date().toISOString(), data: d };
        byKey.set(rec.key, rec);
      }
      // schreibe zurück
      for(const e of await loadHistory()){ await idbDel('history', e.id); }
      for(const r of byKey.values()){ await idbSet('history', r.id, { key:r.key, createdAt:r.createdAt, data:r.data }); }
      await renderHistorySelect();
      alert(`Import abgeschlossen: ${asInvoices.length} Datensätze.`);
    }catch(e){ console.error(e); alert('CSV konnte nicht importiert werden.'); }
    ev.target.value='';
  });
  document.getElementById('loadFromHistory').addEventListener('click', async ()=>{
    const id = $('#historySelect').value; if(!id) return alert('Bitte einen Auftrag auswählen.');
    const recs = await loadHistory(); const h = recs.find(x=> String(x.id)===String(id));
    if(!h) return alert('Auftrag nicht gefunden.'); populate(h.data); await autosave(); updatePreview();
  });
  document.getElementById('deleteFromHistory').addEventListener('click', async ()=>{
    const id = $('#historySelect').value; if(!id) return alert('Bitte einen Auftrag auswählen.');
    if(!confirm('Diesen Eintrag wirklich aus der Historie entfernen?')) return;
    await idbDel('history', Number(id)); await renderHistorySelect(); alert('Aus Historie entfernt.');
  });
  document.getElementById('exportFromHistory').addEventListener('click', async ()=>{
    const id = $('#historySelect').value; if(!id) return alert('Bitte einen Auftrag auswählen.');
    const recs = await loadHistory(); const h = recs.find(x=> String(x.id)===String(id));
    if(!h) return alert('Auftrag nicht gefunden.');
    const name = `${makeBaseName(h.data)}.json`; download(name, JSON.stringify(h.data,null,2), 'application/json;charset=utf-8');
  });

  // Reset form (mit Rückfrage)
  document.getElementById('resetForm').addEventListener('click', async ()=>{
    if(!confirm('Formular wirklich leeren? (Kunden & Historie bleiben erhalten)')) return;
    await idbSet('form','current', {});
    document.querySelectorAll('#formCard input, #formCard textarea').forEach(el=> el.value='');
    document.getElementById('invoiceDate').value = todayStr();
    itemsBody.innerHTML=''; addItemRow(); updateTotals();
    document.getElementById('preview').innerHTML = '<div class="muted">Zur Anzeige bitte „Vorschau aktualisieren“ klicken.</div>';
  });
})();