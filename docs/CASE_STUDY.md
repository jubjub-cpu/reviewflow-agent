# Case Study: ReviewFlow Agent

## Outcome

ReviewFlow converts a fictional vendor exception into an inspectable execution trace. It demonstrates structured extraction, staged orchestration, rules-plus-AI decisions, blocked outcomes, two human gates, and an event export without sending a message or requiring a paid service.

## Problem and User

Procurement operations managers receive schedule, invoice, and coverage exceptions in free text. The current work involves manual fact gathering, policy checks, approval routing, response drafting, and decision logging.

## Product Hypothesis

An agent-style interface is useful when each stage and rule result is visible, missing information stops the workflow, and humans retain both internal and external decision authority.

## Implemented Workflow

Three synthetic requests cover a complete schedule change, an invoice mismatch with a missing purchase order, and a coverage request missing sites and owner. The workflow extracts facts, classifies intent, runs policy checks, builds a plan, gates the internal exception, drafts a response, gates the outbound message, and exports a local record.

## Responsible AI Design

The interface never hides a rule result behind generated prose. Blocked requests cannot be approved. Drafts are not sent. Human decisions are recorded separately from deterministic stages, and the product makes no legal or purchasing claim.

## Portfolio Signal

ReviewFlow adds visible agent orchestration, rules-plus-AI systems, event modeling, missing-information handling, two-stage human approval, and local structured export. This differs from SignalOps incident triage and DocuTrace evidence retrieval.
