'use strict';
((root)=>{
 const key='irunadb.tasks.v1',days=['日','月','火','水','木','金','土'];
 const date=(now=new Date())=>new Date(+now+32400000).toISOString().slice(0,10);
 const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 const weekday=day=>new Date(day+'T00:00:00Z').getUTCDay();
 const period=(t,day)=>t.repeat==='once'?'once':t.repeat==='weekly'?shift(day,-((weekday(day)+6)%7)):day;
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&shift(s,0)===s;
 function validate(v){
  const text=(s,n,required=false)=>typeof s==='string'&&s.length<=n&&(!required||s.trim().length>0),num=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999;
  if(!v||v.version!==1||!Array.isArray(v.tasks)||v.tasks.length>500||!Array.isArray(v.history)||v.history.length>50000)throw Error('タスクの保存形式が不正です');
  const ids=new Set(),tokens=new Set();
  for(const t of v.tasks){if(!t||!text(t.id,100,true)||ids.has(t.id)||!text(t.title,200,true)||!text(t.group,100,true)||!text(t.character,100)||!text(t.note,2000)||!text(t.eventTitle,200)||!['daily','weekly','once'].includes(t.repeat)||!Array.isArray(t.days)||!t.days.length||t.days.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(t.days).size!==t.days.length||!text(t.time,5)||t.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)||typeof t.track!=='boolean'||!num(t.quantity)||t.target!==null&&!num(t.target)||t.pace!==undefined&&t.pace!==null&&(!Number.isFinite(t.pace)||t.pace<0||t.pace>999999999))throw Error('タスクの内容が不正です');ids.add(t.id);}
  for(const h of v.history){const token=h?.taskId+'|'+h?.period;if(!h||!text(h.taskId,100,true)||!text(h.title,200,true)||!text(h.character,100)||!text(h.group,100,true)||!validDate(h.day)||!(h.period==='once'||validDate(h.period))||tokens.has(token))throw Error('達成履歴が不正です');tokens.add(token);}
  return v;
 }
 const defaults=()=>({version:1,tasks:[{id:'weekend-dark-crystal',title:'闇の結晶イベント',group:'イベント',character:'',note:'',eventTitle:'イルーナ12神の闇の結晶イベント',repeat:'daily',days:[0,6],time:'',track:false,quantity:0,target:null}],history:[]});
 const done=(s,t,day)=>s.history.some(h=>h.taskId===t.id&&h.period===period(t,day));
 const visible=(t,day)=>t.days.includes(weekday(day));
 function toggle(s,id,day){const next=structuredClone(s),t=next.tasks.find(t=>t.id===id);if(!t)throw Error('タスクが見つかりません');const p=period(t,day),index=next.history.findIndex(h=>h.taskId===id&&h.period===p);if(index>=0)next.history.splice(index,1);else next.history.push({taskId:id,title:t.title,character:t.character,group:t.group,period:p,day});return validate(next);}
 function estimate(t){if(t.target===null)return null;const remaining=Math.max(0,t.target-t.quantity);if(remaining===0)return 0;if(!Number.isFinite(t.pace)||t.pace<=0)return null;const ratio=remaining/t.pace;return Math.ceil(ratio-Number.EPSILON*Math.max(1,ratio));}
 const api={key,days,date,shift,weekday,period,validate,defaults,done,visible,toggle,estimate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IrunaTasksModel=api;
})(typeof window==='undefined'?globalThis:window);

