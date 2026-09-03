---
layout: legal
title: "Data attributions"
heading: "Data Attributions"
description: "Third-party data used in Taxy products and the licence attribution each source requires — the TPB Public Register and the ABN Lookup web services."
permalink: /legal/attributions/
---

_Last updated: 3 September 2026._

Taxy products use publicly published data from the sources below. This page records the
attribution each licence requires.

## Tax Practitioners Board — TPB Public Register

Tax Practitioners Board, Commonwealth of Australia, *TPB Public Register*, sourced
2026-08-31, [https://data.gov.au/data/dataset/tpb-register](https://data.gov.au/data/dataset/tpb-register).

Used under the [Creative Commons Attribution 4.0 International licence (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

**We hold a modified subset, not the register.** Taxy stores a point-in-time copy of part
of the published file: for each registered agent number, the registration status, the
agent type and the registered name. Agent numbers are zero-padded to eight digits, and
status and type values are stored as lookup tables rather than repeated on every row. The
status values themselves are reproduced **verbatim** as the Tax Practitioners Board
publishes them.

**What our copy does not contain:** conditions of registration, sanction detail and
suspension history. Those appear on the Tax Practitioners Board's own register and are
absent from the published file, so nothing in Taxy should be read as reporting them.

Our copy is a snapshot, refreshed periodically. **The Tax Practitioners Board's own
register is the authoritative source** and should be consulted where currency matters:
[tpb.gov.au/public-register](https://www.tpb.gov.au/public-register).

## Australian Business Register — ABN Lookup web services

Australian Business Register, Commonwealth of Australia, *ABN Lookup web services*,
[https://data.gov.au/data/dataset/abn-lookup-web-services](https://data.gov.au/data/dataset/abn-lookup-web-services).

Used under the [Creative Commons Attribution 3.0 Australia licence (CC BY 3.0 AU)](https://creativecommons.org/licenses/by/3.0/au/).

**We look up, we do not mirror.** Taxy queries the ABN Lookup web services live when a
firm enters or confirms an ABN. We hold no copy of the register: what is retained is the
firm's own ABN and registered name, as part of that firm's record. Results are returned as
the Australian Business Register publishes them, and the register itself remains the
authoritative source: [abr.business.gov.au](https://abr.business.gov.au).

## Neither agency endorses Taxy

Attribution under these licences is a condition of use. It does not imply that the Tax
Practitioners Board, the Australian Business Register, the Australian Taxation Office or
the Commonwealth of Australia endorses Taxy, its products or its use of their data.
