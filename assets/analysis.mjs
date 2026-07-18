const FIELD_LABELS = [
  "vendor", "type", "sites", "notice", "cost impact", "original window", "requested window",
  "prior seats", "requested seats", "purchase order", "coverage owner", "approval owner", "reason"
];

export function parseRequest(text) {
  const facts = {};
  String(text || "").split(";").forEach((part) => {
    const index = part.indexOf(":");
    if (index < 0) return;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (FIELD_LABELS.includes(key)) facts[key] = value;
  });
  return facts;
}

export function classifyRequest(facts) {
  const type = (facts.type || "").toLowerCase();
  if (type.includes("delivery")) return { code: "schedule-change", label: "Delivery schedule exception" };
  if (type.includes("invoice") || type.includes("renewal")) return { code: "commercial-exception", label: "Commercial invoice exception" };
  if (type.includes("coverage") || type.includes("service")) return { code: "service-exception", label: "Service coverage exception" };
  return { code: "unclassified", label: "Unclassified request" };
}

function numberFrom(value) {
  const match = String(value || "").replaceAll(",", "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function missing(value) {
  return !value || /^missing$/i.test(value.trim());
}

export function evaluatePolicies(facts, policies) {
  const classification = classifyRequest(facts);
  const checks = [];

  checks.push({
    id: "vendor",
    rule: "Named vendor",
    outcome: missing(facts.vendor) ? "blocked" : "pass",
    evidence: missing(facts.vendor) ? "Vendor is missing." : `Vendor extracted: ${facts.vendor}.`
  });

  if (classification.code === "schedule-change") {
    const notice = numberFrom(facts.notice);
    const sites = numberFrom(facts.sites);
    checks.push({ id: "notice", rule: `${policies.deliveryNoticeHours}-hour schedule notice`, outcome: notice >= policies.deliveryNoticeHours ? "pass" : "blocked", evidence: `${notice} hours supplied.` });
    checks.push({ id: "sites", rule: "Multi-site manager approval", outcome: sites >= policies.multiSiteApprovalCount ? "review" : "pass", evidence: `${sites} sites affected; manager approval is required at ${policies.multiSiteApprovalCount} or more.` });
    checks.push({ id: "window", rule: "Original and requested windows", outcome: missing(facts["original window"]) || missing(facts["requested window"]) ? "blocked" : "pass", evidence: missing(facts["original window"]) || missing(facts["requested window"]) ? "One or both windows are missing." : "Both scheduling windows were extracted." });
  }

  if (classification.code === "commercial-exception") {
    const cost = numberFrom(facts["cost impact"]);
    checks.push({ id: "cost", rule: "Finance approval threshold", outcome: cost > policies.financeApprovalAmount ? "review" : "pass", evidence: `$${cost.toLocaleString()} impact; finance review begins above $${policies.financeApprovalAmount.toLocaleString()}.` });
    for (const field of policies.requiredInvoiceFields) {
      checks.push({ id: field, rule: `Required invoice field: ${field}`, outcome: missing(facts[field]) ? "blocked" : "pass", evidence: missing(facts[field]) ? `${field} is missing.` : `${field}: ${facts[field]}.` });
    }
  }

  if (classification.code === "service-exception") {
    for (const field of policies.requiredCoverageFields) {
      checks.push({ id: field, rule: `Required coverage field: ${field}`, outcome: missing(facts[field]) ? "blocked" : "pass", evidence: missing(facts[field]) ? `${field} is missing.` : `${field}: ${facts[field]}.` });
    }
    checks.push({ id: "cost", rule: "Finance approval threshold", outcome: numberFrom(facts["cost impact"]) > policies.financeApprovalAmount ? "review" : "pass", evidence: `${facts["cost impact"] || "$0"} cost impact supplied.` });
  }

  if (classification.code === "unclassified") checks.push({ id: "type", rule: "Recognized exception type", outcome: "blocked", evidence: "The request type is not recognized." });
  checks.push({ id: "owner", rule: "Named approval owner", outcome: missing(facts["approval owner"]) ? "blocked" : "pass", evidence: missing(facts["approval owner"]) ? "Approval owner is missing." : `Owner: ${facts["approval owner"]}.` });
  return checks;
}

export function buildPlan(facts, checks) {
  const blocked = checks.filter((check) => check.outcome === "blocked");
  const reviews = checks.filter((check) => check.outcome === "review");
  if (blocked.length) return [`Request ${blocked.map((check) => check.rule.toLowerCase()).join(", ")}.`, "Hold external response until missing information is supplied.", "Record the blocked result in the event log."];
  return [
    `Route the ${classifyRequest(facts).label.toLowerCase()} to ${facts["approval owner"]}.`,
    reviews.length ? `Require explicit review for ${reviews.map((check) => check.rule.toLowerCase()).join(" and ")}.` : "No additional policy review is required.",
    "Draft a vendor response only after the internal exception decision.",
    "Require a second human approval before the response is marked ready."
  ];
}

export function draftResponse(facts, approved) {
  if (!approved) return "";
  const classification = classifyRequest(facts).label.toLowerCase();
  return `Subject: ${classification} review\n\nThank you for the request from ${facts.vendor}. The internal exception review is approved for the supplied details. Please confirm that the stated timing, sites, and cost impact remain accurate before the change is scheduled. This draft is not sent automatically and requires a separate outbound-message approval.`;
}

export function buildEvents({ requestId, classification, checks, internalDecision, outboundDecision }) {
  const blocked = checks.filter((check) => check.outcome === "blocked").length;
  return [
    `${requestId} received from synthetic queue.`,
    `Facts extracted and classified as ${classification.label}.`,
    `${checks.length} policy checks completed; ${blocked} blocked.`,
    blocked ? "Execution stopped before the internal approval gate." : "Action plan held for internal approval.",
    `Internal decision: ${internalDecision}.`,
    `Outbound response: ${outboundDecision}.`
  ];
}

export function exportRecord({ request, facts, classification, checks, plan, internalDecision, outboundDecision, response }) {
  return JSON.stringify({
    product: "ReviewFlow Agent",
    synthetic: true,
    request: { id: request.id, title: request.title },
    classification,
    facts,
    policyChecks: checks,
    actionPlan: plan,
    humanDecisions: { internalException: internalDecision, outboundResponse: outboundDecision },
    responseDraft: response,
    limitation: "No message was sent. This deterministic demo is not legal or purchasing advice."
  }, null, 2);
}
