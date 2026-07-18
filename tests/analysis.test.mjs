import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildEvents, buildPlan, classifyRequest, draftResponse, evaluatePolicies, exportRecord, parseRequest } from "../assets/analysis.mjs";

const fixture=JSON.parse(await readFile(new URL("../data/workflow.json",import.meta.url),"utf8"));
const delivery=fixture.requests[0];const invoice=fixture.requests[1];const coverage=fixture.requests[2];
const deliveryFacts=parseRequest(delivery.text);assert.equal(deliveryFacts.vendor,"Brightline Supply Co.");assert.equal(classifyRequest(deliveryFacts).code,"schedule-change");
const deliveryChecks=evaluatePolicies(deliveryFacts,fixture.policies);assert.equal(deliveryChecks.some((check)=>check.outcome==="blocked"),false);assert.equal(deliveryChecks.some((check)=>check.outcome==="review"),true);
const deliveryPlan=buildPlan(deliveryFacts,deliveryChecks);assert.ok(deliveryPlan.length>=4);const response=draftResponse(deliveryFacts,true);assert.match(response,/not sent automatically/i);
const invoiceFacts=parseRequest(invoice.text);const invoiceChecks=evaluatePolicies(invoiceFacts,fixture.policies);assert.ok(invoiceChecks.some((check)=>check.id==="purchase order"&&check.outcome==="blocked"));assert.ok(invoiceChecks.some((check)=>check.id==="cost"&&check.outcome==="review"));
const coverageFacts=parseRequest(coverage.text);const coverageChecks=evaluatePolicies(coverageFacts,fixture.policies);assert.ok(coverageChecks.filter((check)=>check.outcome==="blocked").length>=2);assert.match(buildPlan(coverageFacts,coverageChecks)[1],/Hold external response/);
const classification=classifyRequest(deliveryFacts);const events=buildEvents({requestId:delivery.id,classification,checks:deliveryChecks,internalDecision:"approved",outboundDecision:"approved"});assert.equal(events.length,6);assert.match(events.join(" "),/Internal decision: approved/);
const record=exportRecord({request:delivery,facts:deliveryFacts,classification,checks:deliveryChecks,plan:deliveryPlan,internalDecision:"approved",outboundDecision:"approved",response});assert.match(record,/"synthetic": true/);assert.match(record,/No message was sent/);
console.log("REVIEWFLOW LOGIC TESTS PASSED");
console.log("Checked extraction, classification, policy outcomes, blocked plans, drafting, events, and export boundaries.");
