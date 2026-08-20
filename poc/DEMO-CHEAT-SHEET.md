# DelDOT FactGraph POC demonstration cheat sheet

Use these scenarios to demonstrate how applicant answers, per-site facts, and simulated GIS facts produce different application consequences.

## Before each scenario

1. Select **Reset application** unless the scenario explicitly continues from the previous one.
2. Select the project activities and answer the **Permit determination** questions first.
3. Review the derived permit package, then enter any valid project and contact information requested for it.
4. Open **Fact Graph** to inspect source and derived facts.
5. For location-dependent scenarios, set the values under **Demo GIS settings** for the current site.

Refreshing the browser does not clear a draft. The application restores answers from local storage, so use **Reset application** when you need a clean scenario.

## 1. Show an undetermined permit

Choose **Build or maintain a utility**, then **Water, sewer, gas, power, telephone, cable, or fiber**. Stop on **Permit determination** before answering its questions.

Expected behavior:

- Permit remains **Not determined**.
- `/utilityPermitType` is incomplete.
- `/utilityPermitEligible` is incomplete.
- `/readyToSubmit` is false.

Talking point: the graph does not assume that unanswered Boolean questions mean “No.”

## 2. Utility Construction Permit

Use these permit-determination answers first:

| Question | Answer |
|---|---|
| Where will work occur? | State-maintained right-of-way |
| Emergency work? | No |
| Ground disturbance | 480 sq. ft. |
| Traffic impact | None |
| Total duration | Up to 1 day |

The next screen should identify **Utility Construction Permit**. In the application-detail phase, answer **Public utility? = Yes** and **Utility type = Power / electrical**.

Set the simulated GIS facts:

| GIS fact | Value |
|---|---|
| On a state-maintained road | Yes |
| Limited-access highway | No |
| Inside airport airspace | No |
| Near a railroad | No |

Expected behavior:

- Permit: **Utility Construction Permit**.
- GIS jurisdiction is eligible.
- Fee remains **$0.00**.
- A drawing/construction plan is required.

Key facts: `/utilityPermitType`, `/allSitesGisJurisdictionEligible`, `/utilityPermitEligible`, and `/utilityDrawingRequired`.

## 3. Utility Safety Permit from traffic impact

Use the same answers as Scenario 2, except:

| Question | Answer |
|---|---|
| Ground disturbance | 0 sq. ft. |
| Traffic impact | Lane / shoulder occupation |

Expected behavior:

- Permit changes to **Utility Safety Permit**.
- `/utilityHasTrafficImpact` becomes true.
- `/utilityPermitEligible` remains true.
- A Traffic Control Plan is not automatically required unless a separate TCP trigger applies.

Talking point: permit classification and document requirements are separate graph consequences.

## 4. Utility Safety Permit from duration

Use these distinguishing answers:

| Question | Answer |
|---|---|
| Emergency work? | No |
| Ground disturbance | 0 sq. ft. |
| Traffic impact | None |
| Total duration | Longer than 1 working day |

Use the same eligible GIS answers as Scenario 2.

Expected behavior:

- Permit: **Utility Safety Permit**.
- `/utilityLongerThanOneDay` is true.
- `/utilityHasTrafficImpact` is false.

Talking point: different source facts can independently lead to the same permit outcome.

## 5. No DelDOT permit needed

Use these distinguishing answers:

| Question | Answer |
|---|---|
| Emergency work? | No |
| Where will work occur? | None of these |

Expected behavior:

- Permit: **No DelDOT permit needed**.
- The application does not continue toward DelDOT submission.
- `/utilityPermitEligible` is false.

Talking point: the graph can determine that this application is not the appropriate transaction instead of forcing every applicant through the same form.

## 6. After-the-Fact Emergency Utility Permit

Use this distinguishing answer:

| Question | Answer |
|---|---|
| Emergency work? | Yes |

Leave the GIS controls at **Not returned** initially.

Expected behavior:

- Permit: **After-the-Fact Emergency Utility Permit**.
- `/utilityPermitEligible` is true without waiting for GIS jurisdiction.
- Other required application details and documents are still required before submission.

Talking point: emergency eligibility bypasses the ordinary GIS jurisdiction gate, but it does not make the application complete.

## 7. Limited-access highway special review

Start with the Utility Construction Permit answers from Scenario 2. Set GIS to:

| GIS fact | Value |
|---|---|
| On a state-maintained road | Yes |
| Limited-access highway | Yes |

Expected behavior:

- Permit remains **Utility Construction Permit**.
- The site remains jurisdictionally eligible.
- `/sites/#…/gisSpecialReviewRequired` becomes true.
- The visualizer shows **Special review required**.

Talking point: limited-access status is a review-routing consequence, not an automatic permit denial.

## 8. Traffic Control Plan from shared site questions

This works in either the **General utility** construction screen or a **Small wireless** node construction screen.

Set all of these to false or zero first:

- Number of DE MUTCD Typical Applications: `2`
- Detour: unchecked
- Complex field conditions: unchecked
- Pedestrian-access impact: unchecked
- Travel-lane occupation: unchecked

Observe that the Traffic Control Plan is not required. Then change any one of the following:

- Number of Typical Applications to `5` or more; or
- Check **Work requires a detour of roadway traffic**; or
- Check **Field conditions are complicated…**; or
- Check **Work substantially impacts an established pedestrian access route**; or
- Check **Work is performed over a travel lane, turn lane, or bike lane**.

Expected behavior:

- `/sites/#…/requiresTrafficControlPlan` becomes true.
- For a utility application, `/utilityRequiresTrafficControlPlan` also becomes true.
- **Traffic Control Plan** appears in the document checklist.

Talking point: the same per-site fact model and TCP rule are reused by both permit types.

## 9. Conditional underground owner question

This also works in either application type.

1. On the construction screen, check **Underground service feeds or conduit runs**.
2. Leave the newly displayed Delmarva 811 member ID blank.
3. Try to continue.

Expected behavior:

- `/sites/#…/hasUndergroundWork` is true.
- `/sites/#…/undergroundOwnerRequirementSatisfied` is false.
- The application asks for the underground facility owner’s member ID.

Enter `MEMBER-123`.

Expected behavior:

- `/sites/#…/undergroundOwnerMemberId` is populated.
- `/sites/#…/undergroundOwnerRequirementSatisfied` becomes true.

Talking point: whether a question is required is itself derived from another fact.

## 10. Multiple wireless nodes with different outcomes

Choose **Small wireless utility work** and declare `2` nodes.

For both nodes, use:

| Question | Node 1 | Node 2 |
|---|---:|---:|
| Largest antenna volume | 4 cu. ft. | 4 cu. ft. |
| Other equipment total | 20 cu. ft. | 30 cu. ft. |
| Pole height | 40 ft. | 40 ft. |
| Highest facility elevation | 48 ft. | 48 ft. |

For each node, set GIS to a state-maintained, non-limited-access road.

Expected behavior:

- Node 1 is eligible.
- Node 2 does not qualify because `30 > 28` cu. ft.
- `/allWirelessNodesEligible` is false.
- Fee is still **2 × $100 = $200.00** because fee follows collection size.
- Each node retains its own eligibility and document consequences.

Then change Node 2’s other equipment volume to `20`.

Expected behavior:

- Node 2 becomes eligible.
- `/allWirelessNodesEligible` becomes true once both nodes are determined and eligible.

Talking point: the project is a collection of independently evaluated node graphs, not one repeated loop state.

## Optional GIS document demonstration

On either application type, set:

| Applicant or GIS fact | Value |
|---|---|
| GIS says inside airport airspace | Yes |
| Applicant says railroad crossing | No |
| GIS says near a railroad | Yes |

Expected behavior:

- **Airport Zone Notification Form** is required.
- **Railroad proximity review information** is required.
- **Railroad company approval** is not required unless the applicant says the work crosses over or under the railroad.

Talking point: applicant and GIS facts are peer inputs to the graph, but they can produce different downstream requirements.
