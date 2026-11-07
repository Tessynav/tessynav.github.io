/* TessyNav v2 — voice.js
   Spoken instructions: the browser's own voice when it has one, otherwise Mapbox's voice service (the same words as
   audio), so it works even where the car's browser has no voices installed. One sentence at a time, newest first. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Voice=function(){
  this.q=[];this.busy=false;this.audio=null;
  this.synth=typeof speechSynthesis!=='undefined'?speechSynthesis:null;
  if(this.synth&&this.synth.getVoices) this.synth.getVoices();   /* (voices load in the background) */
};
TN.Voice.prototype.on=function(){return !(TN.settings&&TN.settings.voice===false);};
TN.Voice.prototype.englishVoice=function(){
  if(!this.synth||!this.synth.getVoices) return null;
  const vs=this.synth.getVoices()||[];if(!vs.length) return null;
  if(TN.LANG==='fr') return vs.find(v=>/fr[-_]CA/i.test(v.lang))||vs.find(v=>/fr[-_]FR/i.test(v.lang))||vs.find(v=>/^fr/i.test(v.lang))||null;
  return vs.find(v=>/en[-_]CA/i.test(v.lang))||vs.find(v=>/en[-_]US/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
};
/* say something; "urgent" replaces whatever is waiting (an instruction about to happen beats an older one) */
TN.Voice.prototype.say=function(text,urgent){
  if(TN.tr) text=TN.tr(text);   /* (French when the app is in French) */
  if(!this.on()||!text) return;
  text=text.charAt(0).toUpperCase()+text.slice(1);
  if(urgent) this.q=[];
  this.q.push(text);if(this.q.length>3) this.q.shift();
  if(!this.busy) this.next();
};
TN.Voice.prototype.next=function(){
  const t=this.q.shift();if(!t){this.busy=false;return;}
  this.busy=true;this.last=t;
  const done=()=>{this.busy=false;setTimeout(()=>this.next(),150);};
  const v=this.englishVoice();
  if(v){try{const u=new SpeechSynthesisUtterance(t);u.voice=v;u.lang=v.lang;u.rate=1.02;u.onend=done;u.onerror=done;this.synth.speak(u);this.mode='browser';
      setTimeout(()=>{if(this.busy&&this.last===t) done();},12000);return;}catch(e){}}
  /* no browser voice: Mapbox's voice service */
  try{
    const a=new Audio('https://api.mapbox.com/voice/v1/speak/'+encodeURIComponent(t)+'?textType=text&language='+(TN.LANG==='fr'?'fr-FR':'en-US')+'&outputFormat=mp3&access_token='+TN.MBX);
    this.audio=a;this.mode='mapbox';a.onended=done;a.onerror=done;
    const p=a.play();if(p&&p.catch) p.catch(done);
    setTimeout(()=>{if(this.busy&&this.last===t) done();},12000);
  }catch(e){done();}
};
TN.Voice.prototype.stop=function(){this.q=[];try{this.synth&&this.synth.cancel();}catch(e){}try{this.audio&&this.audio.pause();}catch(e){}this.busy=false;};
TN.voice=new TN.Voice();
