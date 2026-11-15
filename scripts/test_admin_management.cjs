const fs=require("fs"),vm=require("vm"),assert=require("assert");
const elements={};function el(){return {hidden:true,value:"",children:[],replaceChildren(){this.children=[];this.value=""},add(o){this.children.push(o);if(!this.value)this.value=o.value},append(o){this.children.push(o)},scrollIntoView(){}}}
for(const id of ["manager","manage-game-filter","managed-events","edit-selected-game","add-selected-event","manage-games","manage-events"])elements[id]=el();
const context={state:{data:{games:[],events:[]}},window:{catalog:[{id:"ys",name:"原神"}],sourceEvents:[{id:"event1",gameId:"ys",title:"测试活动",sourceType:"community"}]},location:{hash:""},$:id=>elements[id],document:{createElement:()=>el()},Option:function(text,value){this.text=text;this.value=value},notice(){},edit(kind,index){context.edited={kind,index}},markDirty(){},load:async()=>{},Map};
const source=fs.readFileSync("admin/app.js","utf8");vm.createContext(context);vm.runInContext(source.slice(source.indexOf("function manage(selected)")),context);
elements["manage-games"].onclick();assert.equal(elements.manager.hidden,false);assert.equal(elements["manage-game-filter"].value,"ys");assert.equal(elements["managed-events"].children.length,1);
elements["edit-selected-game"].onclick();assert.equal(context.edited.kind,"game");assert.equal(context.state.data.games[0].id,"ys");
elements["managed-events"].children[0].onclick();assert.equal(context.edited.kind,"event");assert.equal(context.state.data.events[0].id,"event1");console.log("PASS management opens, catalog game edits, synced activity edits");
