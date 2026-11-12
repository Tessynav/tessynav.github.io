/* TessyNav v2 — voice.js
   Spoken instructions: the browser's own voice when it has one, otherwise Mapbox's voice service (the same words as
   audio), so it works even where the car's browser has no voices installed. One sentence at a time, newest first.
   v3: Voice volume (Normal / Loud / Extra loud): the voice is played through a compressor and a boost, so it's louder
   than the music without crackling; and an optional soft chime just before a turn. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Voice=function(){
  this.q=[];this.busy=false;this.audio=null;
  this.synth=typeof speechSynthesis!=='undefined'?speechSynthesis:null;
  if(this.synth&&this.synth.getVoices) this.synth.getVoices();   /* (voices load in the background) */
};
TN.Voice.prototype.on=function(){return !(TN.settings&&TN.settings.voice===false);};
/* the sound path for Loud / Extra loud: compressor (evens out quiet and loud syllables) then a boost */
TN.Voice.prototype.ctx=function(){
  if(this.ac===false) return null;
  try{if(!this.ac){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC){this.ac=false;return null;}
      this.ac=new AC();const c=this.ac.createDynamicsCompressor();c.threshold.value=-26;c.knee.value=8;c.ratio.value=6;c.attack.value=0.003;c.release.value=0.2;
      this.gain=this.ac.createGain();c.connect(this.gain);this.gain.connect(this.ac.destination);this.comp=c;}
    /* (the car's browser only lets sound start after a tap: until then, Normal volume and no chime, never silence) */
    if(this.ac.state!=='running'){try{this.ac.resume();}catch(e){}return null;}
    return this.ac;}catch(e){this.ac=false;return null;}
};
/* unlocked by the first tap anywhere (and by changing the voice settings) */
TN.Voice.prototype.unlock=function(){try{const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC||this.ac===false) return;
  if(!this.ac) this.ctx();else if(this.ac.state!=='running') this.ac.resume();}catch(e){}};
if(typeof document!=='undefined') for(const ev of ['pointerdown','touchstart','keydown']) document.addEventListener(ev,()=>{try{TN.voice&&TN.voice.unlock();}catch(e){}},{passive:true,capture:true});
TN.Voice.prototype.boost=function(){const v=TN.settings&&TN.settings.voiceVol;return v==='xloud'?3.2:v==='loud'?2.0:1;};
/* a soft two-note chime (made on the spot, no file), then call next */
TN.Voice.prototype.chime=function(next){
  const ac=this.ctx();if(!ac){next();return;}
  try{const t0=ac.currentTime+0.02,g=ac.createGain();g.connect(ac.destination);
    for(const [f,dt] of [[880,0],[1175,0.16]]){const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const e=ac.createGain();
      e.gain.setValueAtTime(0,t0+dt);e.gain.linearRampToValueAtTime(0.35*Math.min(1.6,this.boost()),t0+dt+0.02);e.gain.exponentialRampToValueAtTime(0.001,t0+dt+0.35);
      o.connect(e);e.connect(g);o.start(t0+dt);o.stop(t0+dt+0.4);}
    setTimeout(next,520);}catch(e){next();}
};
TN.Voice.prototype.englishVoice=function(){
  if(!this.synth||!this.synth.getVoices) return null;
  const vs=this.synth.getVoices()||[];if(!vs.length) return null;
  if(TN.LANG==='fr') return vs.find(v=>/fr[-_]CA/i.test(v.lang))||vs.find(v=>/fr[-_]FR/i.test(v.lang))||vs.find(v=>/^fr/i.test(v.lang))||null;
  return vs.find(v=>/en[-_]CA/i.test(v.lang))||vs.find(v=>/en[-_]US/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
};
/* say something; "urgent" replaces whatever is waiting (an instruction about to happen beats an older one) */
TN.Voice.prototype.say=function(text,urgent,turn){
  if(TN.tr) text=TN.tr(text);   /* (French when the app is in French) */
  if(!this.on()||!text) return;
  text=text.charAt(0).toUpperCase()+text.slice(1);
  if(urgent) this.q=[];
  this.q.push(turn?{t:text,chime:true}:text);if(this.q.length>3) this.q.shift();
  if(!this.busy) this.next();
};
TN.Voice.prototype.next=function(){
  let t=this.q.shift();if(!t){this.busy=false;return;}
  /* (the chime, when on, only right before the instruction at the turn itself) */
  if(typeof t==='object'){const tt=t.t;if(t.chime&&TN.settings&&TN.settings.chime){this.busy=true;this.chime(()=>{this.q.unshift(tt);this.next();});return;}t=tt;}
  this.busy=true;this.last=t;
  const done=()=>{this.busy=false;setTimeout(()=>this.next(),150);};
  const v=this.englishVoice();
  if(v){try{const u=new SpeechSynthesisUtterance(t);u.voice=v;u.lang=v.lang;u.rate=1.02;u.onend=done;u.onerror=done;this.synth.speak(u);this.mode='browser';
      setTimeout(()=>{if(this.busy&&this.last===t) done();},12000);return;}catch(e){}}
  /* no browser voice: Mapbox's voice service */
  /* (French: the Canadian French voice for the Québec accent; if the voice service has none, the France one) */
  const vl=TN.LANG==='fr'?(TN.QC&&!this.noCA?'fr-CA':'fr-FR'):'en-US';
  const url='https://api.mapbox.com/voice/v1/speak/'+encodeURIComponent(t)+'?textType=text&language='+vl+'&outputFormat=mp3&access_token='+TN.MBX;
  /* Loud / Extra loud: the sound is fetched and played through the compressor and boost; if anything about that
     fails, it's played the normal way */
  const B=this.boost(),ac=B>1?this.ctx():null;
  if(ac){let alive=true;const tm=setTimeout(()=>{if(alive&&this.busy&&this.last===t){alive=false;done();}},12000);
    fetch(url).then(r=>{if(!r.ok) throw 0;return r.arrayBuffer();}).then(buf=>new Promise((ok,no)=>ac.decodeAudioData(buf,ok,no))).then(ab=>{
      if(!alive) return;const s=ac.createBufferSource();s.buffer=ab;this.gain.gain.value=B;s.connect(this.comp);this.src=s;
      s.onended=()=>{if(alive){alive=false;clearTimeout(tm);done();}};s.start();this.mode='mapbox+';})
      .catch(()=>{if(!alive) return;alive=false;clearTimeout(tm);this.plain(url,t,done);});
    return;}
  this.plain(url,t,done);
};
TN.Voice.prototype.plain=function(url,t,done){
  try{
    const a=new Audio(url);
    if(/language=fr-CA/.test(url)) a.addEventListener('error',()=>{this.noCA=true;},{once:true});   /* (no Canadian voice: France voice from now on) */
    this.audio=a;this.mode='mapbox';a.onended=done;a.onerror=done;
    const p=a.play();if(p&&p.catch) p.catch(done);
    setTimeout(()=>{if(this.busy&&this.last===t) done();},12000);
  }catch(e){done();}
};
TN.Voice.prototype.stop=function(){this.q=[];try{this.synth&&this.synth.cancel();}catch(e){}try{this.audio&&this.audio.pause();}catch(e){}try{this.src&&this.src.stop();}catch(e){}this.busy=false;};
TN.voice=new TN.Voice();
