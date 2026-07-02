---
layout: legal
title: "Security"
heading: "Security at Taxy"
description: "How Taxy protects your clients' data — Australian data residency, encryption in transit and at rest, MFA and zero-trust access, and our ISMS."
permalink: /security/
---

_Last updated: 2 July 2026._

Taxy holds some of the most sensitive information an accounting practice has — your clients'
identities, financials and tax details. We treat all of it as restricted and critical. Here's how we
protect it.

## Your data stays in Australia
All application data is **stored in Australia** on Google Cloud Platform. For disaster-recovery
resilience we keep **encrypted backups in the United States**. (This matches the international-transfers
disclosure in our [Privacy Policy](/privacy-policy/).)

## Encrypted, always
Your data is **encrypted in transit and at rest**. (Specific standards are available in our security
questionnaire on request.)

## Multi-factor authentication & zero-trust access
**Multi-factor authentication** is available on every account, and all Taxy staff access requires
it. We run a **zero-trust** model: staff devices
can't store or directly reach customer data, and access to production is least-privilege and
**logged**. Support staff see sensitive fields (names, tax file numbers, attachments) only on
explicit, logged request.

## Built to stay online
Taxy runs **active-active across multiple failure zones in Australia** with no shared single point of
failure, so a data-centre outage doesn't take the service down. We test full disaster recovery yearly
and can rebuild from scratch within a business day.

## How we use AI
We use AI tools to build and operate the platform. Where customer content is involved in that work, it
is handled by our AI sub-processor (**Anthropic**) on a **business tier under which content is not
stored and is not used to train AI models**. Anthropic is named on our
[Sub-processor list](/legal/subprocessors/).

**Where Taxy offers in-product AI features**, those features use large language models provided by
**Google Cloud Platform**, run in our Australian Google Cloud environment, and your data is not used
to train models.

## Our practices
We maintain an Information Security Management System: documented policies, annual staff security
training, regular risk reviews, vendor assessments (ISO 27001 / SOC 2), and incident-response and
business-continuity plans. **A security questionnaire / summary is available on
request** — [security@taxy.au](mailto:security@taxy.au).

## Report a concern
Found a security issue? Email [**security@taxy.au**](mailto:security@taxy.au). We welcome good-faith reports from security
researchers: if you report a vulnerability responsibly and give us reasonable time to fix it before
disclosing, **we won't pursue legal action against you** for that research. Please don't access,
modify or delete customer data, or degrade the service, while testing.
