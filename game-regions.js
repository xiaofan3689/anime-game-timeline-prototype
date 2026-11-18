// Explicit region metadata takes precedence; existing feeds use regional IDs/names.
window.timelineIsForeignGame=game=>{
 const region=String(game.region||game.server||'').trim().toLowerCase();
 if(['cn','china','中国','国服','中国大陆','mainland'].includes(region))return false;
 if(['jp','japan','global','international','en','kr','korea','tw','hk','mo','sea','eu','na','日服','国际服','台服','韩服','港澳台服','美服','欧服','东南亚服'].includes(region))return true;
 return ['ba-jp','ba-global','czn','nikke'].includes(game.id)||/(?:^|[-_])(?:jp|global|international|en|kr|tw|hk|sea|eu|na)(?:$|[-_])/i.test(game.id||'')||/(?:日服|国际服|國際服|海外服|外服|全球服|台服|臺服|韩服|韓服|港澳台|港服|美服|欧服|歐服|东南亚服|東南亞服|日本服|\bglobal\b|\binternational\b|\bjapan\b)/i.test(game.name||'');
};
