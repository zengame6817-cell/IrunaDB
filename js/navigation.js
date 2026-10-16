"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const trigger=document.getElementById("mobileTabToggle");
  const nav=document.getElementById("mainTabs");
  if(!trigger||!nav)return;
  const label=()=>{
    const active=nav.querySelector(".main-tab.is-active");
    return active?[...active.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim():"メニュー";
  };
  function setOpen(open,restoreFocus=false){
    nav.classList.toggle("is-open",open);
    trigger.setAttribute("aria-expanded",String(open));
    trigger.textContent=open?"× メニューを閉じる":`☰ メニュー · ${label()}`;
    trigger.setAttribute("aria-label",open?"メニューを閉じる":`メニューを開く（現在：${label()}）`);
    if(restoreFocus)trigger.focus();
  }
  // Replace the old mobile-only toggle behavior without changing the build simulator.
  trigger.addEventListener("click",event=>{
    event.stopImmediatePropagation();
    const open=!nav.classList.contains("is-open");setOpen(open);
    if(open)(nav.querySelector(".main-tab.is-active")||nav.querySelector(".main-tab"))?.focus();
  },true);
  nav.addEventListener("click",event=>{if(event.target.closest(".main-tab"))setOpen(false);});
  document.addEventListener("click",event=>{
    if(!nav.contains(event.target)&&!trigger.contains(event.target))setOpen(false);
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&nav.classList.contains("is-open")){setOpen(false,true);event.preventDefault();}
  });
  document.addEventListener("focusin",event=>{
    if(nav.classList.contains("is-open")&&!nav.contains(event.target)&&event.target!==trigger)setOpen(false);
  });
  new MutationObserver(records=>{
    if(records.some(r=>r.target.matches(".main-tab")))setOpen(false);
  }).observe(nav,{subtree:true,attributes:true,attributeFilter:["class"]});
  setOpen(false);
});
