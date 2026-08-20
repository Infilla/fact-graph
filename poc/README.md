# DelDOT integrated application POC

This prototype combines the DelDOT entrance, utility, and small wireless intakes around a shared project model.

## Run it

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/poc/`.

## Runtime architecture

`app.js` loads `fact-dictionary.xml` with the repository's compiled FactGraph browser runtime. Applicant answers and simulated GIS results are written as source facts. The graph first derives the complete permit package and permit count, then exposes a form manifest identifying the shared, site, permit, node, entrance, and document question groups required to finish it. Eligibility, GIS jurisdiction, document requirements, fees, completion, and submission readiness are also read back from derived facts.

Open **Fact Graph** and use **Simulated GIS source** to change external facts for the current site. A state-maintained road that is not limited access satisfies GIS jurisdiction. Airport-airspace and railroad-proximity results add their corresponding review documents through the graph.

## Model

- A **project** owns shared applicant/contact information.
- Other utility work can produce one Construction, Safety, or After-the-Fact Emergency permit and has no application fee.
- Entrance work produces one Entrance Permit and has no application fee.
- A small wireless project declares its node count up front and owns a collection of **nodes**. Each node is an independently evaluated permit application and adds `$100` to the package total.
- Eligibility, document requirements, attestations, and fees are derived facts rather than duplicated page logic.
- `fact-dictionary.xml` expresses the executable model using Fact Graph 3.1 primitives. `app.js` loads the real compiled engine, writes source facts, and projects graph results into applicant-facing screens.

The flow has two phases: activity and determining answers → graph-derived permit package → graph-selected application questions and documents → entire-package review → one checkout → transmit all application records.
