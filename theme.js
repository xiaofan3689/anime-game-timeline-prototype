// Use existing game artwork without downloading or inventing character assets.
const scene=document.createElement("div");scene.className="anime-scene";scene.setAttribute("aria-hidden","true");document.body.prepend(scene);
const sceneImage=document.createElement("img");sceneImage.alt="";sceneImage.decoding="async";scene.append(sceneImage);
let sceneUrl="",themePrefs={game:"auto",strength:100};
try{const saved=JSON.parse(localStorage.getItem("timeline-theme-v1"));if(saved&&typeof saved.game==="string")themePrefs.game=saved.game;if(Number.isFinite(saved?.strength))themePrefs.strength=Math.max(10,Math.min(100,saved.strength))}catch{}
const themeButton=n("button","","✧ 背景设置");themeButton.type="button";themeButton.id="theme-settings-button";document.querySelector(".top-actions").append(themeButton);
const themeDialog=document.createElement("dialog");themeDialog.className="theme-dialog";
const themeTitle=n("h2","","我的游戏背景"),themeLabel=n("label","","背景来源"),themeSelect=document.createElement("select"),strengthLabel=n("label","","背景显现程度"),strength=document.createElement("input"),themeStatus=n("p","theme-status",""),closeTheme=n("button","","完成");
strength.type="range";strength.min="10";strength.max="100";strength.value=themePrefs.strength;themeLabel.append(themeSelect);strengthLabel.append(strength);themeDialog.append(themeTitle,themeLabel,strengthLabel,n("p","","自动模式：全部游戏时，每10秒随机播放已选游戏的背景；筛选单一游戏时跟随该游戏。固定背景不轮播。"),themeStatus,closeTheme);document.body.append(themeDialog);
function saveTheme(){document.documentElement.style.setProperty("--scene-strength",themePrefs.strength/100);try{localStorage.setItem("timeline-theme-v1",JSON.stringify(themePrefs));themeStatus.textContent="已保存到当前浏览器"}catch{themeStatus.textContent="浏览器禁止保存，设置仅在本次访问有效"}}
function themeOptions(){themeSelect.replaceChildren(new Option("自动跟随所选游戏","auto"),new Option("纯星空渐变","none"));for(const g of S.feed?.games||[])if(url(g.bannerUrl))themeSelect.add(new Option(g.name,g.id));themeSelect.value=[...themeSelect.options].some(o=>o.value===themePrefs.game)?themePrefs.game:"auto"}
themeButton.onclick=()=>{themeOptions();themeDialog.showModal()};closeTheme.onclick=()=>themeDialog.close();themeSelect.onchange=()=>{themePrefs.game=themeSelect.value;saveTheme();updateScene()};strength.oninput=()=>{themePrefs.strength=Number(strength.value);saveTheme()};document.documentElement.style.setProperty("--scene-strength",themePrefs.strength/100);

function sceneCandidates(){
 return (S.feed?.games||[]).filter(g=>S.selected.has(g.id)&&(S.game==="all"||S.game===g.id)&&url(g.bannerUrl));
}
function nextSceneUrl(candidates,current,rotate){
 const urls=[...new Set(candidates.map(g=>url(g.bannerUrl)).filter(Boolean))];
 if(!urls.length)return "";
 if(!rotate&&urls.includes(current))return current;
 const choices=urls.filter(value=>value!==current);
 const pool=choices.length?choices:urls;
 return pool[Math.floor(Math.random()*pool.length)];
}
function updateScene(rotate=false){
 if(!S.feed)return;
 let next="";
 if(themePrefs.game==="auto")next=nextSceneUrl(sceneCandidates(),sceneUrl,rotate&&S.game==="all");
 else if(themePrefs.game!=="none"){const game=S.feed.games.find(g=>g.id===themePrefs.game);next=game?url(game.bannerUrl)||"":""}
 if(next===sceneUrl)return;sceneUrl=next;sceneImage.hidden=true;
 sceneImage.onload=()=>{sceneImage.hidden=false};sceneImage.onerror=()=>{sceneImage.hidden=true};
 if(next)sceneImage.src=next;else sceneImage.removeAttribute("src");
}
// Timed rotation only affects automatic/all-games mode; normal renders keep the current image.
setInterval(()=>{if(!document.hidden&&themePrefs.game==="auto"&&S.game==="all")updateScene(true)},10000);
const previousThemeRender=render;render=function(){previousThemeRender();updateScene()};updateScene();
