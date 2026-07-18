import { buildEvents, buildPlan, classifyRequest, draftResponse, evaluatePolicies, exportRecord, parseRequest } from "./analysis.mjs";

const app = document.querySelector("#app");
const state = { data:null, activeId:"", text:"", running:false, analyzed:false, facts:{}, classification:null, checks:[], plan:[], internalDecision:"pending", outboundDecision:"pending", response:"", validation:"", history:[] };

function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function request(){return state.data.requests.find((item)=>item.id===state.activeId)||state.data.requests[0]}
function blocked(){return state.checks.some((check)=>check.outcome==="blocked")}

function reset(item){state.activeId=item.id;state.text=item.text;state.running=false;state.analyzed=false;state.facts={};state.classification=null;state.checks=[];state.plan=[];state.internalDecision="pending";state.outboundDecision="pending";state.response="";state.validation="";state.history=[`${item.id} opened from synthetic queue.`]}

function stageState(index){
  if(index===0)return"complete";
  if(state.running)return index===1?"active":"";
  if(!state.analyzed)return"";
  if(index<=2)return"complete";
  if(index===3)return blocked()?"blocked":"complete";
  if(index===4)return blocked()?"blocked":state.internalDecision==="pending"?"active":"complete";
  if(blocked()||state.internalDecision==="returned")return"blocked";
  if(state.outboundDecision==="approved")return"complete";
  if(state.internalDecision==="approved")return"active";
  return"";
}

function renderQueue(active){return `<aside class="queue" aria-label="Synthetic exception queue"><p class="eyebrow">Exception inbox</p><h2>${state.data.requests.length} requests</h2><p class="queue-note">Choose a fictional case to start a separate workflow.</p><div class="request-list">${state.data.requests.map((item)=>`<button class="request-button" type="button" data-request="${item.id}" aria-pressed="${item.id===active.id}"><strong>${esc(item.title)}</strong><span>${item.id} / ${esc(item.priority)}</span><span>${esc(item.received)}</span></button>`).join("")}</div><p class="privacy-note">Synthetic vendors and policies only. No email, purchase order, invoice, or external action leaves this browser.</p></aside>`}

function renderStages(){const names=["Intake","Extract","Classify","Policy checks","Internal gate","Response gate"];return `<section class="stage-strip" tabindex="0" aria-label="Workflow stages">${names.map((name,index)=>`<div class="stage ${stageState(index)}"><div class="stage-top"><span class="stage-index">0${index+1}</span><span class="stage-status" aria-hidden="true"></span></div><strong>${name}</strong></div>`).join("")}</section>`}

function facts(){const items=Object.entries(state.facts);if(!items.length)return"";return `<div class="fact-list">${items.slice(0,8).map(([key,value])=>`<div class="fact"><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`}

function execution(){
  if(state.running)return `<div class="empty"><div><strong>Running staged review...</strong><p>Extracting facts, classifying the exception, and checking fictional policies.</p><div class="loader"><span></span></div></div></div>`;
  if(!state.analyzed)return `<div class="empty"><div><strong>Run the workflow plan</strong><p>Each stage will expose its rule result before a human decision becomes available.</p></div></div>`;
  return `<div class="classification"><p class="eyebrow">Classification</p><h3>${esc(state.classification.label)}</h3><p>${blocked()?"Execution is blocked until required information is supplied.":"Policy checks completed. The internal decision remains with a human reviewer."}</p></div><div class="checks">${state.checks.map((check)=>`<article class="check"><div class="check-heading"><h3>${esc(check.rule)}</h3><span class="badge ${check.outcome}">${check.outcome}</span></div><p>${esc(check.evidence)}</p></article>`).join("")}</div><ol class="plan">${state.plan.map((step)=>`<li>${esc(step)}</li>`).join("")}</ol>`
}

function internalGate(){
  if(!state.analyzed)return"";
  const isBlocked=blocked();
  const label=isBlocked?"Blocked by required information":state.internalDecision==="approved"?"Internal exception approved":state.internalDecision==="returned"?"Returned for clarification":"Internal decision pending";
  return `<section class="gate" aria-label="Internal exception approval"><div class="gate-inner"><p class="eyebrow">Human gate one</p><h3>Internal policy exception</h3><p>Only a procurement owner can approve the proposed plan. A blocked request cannot bypass missing information.</p><div class="summary-line"><span class="dot ${isBlocked?"blocked":state.internalDecision}"></span>${label}</div><div class="gate-actions"><button id="approve-internal" type="button" ${isBlocked||state.internalDecision==="approved"?"disabled":""}>Approve exception</button><button id="return-internal" type="button" class="return" ${isBlocked||state.internalDecision==="returned"?"disabled":""}>Return for clarification</button></div></div></section>`
}

function outboundGate(){
  if(state.internalDecision!=="approved")return"";
  return `<section class="gate" aria-label="Outbound response approval"><div class="gate-inner"><p class="eyebrow">Human gate two</p><h3>Outbound vendor response</h3><p>Edit the draft if needed. Approval marks it ready for a human sender; the demo never transmits it.</p><label for="response-draft">Response draft</label><textarea id="response-draft" class="response-editor">${esc(state.response)}</textarea><div class="summary-line"><span class="dot ${state.outboundDecision}"></span>${state.outboundDecision==="approved"?"Response approved for human sending":"Outbound decision pending"}</div><div class="gate-actions"><button id="approve-outbound" type="button" ${state.response.trim().length<30||state.outboundDecision==="approved"?"disabled":""}>Approve response</button><button id="reopen-outbound" type="button" class="secondary" ${state.outboundDecision!=="approved"?"disabled":""}>Reopen draft</button></div></div></section>`
}

function eventLog(item){if(!state.analyzed)return"";const events=buildEvents({requestId:item.id,classification:state.classification,checks:state.checks,internalDecision:state.internalDecision,outboundDecision:state.outboundDecision});return `<section class="event-log" aria-label="Workflow event log"><div class="panel-heading"><h3>Event and decision log</h3><p>Deterministic stages and human actions are kept separate.</p></div><ol class="event-list">${[...events,...state.history.slice(1)].map((event)=>`<li>${esc(event)}</li>`).join("")}</ol></section>`}

function render(){const item=request();app.setAttribute("aria-busy",String(state.running));app.innerHTML=`<div class="workflow-shell">${renderQueue(item)}<section class="case-workspace"><div class="case-heading"><div><p class="eyebrow">${item.id} / ${esc(item.priority)}</p><h2>${esc(item.title)}</h2><p>Received ${esc(item.received)}</p></div><div class="case-actions"><button id="export-record" class="secondary" type="button" ${state.analyzed?"":"disabled"}>Download record</button></div></div>${renderStages()}<div class="main-grid"><section class="intake"><div class="panel-heading"><h3>Request intake</h3><p>Edit the fictional request before running the workflow.</p></div><div class="intake-body"><label for="request-text">Vendor request</label><textarea id="request-text" class="request-text">${esc(state.text)}</textarea><p class="validation" id="request-error">${esc(state.validation)}</p><button id="run-workflow" class="run-button" type="button" ${state.running?"disabled":""}>Run agent plan</button>${facts()}</div></section><section class="execution"><div class="panel-heading"><h3>Execution trace</h3><p>Every tool-like check is visible and deterministic.</p></div><div class="execution-body">${execution()}</div></section></div>${internalGate()}${outboundGate()}${eventLog(item)}</section></div>`;bind(item)}

function run(item){const input=document.querySelector("#request-text");state.text=input.value.trim();if(state.text.length<20){state.validation="Enter at least 20 characters so the request contains reviewable context.";render();document.querySelector("#request-text").focus();return}state.validation="";state.running=true;render();window.setTimeout(()=>{state.facts=parseRequest(state.text);state.classification=classifyRequest(state.facts);state.checks=evaluatePolicies(state.facts,state.data.policies);state.plan=buildPlan(state.facts,state.checks);state.analyzed=true;state.running=false;state.internalDecision=blocked()?"blocked":"pending";state.outboundDecision="pending";state.response="";state.history.push("Agent plan completed in deterministic local mode.");render()},460)}

function download(item){const record=exportRecord({request:item,facts:state.facts,classification:state.classification,checks:state.checks,plan:state.plan,internalDecision:state.internalDecision,outboundDecision:state.outboundDecision,response:state.response});const url=URL.createObjectURL(new Blob([record],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download=`${item.id.toLowerCase()}-reviewflow-record.json`;link.click();URL.revokeObjectURL(url);state.history.push("Local workflow record downloaded.");render()}

function bind(item){document.querySelectorAll("[data-request]").forEach((button)=>button.addEventListener("click",()=>{reset(state.data.requests.find((entry)=>entry.id===button.dataset.request));render()}));document.querySelector("#request-text").addEventListener("input",(event)=>{state.text=event.target.value});document.querySelector("#run-workflow").addEventListener("click",()=>run(item));document.querySelector("#export-record").addEventListener("click",()=>download(item));const approve=document.querySelector("#approve-internal");if(approve)approve.addEventListener("click",()=>{state.internalDecision="approved";state.response=draftResponse(state.facts,true);state.history.push("Internal exception approved by human reviewer.");render()});const returned=document.querySelector("#return-internal");if(returned)returned.addEventListener("click",()=>{state.internalDecision="returned";state.history.push("Internal exception returned by human reviewer.");render()});const response=document.querySelector("#response-draft");if(response)response.addEventListener("input",(event)=>{state.response=event.target.value;state.outboundDecision="pending"});const outbound=document.querySelector("#approve-outbound");if(outbound)outbound.addEventListener("click",()=>{state.response=document.querySelector("#response-draft").value;state.outboundDecision="approved";state.history.push("Outbound response approved by human reviewer; no message sent.");render()});const reopen=document.querySelector("#reopen-outbound");if(reopen)reopen.addEventListener("click",()=>{state.outboundDecision="pending";state.history.push("Outbound response reopened for editing.");render()})}

async function load(){try{const response=await fetch("data/workflow.json",{cache:"no-store"});if(!response.ok)throw new Error(`Request returned ${response.status}.`);const data=await response.json();if(!Array.isArray(data.requests)||data.requests.length<3)throw new Error("Synthetic queue is incomplete.");state.data=data;reset(data.requests[0]);app.removeAttribute("aria-busy");render()}catch(error){app.removeAttribute("aria-busy");app.innerHTML=`<section class="startup error" role="alert"><p class="eyebrow">Workflow data unavailable</p><h2>The synthetic exception queue could not be loaded.</h2><p>${esc(error instanceof Error?error.message:"Unknown loading error.")}</p><button id="retry-load" type="button">Retry</button></section>`;document.querySelector("#retry-load").addEventListener("click",load)}}

load();
