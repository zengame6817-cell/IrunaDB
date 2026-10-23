const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(__dirname,'..');
function setup(empty=false){
 const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',dataset:{},handlers:{},addEventListener(k,f){this.handlers[k]=f;},insertAdjacentHTML(_,s){this.innerHTML+=s;},before(){},setAttribute(){},focus(){},replaceChildren(){this.innerHTML='';},closest(){return node(id+'-parent');},append(){}});return nodes.get(id);}
 const lookup=id=>[...nodes.values()].find(n=>n.id===id)||node(id);
 const handlers={},views=[],scrolls=[];const document={getElementById:lookup,createElement:tag=>node(tag+nodes.size),addEventListener(k,f){handlers[k]=f;}};
 const ctx={document,requestAnimationFrame:f=>f(),window:{scrollY:0,scrollTo(v){scrolls.push(v.top);},IrunaModal:{close(){}},IrunaCatalogBridge:{show(v){views.push(v);}},IrunaCatalogModel:require('../js/catalog-model.js'),IrunaLocationElements:require('../js/location-elements.js')}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/utils.js'),'utf8'),ctx);vm.runInNewContext(fs.readFileSync(path.join(root,'js/location-browser.js'),'utf8'),ctx);
 const items=['いし','◇クリスタ','未知','ぼうし'].map((n,i)=>({'アイテムID':'I'+i,'名前':n,'分類':i===1?'クリスタ':i===3?'追加':'素材'}));
 const maps=[{'マップID':'M1','マップ名':'テスト平原','階層':'エリア1'},{'マップID':'M2','マップ名':'テスト平原','階層':'エリア2'}];
 const monsters=[{'モンスターID':'A','属性':'火','名前':'コロン','Lv下限':1,'Lv上限':2,'備考':'表示しない調査メモ','難易度':'未確認'},{'モンスターID':'B','名前':'コロン','Lv下限':10,'Lv上限':10}];
 const spawns=[{'マップID':'M1','モンスターID':'A'},{'マップID':'M2','モンスターID':'B'}];
 const drops=[['D1','A','I0',1],['D2','A','I1',4],['D3','A','I2',''],['D4','B','I0',2],['D5','A','I3','']].map(([id,m,i,s])=>({'ドロップID':id,'モンスターID':m,'アイテムID':i,'ドロップ枠':s,'備考':'日本語名で照合。枠番号・確率・難易度別条件・現在の開催状況は未確認。','確認日':'2026-10-16'}));
 if(empty){drops.length=0;monsters[0]['確認状態']='ドロップなし確認';}
 const browser=ctx.window.IrunaLocationsBrowser.create({items,maps,monsters,spawns,drops,recipes:[],results:[]});return{browser,node:lookup,views,scrolls,back:()=>handlers.click({target:{closest:()=>({hasAttribute:k=>k==='data-location-back'})}})};
}
test('map and area selection show only corresponding monsters and linked drop lists without audit text',()=>{
 const {browser,node}=setup();browser.render();browser.navigate('map','M1');
 let html=node('locationDetail').innerHTML;assert(html.includes('コロン Lv1～2'));assert(html.includes('属性：火'));assert(!html.includes('コロン Lv10'));assert(!html.includes('第1ドロップ'));assert(!html.includes('第4ドロップ'));assert(html.includes('data-item="I1"'));assert(!html.includes('枠未確認'));assert(html.indexOf('data-item="I2"')<html.indexOf('data-item="I3"'));assert(html.indexOf('data-item="I3"')<html.indexOf('data-item="I1"'));assert(html.includes('data-item="I0"'));assert(html.includes('data-item="I2"'));assert(!html.includes('確認日'));assert(!html.includes('日本語名で照合'));assert(!html.includes('難易度'));assert.equal(node('dropList').innerHTML,'');
 browser.navigate('map','M2');html=node('locationDetail').innerHTML;assert(html.includes('コロン Lv10'));assert(html.includes('属性：未確認'));assert(!html.includes('コロン Lv1～2'));assert(html.includes('data-item="I0"'));assert(!html.includes('data-item="I1"'));assert.equal(node('dropArea').value,'M2');
 browser.navigate('monster','A');assert(!node('locationDetail').innerHTML.includes('表示しない調査メモ'));assert(!node('locationDetail').innerHTML.includes('難易度'));
 browser.search(true);assert.equal(node('dropMap').value,'');assert.equal(node('dropArea').disabled,true);
});
test('source-confirmed no drops is distinct from an unregistered empty list',()=>{
 const {browser,node}=setup(true);browser.navigate('monster','A');assert(node('locationDetail').innerHTML.includes('<li>ドロップなし</li>'));assert(!node('locationDetail').innerHTML.includes('ドロップ情報は未登録'));
 browser.navigate('monster','B');assert(node('locationDetail').innerHTML.includes('ドロップ情報は未登録です。'));
});

test('map filters keep all areas until a specific area is selected',()=>{const {browser,node}=setup();browser.render();node('dropMap').value='テスト平原';node('dropMap').handlers.change();assert(node('dropCount').textContent.includes('ドロップ5件'));node('dropArea').value='M2';node('dropArea').handlers.change();assert(node('dropCount').textContent.includes('ドロップ1件'));assert(node('dropList').innerHTML.includes('data-monster="B"'));assert(!node('dropList').innerHTML.includes('data-monster="A"'));});

test('map back returns to monster tab origin after nested location navigation, retaining original scroll and focus',()=>{const {browser,node,views,scrolls,back}=setup();let focused=false;const focus={isConnected:true,focus(){focused=true;}};browser.navigate('map','M1',{view:'monsters',scroll:420,focus});browser.navigate('monster','A');back();assert.equal(node('locationDetail').dataset.kind,'map');assert.equal(views.at(-1),'drops');back();assert.equal(views.at(-1),'monsters');assert.equal(scrolls.at(-1),420);assert(focused);});
