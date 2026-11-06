/* TessyNav v2 — rocco.js
   Rocco the raccoon, the face of TessyNav: one drawing shared by the settings button, the settings page, the opening
   screen, the app icon (browser tab and home screen) and a few messages. Drawn, not an emoji, so he is sharp at any size.
   His tips only show with Fun mode on; with it off he stays as the app's face but quiet. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.ROCCO_PARTS='<path d="M-44 -30 L-30 -58 L-14 -36Z" fill="#6b6f76"/><path d="M44 -30 L30 -58 L14 -36Z" fill="#6b6f76"/>'+
  '<path d="M-38 -34 L-30 -50 L-20 -38Z" fill="#2b2d31"/><path d="M38 -34 L30 -50 L20 -38Z" fill="#2b2d31"/>'+
  '<ellipse cx="0" cy="2" rx="48" ry="42" fill="#8d9199"/>'+
  '<path d="M-46 -2 Q-24 -22 0 -8 Q24 -22 46 -2 Q36 18 18 12 Q8 4 0 10 Q-8 4 -18 12 Q-36 18 -46 -2Z" fill="#26282c"/>'+
  '<circle cx="-18" cy="0" r="8" fill="#fff"/><circle cx="18" cy="0" r="8" fill="#fff"/>'+
  '<circle cx="-17" cy="1" r="4.5" fill="#111"/><circle cx="19" cy="1" r="4.5" fill="#111"/>'+
  '<circle cx="-15.5" cy="-1" r="1.6" fill="#fff"/><circle cx="20.5" cy="-1" r="1.6" fill="#fff"/>'+
  '<ellipse cx="0" cy="24" rx="20" ry="14" fill="#e9ebee"/><ellipse cx="0" cy="17" rx="6" ry="4" fill="#1b1c1f"/>'+
  '<path d="M-8 27 Q0 34 8 27" stroke="#1b1c1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
/* Rocco as an inline picture, size in pixels */
TN.roccoSVG=function(size,extra){return '<svg class="tn-rocco" width="'+size+'" height="'+size+'" viewBox="-60 -62 120 120" aria-hidden="true"'+(extra?' '+extra:'')+'>'+TN.ROCCO_PARTS+'</svg>';};
/* the same drawing as an image file (for the opening screen's canvas and the icons) */
TN.roccoURL=function(bg){
  const b=bg?'<rect x="-60" y="-62" width="120" height="120" rx="26" fill="'+bg+'"/><g transform="scale(0.82) translate(0 4)">'+TN.ROCCO_PARTS+'</g>':TN.ROCCO_PARTS;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -62 120 120">'+b+'</svg>');
};
TN.roccoImage=function(){if(!TN._roccoImg&&typeof Image!=='undefined'){TN._roccoImg=new Image();TN._roccoImg.src=TN.roccoURL();}return TN._roccoImg;};
/* Rocco's tips for the settings page (one at a time, changing each time it opens) */
TN.ROCCO_TIPS=['Glue in turns gives the smoothest ride.','Tap Record before a drive, then send me the trip name.','Report a jam with the Report button: other drivers will thank you.',
  'Home and Work are one tap away in the search box.','Avoid tolls and highways from Navigation, for your next route.','Shadows follow the real sun. Try a drive at golden hour.',
  'Railway crossings, cameras and incidents: only the ones on your way.','Fun mode off? I\u2019ll stay, but quietly.'];
TN.roccoTip=function(){TN._tipI=((TN._tipI==null?Math.floor(Math.random()*TN.ROCCO_TIPS.length):TN._tipI+1))%TN.ROCCO_TIPS.length;return TN.ROCCO_TIPS[TN._tipI];};

/* the app icon: Rocco in the browser tab, and on a phone's home screen */
(function(){
  if(typeof document==='undefined') return;
  const set=(rel,href,type,sizes)=>{let l=document.querySelector('link[rel="'+rel+'"]');if(!l){l=document.createElement('link');l.rel=rel;document.head.appendChild(l);}l.href=href;if(type) l.type=type;if(sizes) l.sizes=sizes;};
  try{set('icon',TN.roccoURL('#0f1722'),'image/svg+xml');}catch(e){}
  /* (home screens want a picture file: Rocco drawn once on a canvas) */
  try{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=180;const x=c.getContext('2d');x.drawImage(img,0,0,180,180);set('apple-touch-icon',c.toDataURL('image/png'),null,'180x180');}catch(e){}};img.src=TN.roccoURL('#0f1722');}catch(e){}
})();
