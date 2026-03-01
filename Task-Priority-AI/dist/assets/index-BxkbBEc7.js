(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const n of t.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function o(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(e){if(e.ep)return;e.ep=!0;const t=o(e);fetch(e.href,t)}})();const c=({children:i})=>`
    <div id="app-shell" style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <header>
        <h1>Task-Priority-AI</h1>
      </header>
      <main id="main-content">
        ${i}
      </main>
    </div>
  `,d=(i,r)=>{const o=document.getElementById(i);o&&(o.innerHTML=c({children:r}))};d("root","<h2>Initializing...</h2>");
