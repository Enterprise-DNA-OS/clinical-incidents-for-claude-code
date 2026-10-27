# RiskMan example exports

Two small files in the shape of a RiskMan report saved as CSV, for trying the import before you use your own:

- `incident-register.csv`: an incident register report.
- `feedback-register.csv`: a feedback (complaints and compliments) register report.

```bash
node scripts/incidents.mjs import riskman examples/riskman/incident-register.csv --kind=incidents --service=TW-AKL --dry-run --actor="Your name"
node scripts/incidents.mjs import riskman examples/riskman/feedback-register.csv --kind=feedback --service=TW-AKL --dry-run --actor="Your name"
```

RiskMan reports are set up by each site, so your column names may differ. See `docs/replace-riskman.md` for the names the import looks for and how to map your own.
