# DelDOT integrated application POC

This prototype combines the DelDOT utility and small wireless intakes around a shared project model.

## Run it

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/poc/`.

## Runtime architecture

`app.js` loads `fact-dictionary.xml` with the repository's compiled FactGraph browser runtime. Applicant answers and simulated GIS results are written as source facts. Eligibility, GIS jurisdiction, wireless document requirements, fees, branch completion, and submission readiness are read back from derived facts. JavaScript retains view metadata and translates form controls to fact paths.

Open **Fact Graph** and use **Simulated GIS source** to change external facts for the current site. A state-maintained road that is not limited access satisfies GIS jurisdiction. Airport-airspace and railroad-proximity results add their corresponding review documents through the graph.

## Model

- A **project** owns shared applicant/contact information.
- A utility project normally has one set of application facts and no fee.
- A small wireless project declares its node count up front and owns a collection of **nodes**. Each node is an independently evaluated permit application and adds `$100` to the package total.
- Eligibility, document requirements, attestations, and fees are derived facts rather than duplicated page logic.
- `fact-dictionary.xml` expresses the executable model using Fact Graph 3.1 primitives. `app.js` loads the real compiled engine, writes source facts, and projects graph results into applicant-facing screens.

The flow uses the supplied specifications as requirements without binding the model to the original sequential diagram: shared contact + declared node collection → complete nodes in any navigational order → entire-application review → one checkout → transmit all applications.
