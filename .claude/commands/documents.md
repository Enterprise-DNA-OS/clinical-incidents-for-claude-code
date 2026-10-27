---
description: "Render the paperwork in documents.json as branded HTML in docs-out/: incident reports, complaint acknowledgements, open disclosure meeting records, risk registers and governance summaries."
---

# documents

Run `npm run docs` for every document, `npm run docs -- <name>` for one type (incident-report, complaint-acknowledgement, candour-meeting-record, risk-register, governance-summary), or `npm run docs -- <name> <id-prefix>` for one record. The business name, logo and colours come from `brand.json`. Print to PDF from the browser. Nothing is sent from here.
