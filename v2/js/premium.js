/* TessyNav v2 — premium.js (v1)
   Who has Premium, in this car's browser:
   - every new driver: 14 days of Premium from the first time TessyNav opens here (no card, no sign-in)
   - a subscriber or a beta tester: signed in on the Account page (tn2_premium, kept in this browser); the plan is asked
     again from TessyNav's server twice a day, and kept for up to 3 days without a connection
   Premium features: Montréal's landmarks in 3D, weather ahead, faster route alerts, parking rules, themes and
   Always day / Always night. Free drivers see a small "Premium" hint at the moment one of them would have helped
   (once per kind per drive), never a pop-up that blocks the screen. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.PRO_API='https://tessynav.mznwattar.workers.dev';
TN.PRO_TRIAL_DAYS=14;
(function(){
  const get=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const set=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
  /* the 14 free days start the first time the app opens in this browser */
  let t0=parseInt(get('tn2_trial0')||'0',10);if(!t0){t0=Date.now();set('tn2_trial0',String(t0));}
  TN.proTrialEnd=t0+TN.PRO_TRIAL_DAYS*864e5;
  TN.proAccount=function(){try{return JSON.parse(get('tn2_premium')||'null');}catch(e){return null;}};
  /* Premium right now: the free days, or the account's plan (its paid or free period, with 3 days of grace) */
  TN.isPro=function(){
    if(/[?&]free=1/.test(location.search)) return false;   /* (to test the free version: ?free=1) */
    if(Date.now()<TN.proTrialEnd) return true;
    const P=TN.proAccount();if(!P||!P.premium) return false;
    const end=Math.max(P.trialEnd||0,P.renews||0,P.cancelAt||0)*1000;
    if(end&&Date.now()<end+3*864e5) return true;
    return Date.now()-(P.at||0)<3*864e5;
  };
  TN.proTrialDaysLeft=function(){return Math.max(0,Math.ceil((TN.proTrialEnd-Date.now())/864e5));};
  /* the plan, asked again twice a day when signed in (a cancelled plan turns off by itself) */
  TN.proRefresh=async function(force){
    const P=TN.proAccount();if(!P||!P.token) return;
    if(!force&&Date.now()-(P.at||0)<12*36e5) return;
    try{const r=await fetch(TN.PRO_API+'/premium/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:P.token})});
      if(r.status===401){set('tn2_premium','');return;}
      const j=await r.json();if(!j||!j.ok) return;
      set('tn2_premium',JSON.stringify({token:j.token,email:j.email,premium:!!j.premium,status:j.status||null,plan:j.plan||null,trialEnd:j.trialEnd||null,
        renews:j.renews||null,cancelAt:j.cancelAt||null,trial:false,betaEnded:j.betaEnded||null,at:Date.now()}));
    }catch(e){}
  };
  setTimeout(()=>TN.proRefresh(),8000);setInterval(()=>TN.proRefresh(),36e5);
  /* the hint for free drivers: a small chip at the top for 6 s, once per kind per drive */
  const shown={};
  TN.proHint=function(kind,txt,force){
    if(TN.isPro()||(shown[kind]&&!force)||typeof document==='undefined') return;shown[kind]=1;
    let el=document.getElementById('tn-prohint');
    if(!el){el=document.createElement('div');el.id='tn-prohint';el.className='notr';
      el.style.cssText='position:absolute;left:50%;top:84px;transform:translateX(-50%);z-index:8;display:none;align-items:center;gap:10px;padding:9px 16px;border-radius:99px;'+
        'background:rgb(var(--tn-panel-rgb,24 26 30) / .94);color:var(--tn-text,#fff);font:600 15px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none;white-space:nowrap';
      document.body.appendChild(el);}
    el.innerHTML='<span>'+TN.esc(txt)+'</span><span style="font-size:12px;padding:3px 9px;border-radius:99px;background:rgba(242,163,58,.2);color:#f2a33a">Premium</span>';
    el.style.display='flex';clearTimeout(TN._proT);TN._proT=setTimeout(()=>{el.style.display='none';},6000);
    try{if(TN.rec&&TN.rec.note) TN.rec.note('premium hint',{kind});}catch(e){}
  };
  /* when the free days end: one card, once, to say what changed */
  TN.proEndCard=function(){
    if(TN.isPro()||get('tn2_trialEndSaid')||Date.now()<TN.proTrialEnd||typeof document==='undefined') return;
    set('tn2_trialEndSaid','1');const fr=TN.LANG==='fr';
    const el=document.createElement('div');el.className='notr';
    el.style.cssText='position:absolute;left:16px;bottom:120px;z-index:8;max-width:min(430px,calc(100vw - 32px));background:rgb(var(--tn-panel-rgb,24 26 30) / .96);color:var(--tn-text,#fff);border-radius:16px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);border-left:5px solid #f2a33a';
    el.innerHTML='<b>'+(fr?'Vos 14 jours de Premium sont terminés':'Your 14 days of Premium have ended')+'</b><div style="opacity:.85;margin-top:4px">'+
      (fr?'Les repères en 3D, la météo sur la route, les trajets plus rapides, les règles de stationnement et les thèmes font partie de Premium. Tout le reste reste gratuit.'
         :'Landmarks in 3D, weather ahead, faster routes, parking rules and themes are part of Premium. Everything else stays free.')+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:10px"><a href="../account.html" style="background:#f2a33a;color:#1b0f02;padding:8px 14px;border-radius:10px;font-weight:600;text-decoration:none">'+(fr?'Voir Premium':'See Premium')+'</a>'+
      '<button style="background:#3a3f47;color:#fff;border:0;padding:8px 14px;border-radius:10px;font:600 14px system-ui">'+(fr?'Plus tard':'Later')+'</button></div>';
    document.body.appendChild(el);el.querySelector('button').onclick=()=>el.remove();
  };
  setTimeout(()=>{try{TN.proEndCard();}catch(e){}},15000);
})();
