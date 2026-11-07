/* TessyNav v2 — i18n.js (v1)
   French for the whole app. The app is written in English; when the language setting is French, every text the app
   puts on screen is swapped for its French version as it appears (a watcher on the page), and spoken instructions go
   through the same translation with a French voice. Texts with numbers or names inside ("In 300 metres, turn right
   onto Rue Wellington") are handled by patterns, with proper French grammar for the turn instructions.
   Nothing in the app's logic depends on this file: in English it does nothing.
   - TN.LANG: 'en' or 'fr' (⚙ → App → Language; changing it restarts the app)
   - TN.tr(text): the French version of an English text (or the text itself) */
var TN=globalThis.TN||{};globalThis.TN=TN;   /* (same as the other files) */
(function(){
let lang='en';
try{const s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};if(s.lang==='fr') lang='fr';}catch(e){}
TN.LANG=lang;
const FR=lang==='fr';

/* ---------- plain texts ---------- */
const D={
  /* main screen */
  'Search a place or address':'Chercher un lieu ou une adresse','Recenter':'Recentrer','Report':'Signaler','Version':'Version',
  'Record':'Enregistrer','● Record':'● Enregistrer','■ Stop':'■ Arrêter','Trips':'Trajets','Start':'Démarrer','Settings':'Réglages',
  'Highway':'Autoroute','Main street':'Artère','Street':'Rue','Service road':'Voie de service','Road':'Route','off road':'hors route',
  'Finding Tessy…':'Recherche de Tessy…','Finding the road…':'Recherche de la route…','outside the map':'hors carte',
  'Location not available':'Position non disponible','Waiting for GPS…':'En attente du GPS…',
  'Roads: © OpenStreetMap contributors':'Routes : © contributeurs OpenStreetMap',
  'Preparing the map…':'Préparation de la carte…','Building the streets…':'Construction des rues…','Ready':'Prêt',
  'Navigation for Tesla':'Navigation pour Tesla','TessyNav v2 · test':'TessyNav v2 · test',
  /* search, places, favorites */
  'Show all nearby on map':'Tout afficher à proximité','Cancel adding a stop':'Annuler l’ajout d’un arrêt','Back to your route':'Retour à l’itinéraire',
  'No results':'Aucun résultat','Cancel':'Annuler','Keep':'Garder','Home':'Domicile','Work':'Travail','as it is':'tel quel','Tap to set':'Toucher pour définir',
  'Set':'Définir','Favorite':'Favori','Search your home address':'Chercher votre adresse de domicile','Search your work address':'Chercher votre adresse de travail',
  'Place':'Lieu','Quebec':'Québec','Search is not available right now':'La recherche n’est pas disponible pour le moment','Could not open that place':'Impossible d’ouvrir ce lieu',
  'Close':'Fermer','Add a stop on the way':'Ajouter un arrêt en chemin','Tap a pin to choose':'Touchez une épingle pour choisir','Tap a pin':'Touchez une épingle',
  'Go':'Y aller','Back':'Retour','Dropped pin':'Épingle','Save':'Enregistrer','☆ Save':'☆ Enregistrer','Set as Home':'Définir comme domicile','Set as Work':'Définir comme travail',
  'Remove from favorites':'Retirer des favoris','Add to favorites':'Ajouter aux favoris','Your trip':'Votre trajet','Trip':'Trajet',
  /* route overview and guidance */
  'Calculating the route…':'Calcul de l’itinéraire…','Could not find a route':'Aucun itinéraire trouvé','End route':'Terminer','+ Stop':'+ Arrêt',
  'Voice on':'Voix activée','Voice off':'Voix désactivée','live traffic':'circulation en direct','Live traffic':'Circulation en direct',
  'Recalculating…':'Recalcul…','Recalculating':'Recalcul de l’itinéraire','Arriving':'Arrivée','You have arrived':'Vous êtes arrivé',
  'your destination':'votre destination','Arrive at your stop':'Arrivée à votre arrêt','Arrive at your destination':'Arrivée à destination',
  /* recording, trips, updates */
  'Encrypting and uploading…':'Chiffrement et envoi…','Send this name to Claude.':'Envoyez ce nom à Claude.','Try again':'Réessayer','Copy':'Copier',
  'No recordings yet.':'Aucun enregistrement pour l’instant.','Use Record on a drive, then they show up here. Rocco is waiting for your first one.':'Utilisez Enregistrer pendant un trajet : il apparaîtra ici. Rocco attend le premier.',
  'Recordings':'Enregistrements','Upload it':'L’envoyer','Delete':'Supprimer','no connection':'pas de connexion',
  'Stop the recording first, then update.':'Arrêtez d’abord l’enregistrement, puis faites la mise à jour.','Updating TessyNav':'Mise à jour de TessyNav',
  'Checking GitHub…':'Vérification sur GitHub…','Update now':'Mettre à jour','Later':'Plus tard','You have the latest version.':'Vous avez la dernière version.',
  'Update available ›':'Mise à jour disponible ›','New update arrived':'Nouvelle mise à jour arrivée','New update ready · it will be offered when you stop':'Nouvelle mise à jour prête · elle sera proposée à l’arrêt',
  'GitHub is taking longer than usual to publish. Try Version again in a few minutes.':'GitHub prend plus de temps que d’habitude. Réessayez Version dans quelques minutes.',
  'Finishing the update… GitHub is still publishing the new files.':'Fin de la mise à jour… GitHub publie encore les nouveaux fichiers.',
  '↻ Update ready':'↻ Mise à jour prête','Loading the new version…':'Chargement de la nouvelle version…',
  'Upload is not set up in this browser yet. Open the main TessyNav once and use Trips → Setup.':'L’envoi n’est pas configuré dans ce navigateur. Ouvrez TessyNav et utilisez Trajets → Configuration.',
  /* settings */
  'Standard':'Standard','Navigation':'Navigation','no tolls':'sans péages','no highways':'sans autoroutes','no ferries':'sans traversiers','no unpaved':'sans routes non pavées',
  'Voice instructions':'Instructions vocales','Spoken turns, arrival and alerts':'Virages, arrivée et alertes à voix haute',
  'Turn arrows on the road':'Flèches de virage sur la route','White arrows on the route line before your next turn':'Flèches blanches sur l’itinéraire avant le prochain virage',
  'Bird’s-eye view at exits':'Vue d’en haut aux sorties','The camera rises before exits (instead of the drawing in the bar)':'La caméra monte avant les sorties (au lieu du dessin dans la barre)',
  'ROUTE PREFERENCES':'PRÉFÉRENCES D’ITINÉRAIRE','For your next route':'Pour votre prochain itinéraire','Avoid toll roads':'Éviter les péages','Avoid highways':'Éviter les autoroutes',
  'Avoid ferries':'Éviter les traversiers','Avoid unpaved roads':'Éviter les routes non pavées','GUIDANCE':'GUIDAGE',
  'Car on the route':'Voiture sur l’itinéraire','Glued everywhere':'Collée partout','Glued in turns':'Collée dans les virages','Normal tracking':'Suivi normal','follows my lane':'suit ma voie',
  'How the car is drawn while you follow a route':'Comment la voiture est affichée pendant le guidage','Glue the car in turns':'Coller la voiture dans les virages',
  'Glue the car everywhere':'Coller la voiture partout','Always on the route line (can drift sideways on straight roads)':'Toujours sur l’itinéraire (peut glisser de côté en ligne droite)',
  'Follow my lane on wide roads':'Suivre ma voie sur les routes larges','Highways and bridges with 3+ lanes: the car takes your lane (moves sideways more)':'Autoroutes et ponts de 3 voies et plus : la voiture prend votre voie (bouge plus de côté)',
  'Alerts':'Alertes','Fun mode':'Mode amusant','ON YOUR WAY':'SUR VOTRE CHEMIN','Road incidents':'Incidents routiers',
  'Accidents, closures, works and traffic on your way':'Accidents, fermetures, travaux et circulation sur votre chemin','Speed cameras':'Radars photo',
  'Fixed, red-light and mobile zones (Quebec)':'Fixes, feux rouges et zones mobiles (Québec)','Railway crossings':'Passages à niveau','Before level crossings on your way':'Avant les passages à niveau sur votre chemin',
  'School zones':'Zones scolaires','Schools on your way: weekdays 7:00 to 17:00, September to June':'Écoles sur votre chemin : en semaine de 7 h à 17 h, de septembre à juin',
  'ON SCREEN':'À L’ÉCRAN','Speed limit sign':'Panneau de limite de vitesse','Turns red when you are over':'Devient rouge quand vous la dépassez',
  'Rocco the raccoon and his jokes on alert cards':'Rocco le raton laveur et ses blagues sur les alertes','Map and view':'Carte et vue','Light: auto':'Lumière : auto',
  'Always day':'Toujours le jour','Always night':'Toujours la nuit','TIME OF DAY':'MOMENT DE LA JOURNÉE','Light':'Lumière','Auto':'Auto','Day':'Jour','Night':'Nuit',
  'Night brightness':'Luminosité de nuit','Softer':'Plus doux','Darker':'Plus sombre','Traffic colours when browsing the map':'Couleurs de circulation en explorant la carte',
  'See-through around Tessy':'Transparence autour de Tessy','Bridges and buildings in front of the car fade':'Les ponts et bâtiments devant la voiture s’estompent',
  'Zoom buttons':'Boutons de zoom','Pinching the map works too':'Pincer la carte fonctionne aussi','3D details':'Détails 3D','THE CITY':'LA VILLE',
  'Detailed buildings':'Bâtiments détaillés','Trees':'Arbres','REM trains and labels':'Trains du REM et étiquettes','Animated water':'Eau animée','LIGHT AND SEASONS':'LUMIÈRE ET SAISONS',
  'Shadows':'Ombres','Follow the real sun; the car always has a soft shadow':'Suivent le vrai soleil; la voiture a toujours une ombre douce','Street light glow':'Halo des lampadaires',
  'At night':'La nuit','Real weather':'Météo réelle','Rain, snow, fog and clouds from the live weather':'Pluie, neige, brouillard et nuages selon la météo en direct',
  'Leaves and snow':'Feuilles et neige','FOR FUN':'POUR LE PLAISIR','Rainbow road':'Route arc-en-ciel',
  'The route line flows through the colours (hides traffic colours on it)':'L’itinéraire passe par toutes les couleurs (cache les couleurs de circulation)',
  'App':'Application','Rocco theme':'Thème Rocco','Tesla theme':'Thème Tesla','Futuristic theme':'Thème futuriste','version, recording':'version, enregistrement',
  'LOOK':'APPARENCE','Theme':'Thème','Rocco':'Rocco','Tesla':'Tesla','Futuristic':'Futuriste','Tesla: light by day, dark at night':'Tesla : clair le jour, sombre la nuit',
  'APP':'APPLICATION','Opening animation':'Animation d’ouverture','Record and Trips buttons':'Boutons Enregistrer et Trajets',
  'For test drives (hidden while navigating)':'Pour les essais (cachés pendant le guidage)','Version and updates':'Version et mises à jour','Check ›':'Vérifier ›',
  'MAP':'CARTE','Falling, on the ground and on the car (autumn leaves; snow when there is some)':'Qui tombent, au sol et sur la voiture (feuilles d’automne; neige quand il y en a)',
  'Superchargers on the map':'Superchargeurs sur la carte','Tap one for its stalls and to go there':'Touchez-en un pour ses bornes et pour y aller',
  'Other fast chargers':'Autres bornes rapides','FLO, Circuit électrique, Electrify Canada… (adapter needed)':'FLO, Circuit électrique, Electrify Canada… (adaptateur requis)',
  'Tesla Supercharger':'Superchargeur Tesla','Fast charger':'Borne rapide','Add as a stop':'Ajouter comme arrêt',
  'Language':'Langue','this car':'cette voiture','rainbow road':'route arc-en-ciel','Fun mode off':'Mode amusant désactivé',
  /* alerts */
  'School zone':'Zone scolaire','Railway crossing':'Passage à niveau','Speed camera':'Radar photo','Speed and red-light camera':'Radar photo et feu rouge',
  'Red-light camera':'Caméra de feu rouge','Mobile radar zone':'Zone de radar mobile','Standstill':'Circulation arrêtée','Heavy traffic':'Circulation dense',
  'Moderate traffic':'Circulation ralentie','Pothole':'Nid-de-poule','Accident':'Accident','Fog':'Brouillard','Danger on the road':'Danger sur la route',
  'Heavy rain':'Forte pluie','Ice':'Glace','Lane closed':'Voie fermée','Road closed':'Route fermée','Road works':'Travaux','Strong wind':'Vents forts',
  'Flooding':'Inondation','Stopped vehicle':'Véhicule arrêté','Police':'Police','Incident':'Incident','Point':'Point','Transports Québec':'Transports Québec',
  'Reported by a driver':'Signalé par un conducteur','Still there':'Encore là','Gone':'Disparu','Thanks! Rocco updated it.':'Merci! Rocco l’a mis à jour.',
  'Thanks! Rocco crossed it out.':'Merci! Rocco l’a rayé.','Thanks! Rocco will warn other drivers.':'Merci! Rocco avertira les autres conducteurs.',
  'Could not send the report right now':'Impossible d’envoyer le signalement pour le moment',
  /* Rocco's jokes (adapted, not word for word) */
  'Oops! Someone kissed a bumper.':'Oups! Quelqu’un a embrassé un pare-chocs.','Fender-bender ahead. Rocco is taking notes.':'Accrochage devant. Rocco prend des notes.',
  'Bumper cars, but not the fun kind.':'Autos tamponneuses, mais pas les amusantes.','Cone collector at work.':'Collectionneur de cônes au travail.',
  'Orange cones: Montreal’s official tree.':'Cônes orange : l’arbre officiel de Montréal.','Rocco is supervising. Very hard work.':'Rocco supervise. Travail très exigeant.',
  'Nope. Not today.':'Non. Pas aujourd’hui.','Road’s taking a nap.':'La route fait la sieste.','Even Rocco can’t sneak through here.':'Même Rocco ne peut pas se faufiler ici.',
  'One lane down. Squeeze politely.':'Une voie en moins. On se tasse poliment.','Zipper merge time!':'Fermeture éclair, chacun son tour!',
  'Lanes are like snacks: someone took one.':'Les voies, c’est comme les collations : quelqu’un en a pris une.','Someone needs a hug and a tow.':'Quelqu’un a besoin d’un câlin et d’une remorqueuse.',
  'Car took a coffee break.':'Une auto prend sa pause café.','Stopped car ahead. Give it some room.':'Auto arrêtée devant. Laissez-lui de la place.',
  'Ice ice baby. Slow down.':'C’est glacé, ralentissez.','Rocco tried skating here. It didn’t end well.':'Rocco a essayé de patiner ici. Ça a mal fini.',
  'Slippery! Easy on the brakes.':'Glissant! Doucement sur les freins.','Rocco can’t see his own tail.':'Rocco ne voit même plus sa queue.',
  'Pea soup ahead. Lights on.':'Brouillard épais devant. Allumez vos phares.','Mystery fog. Slow and steady.':'Brouillard mystère. Lentement mais sûrement.',
  'Rocco brought his floaties.':'Rocco a apporté ses flotteurs.','Car wash for free. Not recommended.':'Lave-auto gratuit. Pas recommandé.',
  'Water on the road. Go around.':'De l’eau sur la route. Contournez.','Wipers on, Rocco’s umbrella out.':'Essuie-glaces en marche, parapluie de Rocco sorti.',
  'Big rain. Bigger following distance.':'Grosse pluie, plus de distance.','Hold on to your tuque!':'Tenez bien votre tuque!',
  'Windy! Rocco’s tail is everywhere.':'Ça vente! La queue de Rocco part dans tous les sens.','Something on the road. Eyes open!':'Quelque chose sur la route. Ouvrez l’œil!',
  'Rocco spotted trouble ahead.':'Rocco voit un problème devant.','Smile, you’re on camera!':'Souriez, vous êtes filmé!','Rocco says: speed limit, my friend.':'Rocco dit : la limite, mon ami.',
  'Slow down: future drivers crossing.':'Ralentissez : futurs conducteurs qui traversent.','Rocco walked to school uphill both ways. Slow down.':'Rocco marchait à l’école en montée dans les deux sens. Ralentissez.',
  'Kids, buses and crossing guards ahead.':'Enfants, autobus et brigadiers devant.','Look both ways. Trains don’t brake for raccoons.':'Regardez des deux côtés. Les trains ne freinent pas pour les ratons laveurs.',
  'Choo choo! Rocco is listening for trains.':'Tchou tchou! Rocco écoute les trains.','Tracks ahead. Slow down, look, listen.':'Voie ferrée devant. Ralentissez, regardez, écoutez.',
  'Smile! Rocco checked your speed.':'Souriez! Rocco a vérifié votre vitesse.','Say cheese at the speed limit.':'Dites « ouistiti » à la limite de vitesse.','Flash photography ahead.':'Photo au flash devant.',
  'Speed and red lights: Rocco sees both.':'Vitesse et feux rouges : Rocco voit tout.','Green means go, red means photo.':'Vert, on passe; rouge, on pose.',
  'Red means stop. Rocco means it.':'Rouge veut dire arrêt. Rocco est sérieux.','Yellow is not a dare.':'Le jaune n’est pas un défi.','Camera loves a full stop.':'La caméra adore les arrêts complets.',
  'Rocco spotted a radar hideout.':'Rocco a repéré une cachette de radar.','Mobile radar zone. Easy on the pedal.':'Zone de radar mobile. Doucement sur la pédale.',
  'The radar might be home today.':'Le radar est peut-être là aujourd’hui.','Rocco fell asleep. Nobody’s moving.':'Rocco s’est endormi. Personne ne bouge.',
  'Parking lot mode: on.':'Mode stationnement : activé.','Time to learn some French verbs.':'Le temps de réviser vos verbes.','Rocco brought snacks.':'Rocco a apporté des collations.',
  'Perfect time for a podcast.':'Le moment parfait pour un balado.','Bumper to bumper. Breathe.':'Pare-chocs à pare-chocs. Respirez.',
  'Rocco is counting cars. He’s at 300.':'Rocco compte les autos. Il est rendu à 300.','Hi! Mind my house.':'Allô! Attention à ma maison.',
  'Rocco’s swimming pool. Go around.':'La piscine de Rocco. Contournez.','Montreal’s famous craters.':'Les fameux cratères de Montréal.','Something’s up ahead.':'Il se passe quelque chose devant.',
  /* Rocco's tips */
  'Glue in turns gives the smoothest ride.':'Collée dans les virages, c’est le trajet le plus doux.','Tap Record before a drive, then send me the trip name.':'Touchez Enregistrer avant un trajet, puis envoyez-moi le nom.',
  'Report a jam with the Report button: other drivers will thank you.':'Signalez un bouchon avec le bouton Signaler : les autres conducteurs vous remercieront.',
  'Home and Work are one tap away in the search box.':'Domicile et Travail sont à une touche, dans la recherche.','Avoid tolls and highways from Navigation, for your next route.':'Évitez péages et autoroutes dans Navigation, pour votre prochain itinéraire.',
  'Shadows follow the real sun. Try a drive at golden hour.':'Les ombres suivent le vrai soleil. Essayez un trajet à l’heure dorée.',
  'Railway crossings, cameras and incidents: only the ones on your way.':'Passages à niveau, radars et incidents : seulement ceux sur votre chemin.',
  'Fun mode off? I’ll stay, but quietly.':'Mode amusant désactivé? Je reste, mais discrètement.'
};

/* ---------- turn instructions (French grammar) ---------- */
const INS={
  'Continue':'Continuez','Exit the roundabout':'Sortez du carrefour giratoire','Arrive at your destination':'Arrivée à destination','Arrive at your stop':'Arrivée à votre arrêt',
  'Head out':'Partez','Merge':'Insérez-vous','Merge left':'Insérez-vous à gauche','Merge right':'Insérez-vous à droite',
  'Take the ramp':'Prenez la bretelle','Take the ramp on the left':'Prenez la bretelle à gauche','Take the ramp on the right':'Prenez la bretelle à droite',
  'Take the exit':'Prenez la sortie','Take the exit on the left':'Prenez la sortie à gauche','Take the exit on the right':'Prenez la sortie à droite',
  'Turn left':'Tournez à gauche','Turn right':'Tournez à droite','Turn slight left':'Tournez légèrement à gauche','Turn slight right':'Tournez légèrement à droite',
  'Turn sharp left':'Tournez franchement à gauche','Turn sharp right':'Tournez franchement à droite','Turn uturn':'Faites demi-tour','Turn straight':'Continuez tout droit','Turn':'Tournez',
  'Keep left':'Restez à gauche','Keep right':'Restez à droite','Keep straight':'Continuez tout droit','Keep':'Continuez','Arrive':'Arrivée'
};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1),low=s=>s.charAt(0).toLowerCase()+s.slice(1);
const ord=n=>n===1?'1re':n+'e';
const num=s=>String(s).replace(/(\d)\.(\d)/g,'$1,$2');
/* an English instruction ("turn right", "Take the exit on the left") in French, keeping a lowercase start if it had one */
function ins(t){
  if(!t) return null;const lc=/^[a-z]/.test(t),k=cap(t.trim());let r=INS[k];
  if(r==null){let m;
    if((m=k.match(/^Head on (.+)$/))) r='Partez sur '+m[1];
    else if((m=k.match(/^At the roundabout, take exit (\d+)$/))) r='Au carrefour giratoire, prenez la '+ord(+m[1])+' sortie';}
  if(r==null) return null;
  return lc?low(r):r;
}
const dist=(n,unit)=>unit==='metres'?n+' mètres':num(n)+' kilomètres';

/* ---------- texts with numbers or names inside ---------- */
const R=[
  [/^In (\d+) metres, (.+?)(?: onto (.+))?$/,m=>{const i=ins(m[2]);return i?'Dans '+m[1]+' mètres, '+low(i)+(m[3]?' sur '+m[3]:''):null;}],
  [/^Then: (.+?)(?: onto (.+))?$/,m=>{const i=m[1]==='arrive'?'arrivée':ins(m[1]);return i?'Ensuite : '+low(i)+(m[2]?' sur '+m[2]:''):null;}],
  [/^(.+?) onto (.+)$/,m=>{const i=ins(m[1]);return i?i+' sur '+m[2]:null;}],
  [/^Starting route to (.+)$/,m=>'Départ vers '+(m[1]==='your destination'?'votre destination':m[1])],
  [/^You have arrived at (.+)$/,m=>'Vous êtes arrivé à '+(m[1]==='your destination'?'destination':m[1])],
  [/^Moderate traffic ahead, ([\d.]+) (metres|kilometres)$/,m=>'Circulation ralentie à '+dist(m[1],m[2])],
  [/^(.+?)( reported)? ahead, ([\d.]+) (metres|kilometres)$/,m=>(D[m[1]]||m[1])+(m[2]?', signalé par un conducteur,':'')+' à '+dist(m[3],m[4])],
  [/^Next: (.+)$/,m=>'Prochain arrêt : '+m[1]],
  [/^(\d+) places$/,m=>m[1]+' arrêts'],
  [/^(\d+) stalls$/,m=>m[1]+' bornes'],
  [/^up to (\d+) kW$/,m=>'jusqu’à '+m[1]+' kW'],
  [/^arrive (\d+:\d+)$/,m=>'arrivée '+m[1]],
  [/^avoiding (.+)$/,m=>'en évitant '+m[1].replace(/toll roads|tolls/,'les péages').replace('highways','les autoroutes').replace('ferries','les traversiers').replace('unpaved roads','les routes non pavées').replace(/ and /g,' et ')],
  [/^(\d+) min ago$/,m=>'il y a '+m[1]+' min'],
  [/^(\d+) confirmed$/,m=>m[1]+' confirmation'+(+m[1]>1?'s':'')],
  [/^(\d+) of (\d+) on$/,m=>m[1]+' sur '+m[2]+' activés'],
  [/^(.+) off$/,m=>D[m[1]]?D[m[1]]+' désactivé':null],
  [/^Tip: (.+)$/,m=>'Astuce : '+(D[m[1]]||m[1])],
  [/^(\d+(?:\.\d+)?) km$/,m=>num(m[1])+' km'],
  [/^GPS (\d+) m$/,()=>null],
  [/^Looking for “(.+)” nearby…$/,m=>'Recherche de « '+m[1]+' » à proximité…'],
  [/^Nothing called “(.+)” nearby$/,m=>'Aucun « '+m[1]+' » à proximité'],
  [/^Every “(.+)” around you$/,m=>'Tous les « '+m[1]+' » autour de vous'],
  [/^(.+) removed from favorites$/,m=>m[1]+' retiré des favoris'],
  [/^(.+) added to favorites$/,m=>m[1]+' ajouté aux favoris'],
  [/^(.+) removed$/,m=>m[1]+' retiré'],
  [/^(Home|Work) saved: (.+)$/,m=>(m[1]==='Home'?'Domicile':'Travail')+' enregistré : '+m[2]],
  [/^Uploaded! Trip name: (.+)$/,m=>'Envoyé! Nom du trajet : '+m[1]],
  [/^Trip name: (.+)$/,m=>'Nom du trajet : '+m[1]],
  [/^Copied: (.+)$/,m=>'Copié : '+m[1]],
  [/^Upload failed: (.+)$/,m=>'Échec de l’envoi : '+m[1]],
  [/^A recording was saved before the app closed \((\d+) min\)\.$/,m=>'Un enregistrement a été sauvegardé avant la fermeture de l’application ('+m[1]+' min).'],
  [/^Getting the new version… (\d+)%$/,m=>'Téléchargement de la nouvelle version… '+m[1]+' %'],
  [/^Update available: (.+)$/,m=>'Mise à jour disponible : '+m[1]],
  [/^Running now: (.+)$/,m=>'Version actuelle : '+m[1]],
  [/^Updated: (.+)$/,m=>'Mis à jour : '+m[1]],
  [/^Could not check: (.+)$/,m=>'Vérification impossible : '+m[1]],
  [/^Trying again in (\d+) s \(try (\d+) of 8\)$/,m=>'Nouvel essai dans '+m[1]+' s (essai '+m[2]+' sur 8)'],
  [/^Live traffic: the map key was refused \((.*)$/,m=>'Circulation en direct : la clé de carte a été refusée ('+m[1]],
  [/^■ Stop (\d+:\d+)$/,m=>'■ Arrêter '+m[1]],
  [/^Trip (.+)$/,m=>'Trajet '+m[1]],
];

const cache=new Map();
function one(k){
  if(D[k]!=null) return D[k];
  const i=ins(k);if(i!=null) return i;
  if(k.indexOf('· ')===0){const t=one(k.slice(2));return t!=null?'· '+t:null;}   /* ("· outside the map") */
  /* texts made of parts ("12 min · 4.3 km · arrive 21:40"): each part on its own */
  if(k.indexOf(' · ')>0){let ch=false;const o=k.split(' · ').map(p=>{const t=one(p.trim());if(t!=null){ch=true;return t;}return p;});return ch?o.join(' · '):null;}
  for(const [re,f] of R){const m=k.match(re);if(m){const v=f(m);if(v!=null) return v;}}
  return null;
}
TN.tr=function(s){
  if(!FR||s==null) return s;s=String(s);
  if(!/[A-Za-z]/.test(s)) return s;
  if(cache.has(s)) return cache.get(s);
  const k=s.replace(/\s+/g,' ').trim();let r=one(k);
  r=r==null?s:s.match(/^\s*/)[0]+r+s.match(/\s*$/)[0];   /* (keeps the spaces around the text) */
  if(cache.size>4000) cache.clear();
  cache.set(s,r);return r;
};

/* ---------- the watcher: translates what the app puts on screen ---------- */
const SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,CANVAS:1,svg:1};
function skip(el){for(let e=el;e&&e.nodeType===1;e=e.parentNode){if(SKIP[e.nodeName]||(e.classList&&e.classList.contains('notr'))) return true;}return false;}
function txt(n){const v=n.nodeValue;if(!v||v.length>600||!/[A-Za-z]/.test(v)) return;if(skip(n.parentNode)) return;const t=TN.tr(v);if(t!==v) n.nodeValue=t;}
function attrs(el){for(const a of ['placeholder','title','aria-label']){const v=el.getAttribute&&el.getAttribute(a);if(v){const t=TN.tr(v);if(t!==v) el.setAttribute(a,t);}}}
function walk(root){
  if(root.nodeType===3){txt(root);return;}
  if(root.nodeType!==1||skip(root)) return;
  attrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;
  while((n=w.nextNode())){if(n.nodeType===3) txt(n);else attrs(n);}
}
TN.i18nStart=function(){
  if(!FR||TN.i18nOn||!document.body||typeof MutationObserver==='undefined'||!document.createTreeWalker) return;TN.i18nOn=true;
  document.documentElement.lang='fr';
  walk(document.body);
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='characterData') txt(m.target);
    else if(m.type==='attributes') attrs(m.target);
    else for(const n of m.addedNodes) walk(n);}})
    .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
};
if(FR&&typeof document!=='undefined'){if(document.body) TN.i18nStart();else document.addEventListener('DOMContentLoaded',TN.i18nStart);}
})();
