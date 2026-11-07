/* TessyNav v2 — tesla.js (v1)
   The connection to your Tesla, through the TessyNav server (Cloudflare Worker), which holds the app's secret:
   - signIn(): Tesla's sign-in page; you come back through tesla.html, which stores the access in this browser
   - getTrip(nav): reads Tessy's active navigation (destination, minutes, battery at arrival) once, and opens the
     route to it in TessyNav. With Supercharger stops, Tesla gives the next stop (the Supercharger) first.
   Nothing is read in the background: one request per tap (about $0.002, within Tesla's free monthly credit). */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.TESLA_SERVER='https://tessynav.mznwattar.workers.dev';
TN.Tesla=function(){};
TN.TESLA_T=sz=>'<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24"><path d="M12 6.2c2.6 0 5.6.5 7.6 1.6l.6-1.5C17.9 5 15 4.4 12 4.4S6.1 5 3.8 6.3l.6 1.5C6.4 6.7 9.4 6.2 12 6.2zm0 2c-1.6 0-3.4.2-4.6.7l.4 1.1c.9-.3 2.1-.5 3.1-.5v10.3h2.2V9.5c1 0 2.2.2 3.1.5l.4-1.1c-1.2-.5-3-.7-4.6-.7z" fill="#e31937"/></svg>';
TN.Tesla.prototype.load=function(){try{return JSON.parse(localStorage.getItem('tn2_tesla')||'null');}catch(e){return null;}};
TN.Tesla.prototype.save=function(a){try{localStorage.setItem('tn2_tesla',JSON.stringify(a));}catch(e){}};
TN.Tesla.prototype.connected=function(){const a=this.load();return !!(a&&a.refresh);};
TN.Tesla.prototype.signIn=function(){
  const st=Math.random().toString(36).slice(2)+Date.now().toString(36);
  try{localStorage.setItem('tn2_tesla_state',st);}catch(e){}
  location.href=TN.TESLA_SERVER+'/login?state='+st+'&locale='+(TN.LANG==='fr'?'fr-CA':'en-CA');
};
TN.Tesla.prototype.signOut=function(){try{localStorage.removeItem('tn2_tesla');}catch(e){}};
/* a valid access token, renewed through the server when it is about to expire */
TN.Tesla.prototype.token=async function(){
  const a=this.load();if(!a||!a.refresh) throw new Error('signin');
  if(a.access&&a.exp>Date.now()+60000) return a.access;
  const r=await fetch(TN.TESLA_SERVER+'/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:a.refresh})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token){if(r.status===400||r.status===401){this.signOut();throw new Error('signin');}throw new Error('server');}
  a.access=j.access_token;a.exp=Date.now()+(j.expires_in||28800)*1000;if(j.refresh_token) a.refresh=j.refresh_token;this.save(a);
  return a.access;
};
TN.Tesla.prototype.api=async function(path){
  const t=await this.token();
  const r=await fetch(TN.TESLA_SERVER+path,{headers:{Authorization:'Bearer '+t}});
  const j=await r.json().catch(()=>({}));
  return {status:r.status,j:j};
};
/* which car: the first one on the account (remembered) */
TN.Tesla.prototype.vehicle=async function(){
  const a=this.load();if(a&&a.vin) return a.vin;
  const r=await this.api('/api/1/vehicles');
  const v=r.j&&r.j.response&&r.j.response[0];if(!v) throw new Error('novehicle');
  const b=this.load()||{};b.vin=v.vin;b.name=v.display_name||'';this.save(b);return v.vin;
};
/* Tessy's active trip, as Tesla's navigation has it */
TN.Tesla.prototype.trip=async function(){
  const vin=await this.vehicle();
  const r=await this.api('/api/1/vehicles/'+vin+'/vehicle_data?endpoints='+encodeURIComponent('location_data;drive_state'));
  if(r.status===408) return {asleep:true};
  if(r.status===401){this.signOut();throw new Error('signin');}
  if(r.status!==200) throw new Error('tesla '+r.status);
  const d=(r.j.response&&r.j.response.drive_state)||{};
  if(d.active_route_latitude==null||d.active_route_longitude==null) return {none:true};
  return {name:d.active_route_destination||'Tesla destination',lat:d.active_route_latitude,lng:d.active_route_longitude,
    min:d.active_route_minutes_to_arrival,km:d.active_route_miles_to_arrival!=null?d.active_route_miles_to_arrival*1.609:null,
    energy:d.active_route_energy_at_arrival};
};
TN.Tesla.prototype.getTrip=async function(nav){
  const say=m=>{if(nav&&nav.toast) nav.toast(m);};
  say('Asking Tessy…');
  try{
    const t=await this.trip();
    if(t.asleep){say('Tessy is asleep. Try again from the car.');return;}
    if(t.none){say('No trip in Tessy’s navigation');return;}
    const sub=['From Tessy'];if(t.energy!=null) sub.push(Math.round(t.energy)+'% at arrival');
    if(nav) nav.pick({name:t.name,sub:sub.join(' \u00b7 '),lng:t.lng,lat:t.lat,fromTesla:true});
  }catch(e){
    if(e.message==='signin'){say('Connect your Tesla first');return;}
    if(e.message==='novehicle'){say('No car found on this Tesla account');return;}
    say('Could not reach Tessy right now');
  }
};
TN.tesla=new TN.Tesla();
