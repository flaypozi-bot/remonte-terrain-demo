/* app.js - central script for login/signup/interface
   IMPORTANT: Replace FLOW_* placeholders with your Power Automate HTTP trigger URLs
*/
const FLOW_LOGIN_URL = "FLOW_LOGIN_URL";
const FLOW_SIGNUP_URL = "FLOW_SIGNUP_URL";
const FLOW_CREATE_DEMANDE_URL = "FLOW_CREATE_DEMANDE_URL";

/* ---------- Utilities ---------- */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }
function toast(msg, target='#msg'){
  const el = document.querySelector(target);
  if(el) el.innerText = msg;
  console.log('[APP]', msg);
}
async function postJSON(url, body){
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  return res;
}
function base64FromFile(file){
  return new Promise((resolve, reject)=>{
    if(!file) return resolve('');
    const r = new FileReader();
    r.onload = ()=> resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- SIGNUP ---------- */
async function initSignup(){
  const form = qs('#signupForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#email')?.value.trim();
    const nom = qs('#nom')?.value.trim();
    const role = qs('#role')?.value;
    if(!email || !nom){ toast('Veuillez renseigner nom et email','#message'); return; }
    toast('Envoi inscription...','#message');
    try{
      const r = await postJSON(FLOW_SIGNUP_URL, { email, nom, role });
      if(r.ok){
        toast('Inscription reçue — l’administrateur validera votre compte.','#message');
        form.reset();
      } else {
        const t = await r.text();
        toast('Erreur inscription: ' + (t || r.status), '#message');
      }
    }catch(err){ toast('Erreur réseau: '+err.message, '#message'); }
  });
}

/* ---------- LOGIN ---------- */
async function initLogin(){
  const form = qs('#loginForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#loginEmail')?.value.trim();
    const password = qs('#loginPassword')?.value;
    if(!email || !password){ toast('Email et mot de passe requis','#loginMsg'); return; }
    toast('Connexion...','#loginMsg');
    try{
      const r = await postJSON(FLOW_LOGIN_URL, { email, password });
      const data = await r.json();
      if(data.status === 'ok'){
        localStorage.setItem('user', JSON.stringify({ email:data.email, nom:data.nom }));
        // redirect to interface
        window.location.href = 'interface.html';
      } else if (data.status === 'notfound'){
        toast('Utilisateur non trouvé','#loginMsg');
      } else if (data.status === 'inactive'){
        toast('Compte non activé. Contactez un administrateur.','#loginMsg');
      } else {
        toast('Email ou mot de passe incorrect','#loginMsg');
      }
    }catch(err){ toast('Erreur réseau: ' + err.message, '#loginMsg'); }
  });
}

/* ---------- INTERFACE (create demande + dashboard counts) ---------- */
async function initInterface(){
  const user = JSON.parse(localStorage.getItem('user') || null);
  if(!user){ window.location.href = 'index.html'; return; }
  qs('#userNom') && (qs('#userNom').innerText = user.nom || user.email);
  qs('#logoutBtn') && qs('#logoutBtn').addEventListener('click', ()=>{
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  qs('#demForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = qs('#title')?.value.trim() || 'Remont terrain';
    const typeEquipement = qs('#typeEquip')?.value || '';
    const service = qs('#service')?.value || '';
    const priorite = qs('#prio')?.value || 'Moyenne';
    const commentaire = qs('#comment')?.value || '';
    const coordGPS = qs('#coordGPS')?.value || '';
    const file = qs('#photo')?.files[0] || null;
    qs('#demMsg') && (qs('#demMsg').innerText = 'Envoi en cours...');
    try{
      const base64 = await base64FromFile(file);
      const payload = {
        email: user.email,
        nom: user.nom || user.email,
        title,
        typeEquipement,
        coordGPS,
        commentaire,
        service,
        priorite,
        image_name: file ? Date.now() + '_' + file.name : '',
        image_base64: base64
      };
      const r = await postJSON(FLOW_CREATE_DEMANDE_URL, payload);
      if(r.ok){
        qs('#demMsg').innerText = 'Demande enregistrée.';
        qs('#demForm').reset();
        await loadCounts();
      } else {
        const t = await r.text();
        qs('#demMsg').innerText = 'Erreur: ' + (t || r.status);
      }
    }catch(err){ qs('#demMsg').innerText = 'Erreur réseau: ' + err.message; }
  });

  // load counters (calls SharePoint via a Flow you create, or uses client-side REST if you prefer)
  async function loadCounts(){
    // If you don't have a flow for counts, the simplest is to create one: FLOW_GET_COUNTS that accepts email and returns totals.
    if(typeof FLOW_GET_COUNTS_URL !== 'undefined' && FLOW_GET_COUNTS_URL){
      try {
        const r = await postJSON(FLOW_GET_COUNTS_URL, { email: user.email });
        const data = await r.json();
        qs('#countTotal') && (qs('#countTotal').innerText = data.total || 0);
        qs('#countInProgress') && (qs('#countInProgress').innerText = data.inProgress || 0);
        qs('#countClosed') && (qs('#countClosed').innerText = data.closed || 0);
        return;
      } catch(e){ console.warn('Get counts via flow failed', e); }
    }
    // Fallback: show placeholders
    qs('#countTotal') && (qs('#countTotal').innerText = '-');
    qs('#countInProgress') && (qs('#countInProgress').innerText = '-');
    qs('#countClosed') && (qs('#countClosed').innerText = '-');
  }

  loadCounts();
}

/* ---------- Auto init based on page content ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initSignup();
  initLogin();
  initInterface();
});
