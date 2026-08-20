# Integrated fact model and flow

## Entrance + utility package

One project can produce an Entrance Permit together with any applicable utility outcome: a Utility Construction Permit, Utility Safety Permit, After-the-Fact Emergency Utility Permit, or one or more Small Wireless Facility Permits. Contact, project, site, construction-impact, and GIS facts are stored once and consumed by all applicable rule sets.

With `/entrancePermitRequested = true`, the graph derives both permit outcomes, entrance traffic requirements, separate document completion states, and `/crossPermitCoordinationRequired` when underground utility work affects the entrance site. `/applicationComplete` becomes true only when every requested permit is complete.

## Diagram

```mermaid
flowchart LR
  SHARED["Shared answers"] --> SC["sharedApplicationFactsComplete"]
  AGENT["isAuthorizedAgent"] --> AR["authorizedAgentRequirementSatisfied"]
  FORM["authorizedAgentFormAttached"] --> AR
  AR --> PD["projectDocumentsComplete"]
  MLUOA["mlUoaAttached"] --> PD
  TYPE["isSmallWirelessApplication"] --> GTYPE["isGeneralUtilityApplication = NOT small wireless"]
  GTYPE -. True .-> EM["Emergency?"]
  EM -- Yes --> EP["Emergency permit"]
  EM -- No --> J["DelDOT jurisdiction?"]
  J -- No --> NONE["No permit"]
  J -- Yes --> D["Disturbance > 0?"]
  D -- Yes --> CP["Construction permit"]
  D -- No --> T["Traffic impact?"]
  T -- Yes --> SP["Safety permit"]
  T -- No --> DUR["Duration > 1 day?"]
  DUR -- Yes --> SP
  DUR -- No --> NONE
  EM --> UC["utilityRequiredAnswersComplete"]
  J --> UC
  D --> UC
  TYPE -. True .-> NF["sites/* answers"]
  NF --> NC["*/requiredAnswersComplete"]
  NF --> NS["*/sizeEligible"]
  NF --> NH["*/heightEligible"]
  NS --> NE["*/permitEligible · one result per node"]
  NH --> NE
  NE --> AE["allWirelessNodesEligible"]
  NF --> ND["*/requiredDocumentsComplete"]
  NC --> ALL["allWirelessNodesComplete"]
  NE --> ALL
  ND --> ALL
  SC --> COMPLETE["applicationComplete"]
  PD --> COMPLETE
  TYPE --> UB["generalUtilityRequirementsSatisfied = small wireless OR general utility complete"]
  UC --> UB
  EP --> UB
  CP --> UB
  SP --> UB
  GTYPE --> WB["smallWirelessRequirementsSatisfied = general utility OR all nodes complete"]
  ALL --> WB
  UB --> COMPLETE
  WB --> COMPLETE
  COMPLETE --> READY["readyToSubmit"]
  ATTEST["attestationsAccepted"] --> READY
  READY -- True --> SUBMIT["Submit / pay"]
  READY -- False --> EXPLAIN["Explain unsatisfied facts"]
```

The editable, detailed version is in [`fact-model.mmd`](fact-model.mmd).

## Record shape

```text
Application package (project)
├── application type
├── project name
├── shared applicant / contact
├── project/entrance site (0..1)
│   └── address + county + latitude/longitude + GIS facts
├── utility application (0..1, no fee)
├── entrance application (0..1, no fee)
└── wireless nodes (0..n)
    ├── reuse project site OR provide a distinct location
    └── node = one permit application + $100 fee
```

The package is the user-facing draft and checkout unit. Each wireless node remains a separate application record for eligibility, documents, review, identifiers, and transmission to EUS.

Documents have an explicit scope. Project documents, such as the Authorized Agent Form, describe a shared relationship and are required once. Node documents describe site-specific work and are required independently for each node. Document totals are therefore `project-wide documents + the sum of each completed node’s documents`, not `one checklist × node count`.

The entrance is project-scoped, not node-scoped. The applicant supplies every wireless node first, then one entrance fact set. A node at the entrance/project site sets `/sites/*/usesProjectSiteLocation = true`; its effective address, county, latitude, longitude, and GIS facts are reused from that site. Only a node at a different location asks for another complete location record.

## POC rule provenance

The fact graph is the executable source for document triggers and their displayed explanations. The inspector's “View graph trace” exposes the exact required-by fact and reason fact for each document. Some business rules in this proof of concept are modeling assumptions inferred from the supplied forms rather than confirmed DelDOT policy; graph derivation makes those assumptions traceable, but does not make them authoritative. They must be validated with DelDOT before production use.

## Derived decisions

| Derived fact | Inputs | Result |
|---|---|---|
| Permit path | application type, emergency, jurisdiction, disturbance, traffic impact, duration | Construction, Safety, Emergency, Small Wireless, or no permit |
| Small wireless qualification | largest antenna volume, other equipment volume | Block when antenna is over 6 cu. ft. or other equipment is over 28 cu. ft. |
| Wireless height eligibility | pole height, highest facility elevation | Block when facility exceeds the greater of pole + 10 ft. or 50 ft. (simplified POC gate) |
| Traffic Control Plan required | TA count and major traffic conditions | Require at 5+ TAs or a qualifying traffic impact |
| Required documents | filing party, ownership, construction, sensitive areas, traffic control | Node- or utility-specific checklist |
| Amount due | application type, wireless node count | Utility: $0; wireless: node count × $100 |
| Required answers complete | every relevant writable fact | True only when all applicable answers are present and valid |
| Application complete | shared facts, application/node facts, derived documents | True when the complete application record can be assembled |
| Ready to submit | application complete, eligibility, documents, attestations | Sole fact used to enable submission |

The browser does not use HTML `required` validation. Every displayed requirement now names a real dictionary path, and aggregate completion and submission readiness come from the graph. The inspector reads the engine's explanation tree rather than reimplementing permit rules in JavaScript. Blank material questions remain unknown until the applicant visits and answers the applicable screen.

For small wireless, the requested permit type and node eligibility are separate. Selecting small wireless establishes the requested permit as a Small Wireless Facility Permit. Missing or disqualifying equipment and height answers affect only that node’s `/permitEligible` fact and the all-node aggregate; they do not change the requested permit type.

The source specification contains a historical-pole height exemption and nearby-pole comparison. Those require GIS/inventory facts not present in the supplied inputs, so the POC exposes the conservative simplified height gate and leaves those integrations for production.

## Applicant flow

```text
Choose application type
  → shared contact
  → project name + number of wireless nodes
  → utility: eligibility → work details → documents
  → wireless: create node collection up front
              → complete overview → construction → documents for each node
  → review entire package
  → utility: submit for $0
  → wireless: one checkout for $100 × nodes
  → transmit application record(s) to EUS
```

Shared applicant facts carry forward. Location, equipment, construction, traffic control, documents, and attestations are node-specific and do not carry between wireless nodes. Navigation is a projection of collection completeness: it can be sequential, tabbed, or resumed at any incomplete node without changing the fact model.

The interface deliberately does not advertise a fixed list of future sections. The graph can add or remove questions when an answer changes without making the navigation misleading. Technical graph state and consequences remain available in the optional floating inspector rather than appearing as applicant-facing progress labels.

## Production boundaries

- GIS should supply jurisdiction, state maintenance, limited-access roads, municipality, speed, railroad proximity, airport airspace, cemetery proximity, and active-project facts.
- Authentication should supply agreement-holder and contact facts.
- Uploaded files need durable document IDs associated with either the package or a specific application/node.
- Payment needs an idempotent package transaction that allocates `$100` to each wireless application before all records are transmitted.
- The app should persist graph values server-side; browser local storage is only used for this demonstration.
