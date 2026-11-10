---
layout: legal
title: "Security"
heading: "Security at Taxy"
description: "How Taxy protects your clients' data — Australian data residency, encryption in transit and at rest, MFA and limited access, and our ISMS."
permalink: /security/
---

_Last updated: 9 November 2026._

Taxy holds some of the most sensitive information your practice has: your clients' identities,
their finances, their tax affairs. Here's how we look after it.

## Your data is stored in Australia
The data in your Taxy account, including backups, is stored in Australia on Google Cloud. Some of
the services we use to run Taxy are located overseas. Our
[Sub-processor list](/legal/subprocessors/) names each one and the information it
handles, and our [Privacy Policy](/privacy-policy/) explains how we manage it.

## Encrypted, always
Your data is encrypted while it travels and while it sits on disk.

## Who can get to your data
Day to day, no one at Taxy can reach the systems your data is stored in. The accounts we use for
email and everyday work have no path to them; getting in takes a separate, tightly controlled account
secured with a physical security key — not a password, so there's nothing to phish. Every sign-in
raises an alert, access is limited to what the job needs, and it's all logged.

Your own Taxy logins support multi-factor authentication, and our staff accounts always use it.


## Built to stay online
Taxy runs on Google Cloud's managed infrastructure in Google's Sydney region — the same platform that
runs Google's own services, engineered for high availability and backed by Google's operations team.
You can check its live status any time on the [Google Cloud status
dashboard](https://status.cloud.google.com/), and read how Google engineers for reliability in the
[Google Cloud reliability guide](https://cloud.google.com/architecture/framework/reliability). On our
side, we keep written plans for staying online through a disruption and for handling an incident.

## How we use AI
We use AI tools from **Anthropic** to develop, operate and support Taxy. Where that work involves
information in your account, Anthropic processes it on our behalf. Model training is turned off, so
your information isn't used to train Anthropic's models. Anthropic is on our [Sub-processor list](/legal/subprocessors/).

We don't yet build AI into the Taxy products themselves. If we do, we'll update this page, our
Privacy Policy and our Sub-processor list before it goes live, so you can see exactly how it works and
what it touches.

## How we work
We run a documented information security management system: written policies, a monthly security
risk review, security training for our team (most recently in April 2026), and checks on our
vendors' security.

Running a vendor security review? We're happy to complete your security questionnaire — just email
[security@taxy.au](mailto:security@taxy.au).

## Report a concern
Found a security problem? Email [**security@taxy.au**](mailto:security@taxy.au).

We welcome good-faith reports from security researchers. Report something responsibly, give us
reasonable time to fix it before you make it public, and we won't take legal action against you over
that research. While you're testing, please don't access, modify or delete customer data, or degrade
the service.
