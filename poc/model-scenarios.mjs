import fs from 'node:fs';
import crypto from 'node:crypto';
import * as FactGraph from '../demo/fg.js';
import { explanationGroups, formatGraphExplanation } from './explanation.js';
import { decimalValue } from './presentation.js';

const xml = fs.readFileSync(new URL('./fact-dictionary.xml', import.meta.url), 'utf8');
const dictionary = FactGraph.FactDictionaryFactory.importFromXml(xml);
const appSource = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');

const normalize = value => value && typeof value === 'object' && value.toString__T
  ? value.toString__T()
  : value;

function read(graph, path) {
  try {
    const result = graph.get(path);
    const status = result.productPrefix__T();
    return {
      status: status.toLowerCase(),
      value: status === 'Incomplete' ? null : normalize(result.productElement__I__O(0)),
    };
  } catch (error) {
    return { status: 'error', value: null, error: error.message };
  }
}

function makeGraph(siteCount = 0) {
  const graph = FactGraph.GraphFactory.apply(dictionary);
  graph.set__T__O__V('/includesGeneralUtilityWork', false); graph.set__T__O__V('/includesSmallWirelessFacilities', false); graph.set__T__O__V('/includesEntranceWork', false);
  const ids = Array.from({ length: siteCount }, () => crypto.randomUUID());
  if (siteCount) {
    graph.set__T__O__V('/sites', FactGraph.CollectionFactory(ids));
    graph.save();
  }
  return { graph, ids };
}

function set(graph, path, value) {
  if (/\/(largestAntennaVolume|otherEquipmentVolume|poleHeight|facilityHeight)$/.test(path) && typeof value === 'number') {
    const decimals=(String(value).split('.')[1]||'').length;
    const denominator=10**decimals;
    value=FactGraph.RationalFactory(Math.round(value*denominator),denominator);
  }
  graph.set__T__O__V(path, value);
}

function sitePath(id, name) {
  return `/sites/#${id}/${name}`;
}

const shared = {
  '/projectName': 'Scenario project',
  '/contactCompany': 'Example Utility LLC',
  '/contactFirstName': 'Alex',
  '/contactLastName': 'Applicant',
  '/contactEmail': 'alex@example.com',
  '/contactPhone': '3025550100',
  '/contactFilerType': 'owner',
  '/isAuthorizedAgent': false,
  '/attestationsAccepted': false,
};

const eligibleWirelessSite = id => ({
  [sitePath(id, 'isWirelessNode')]: true,
  [sitePath(id, 'isProjectSite')]: false,
  [sitePath(id, 'siteId')]: 'SITE-1',
  [sitePath(id, 'address')]: '100 Main Street',
  [sitePath(id, 'latitude')]: '39.1582',
  [sitePath(id, 'longitude')]: '-75.5244',
  [sitePath(id, 'county')]: 'Kent',
  [sitePath(id, 'scope')]: 'new',
  [sitePath(id, 'structureWork')]: 'attach',
  [sitePath(id, 'poleOwner')]: 'deldot',
  [sitePath(id, 'largestAntennaVolume')]: 4,
  [sitePath(id, 'otherEquipmentVolume')]: 20,
  [sitePath(id, 'poleHeight')]: 40,
  [sitePath(id, 'facilityHeight')]: 48,
  [sitePath(id, 'hasFoundation')]: false,
  [sitePath(id, 'hasUndergroundWork')]: false,
  [sitePath(id, 'hasPavementDisturbance')]: false,
  [sitePath(id, 'hasElectricalComponents')]: false,
  [sitePath(id, 'hasCasing')]: false,
  [sitePath(id, 'crossesRailroad')]: false,
  [sitePath(id, 'hasMajorTrafficImpact')]: false,
  [sitePath(id, 'requiresDetour')]: false,
  [sitePath(id, 'hasComplexFieldConditions')]: false,
  [sitePath(id, 'impactsPedestrianAccess')]: false,
  [sitePath(id, 'occupiesTravelLane')]: false,
  [sitePath(id, 'typicalApplicationCount')]: 2,
  [sitePath(id, 'gisIsStateMaintainedRoad')]: true,
  [sitePath(id, 'gisIsLimitedAccessRoad')]: false,
  [sitePath(id, 'gisIsInAirportAirspace')]: false,
  [sitePath(id, 'gisIsNearRailroad')]: false,
  [sitePath(id, 'constructionPlanAttached')]: true,
  [sitePath(id, 'delDotAttachmentAgreementAttached')]: true,
  [sitePath(id, 'structuralCalculationsAttached')]: true,
});

const utilityAnswers = {
  '/utilityIsPublic': true,
  '/utilityType': 'power',
  '/utilityWorkType': 'underground',
  '/utilityWorkDescription': 'Install conduit in the shoulder.',
  '/utilityIsEmergency': false,
  '/utilityJurisdiction': 'row',
  '/utilityGroundDisturbanceSqFt': 100,
  '/utilityTrafficImpact': 'none',
  '/utilityDuration': 'day',
  '/utilityDrawingAttached': true,
};
const utilitySiteFacts = id => ({
  [sitePath(id, 'isWirelessNode')]: false,
  [sitePath(id, 'isProjectSite')]: true,
  [sitePath(id, 'hasUndergroundWork')]: false,
  [sitePath(id, 'hasPavementDisturbance')]: false,
  [sitePath(id, 'hasElectricalComponents')]: false,
  [sitePath(id, 'hasMajorTrafficImpact')]: false,
  [sitePath(id, 'hasFoundation')]: false,
  [sitePath(id, 'hasCasing')]: false,
  [sitePath(id, 'crossesRailroad')]: false,
  [sitePath(id, 'requiresDetour')]: false,
  [sitePath(id, 'hasComplexFieldConditions')]: false,
  [sitePath(id, 'impactsPedestrianAccess')]: false,
  [sitePath(id, 'occupiesTravelLane')]: false,
  [sitePath(id, 'typicalApplicationCount')]: 2,
  [sitePath(id, 'gisIsInAirportAirspace')]: false,
  [sitePath(id, 'gisIsNearRailroad')]: false,
});

function apply(graph, facts) {
  for (const [path, value] of Object.entries(facts)) set(graph, path, value);
  graph.save();
}

const checks = [];
const scenarios = [];

function expect(scenario, step, graph, path, expectedStatus, expectedValue) {
  const actual = read(graph, path);
  const pass = actual.status === expectedStatus && (arguments.length < 6 || actual.value === expectedValue);
  checks.push({ scenario, step, path, expectedStatus, expectedValue, actual, pass });
}

function capture(scenario, step, graph, paths) {
  scenarios.push({ scenario, step, state: Object.fromEntries(paths.map(path => [path, read(graph, path)])) });
}

// 1. A general utility application before decision facts have been supplied.
{
  const name = '1 · General utility starts undetermined';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true });
  capture(name, 'application type and shared facts', graph, ['/utilityPermitType', '/utilityPermitEligible', '/applicationComplete', '/readyToSubmit']);
  expect(name, 'application type and shared facts', graph, '/utilityPermitType', 'incomplete');
  expect(name, 'application type and shared facts', graph, '/readyToSubmit', 'complete', false);
  apply(graph, { '/utilityIsEmergency': true });
  capture(name, 'emergency selected before GIS response', graph, ['/utilityIsEmergency', '/utilityPermitType', '/allSitesGisJurisdictionEligible', '/utilityPermitEligible']);
  expect(name, 'emergency selected before GIS response', graph, '/utilityPermitType', 'complete', 'After-the-Fact Emergency Utility Permit');
  expect(name, 'emergency selected before GIS response', graph, '/utilityPermitEligible', 'complete', true);
}

// 2. Ordinary utility construction work on an eligible road.
{
  const name = '2 · Utility construction permit';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true });
  capture(name, 'shared facts', graph, ['/sharedApplicationFactsComplete', '/utilityPermitType']);
  apply(graph, { ...utilityAnswers, ...utilitySiteFacts(id) });
  capture(name, 'applicant work facts', graph, ['/utilityPermitType', '/utilityPermitEligible', '/utilityRequiredAnswersComplete']);
  apply(graph, { [sitePath(id, 'gisIsStateMaintainedRoad')]: true, [sitePath(id, 'gisIsLimitedAccessRoad')]: false });
  capture(name, 'GIS response', graph, ['/allSitesGisJurisdictionEligible', '/utilityPermitEligible', '/applicationComplete']);
  apply(graph, { '/attestationsAccepted': true });
  capture(name, 'attestation', graph, ['/applicationComplete', '/readyToSubmit']);
  expect(name, 'applicant work facts', graph, '/utilityPermitType', 'complete', 'Utility Construction Permit');
  expect(name, 'GIS response', graph, '/utilityPermitEligible', 'complete', true);
  expect(name, 'attestation', graph, '/readyToSubmit', 'complete', true);
}

// 3. Zero disturbance but traffic impact produces a safety permit.
{
  const name = '3 · Utility safety permit';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, ...utilityAnswers, ...utilitySiteFacts(id),
    '/utilityGroundDisturbanceSqFt': 0, '/utilityTrafficImpact': 'lane',
    [sitePath(id, 'gisIsStateMaintainedRoad')]: true, [sitePath(id, 'gisIsLimitedAccessRoad')]: false });
  capture(name, 'work and GIS facts', graph, ['/utilityPermitType', '/utilityPermitEligible', '/utilityRequiresTrafficControlPlan']);
  expect(name, 'work and GIS facts', graph, '/utilityPermitType', 'complete', 'Utility Safety Permit');
  expect(name, 'work and GIS facts', graph, '/utilityPermitEligible', 'complete', true);
  expect(name, 'work and GIS facts', graph, '/utilityRequiresTrafficControlPlan', 'complete', false);
  apply(graph, { [sitePath(id, 'requiresDetour')]: true });
  capture(name, 'shared site detour answer', graph, [sitePath(id, 'requiresDetour'), sitePath(id, 'requiresTrafficControlPlan'), '/anySiteRequiresTrafficControlPlan', '/utilityRequiresTrafficControlPlan']);
  expect(name, 'shared site detour answer', graph, '/utilityRequiresTrafficControlPlan', 'complete', true);
}

// 4. Applicant says the work is outside DelDOT jurisdiction.
{
  const name = '4 · Utility outside applicant-declared jurisdiction';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, ...utilityAnswers, ...utilitySiteFacts(id),
    '/utilityJurisdiction': 'none',
    [sitePath(id, 'gisIsStateMaintainedRoad')]: false, [sitePath(id, 'gisIsLimitedAccessRoad')]: false });
  capture(name, 'applicant and GIS agree', graph, ['/utilityPermitType', '/allSitesGisJurisdictionEligible', '/utilityPermitEligible']);
  expect(name, 'applicant and GIS agree', graph, '/utilityPermitType', 'complete', 'No DelDOT permit needed');
  expect(name, 'applicant and GIS agree', graph, '/utilityPermitEligible', 'complete', false);
}

// 5. Applicant selects DelDOT jurisdiction, while GIS routes limited access to review.
{
  const name = '5 · GIS blocks limited-access work';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, ...utilityAnswers, ...utilitySiteFacts(id),
    [sitePath(id, 'gisIsStateMaintainedRoad')]: true, [sitePath(id, 'gisIsLimitedAccessRoad')]: true });
  capture(name, 'applicant work facts plus GIS conflict', graph, ['/utilityPermitType', sitePath(id, 'gisJurisdictionEligible'), sitePath(id, 'gisSpecialReviewRequired'), '/utilityPermitEligible', '/applicationComplete']);
  expect(name, 'applicant work facts plus GIS conflict', graph, '/utilityPermitType', 'complete', 'Utility Construction Permit');
  expect(name, 'applicant work facts plus GIS conflict', graph, sitePath(id, 'gisSpecialReviewRequired'), 'complete', true);
  expect(name, 'applicant work facts plus GIS conflict', graph, '/utilityPermitEligible', 'complete', true);
}

// 6. One completely eligible wireless node.
{
  const name = '6 · One eligible wireless node';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/requestedWirelessNodeCount': 1,
    '/mlUoaAttached': true, '/authorizedAgentFormAttached': false, ...eligibleWirelessSite(id) });
  capture(name, 'node facts', graph, [sitePath(id, 'sizeEligible'), sitePath(id, 'heightLimit'), sitePath(id, 'heightEligible'), sitePath(id, 'gisJurisdictionEligible'), sitePath(id, 'permitEligible'), sitePath(id, 'documentsComplete'), '/wirelessNodeCountMatchesRequest', '/wirelessTotalFee']);
  expect(name, 'node facts', graph, sitePath(id, 'permitEligible'), 'complete', true);
  expect(name, 'node facts', graph, sitePath(id, 'documentsComplete'), 'complete', true);
  expect(name, 'node facts', graph, '/wirelessTotalFee', 'complete', '100.00');
  apply(graph, { [sitePath(id, 'hasUndergroundWork')]: true });
  capture(name, 'underground work without owner member ID', graph, [sitePath(id, 'hasUndergroundWork'), sitePath(id, 'undergroundOwnerRequirementSatisfied'), sitePath(id, 'requiredAnswersComplete')]);
  expect(name, 'underground work without owner member ID', graph, sitePath(id, 'undergroundOwnerRequirementSatisfied'), 'complete', false);
  apply(graph, { [sitePath(id, 'undergroundOwnerMemberId')]: 'MEMBER-123' });
  capture(name, 'underground owner member ID supplied', graph, [sitePath(id, 'undergroundOwnerMemberId'), sitePath(id, 'undergroundOwnerRequirementSatisfied'), sitePath(id, 'requiredAnswersComplete')]);
  expect(name, 'underground owner member ID supplied', graph, sitePath(id, 'undergroundOwnerRequirementSatisfied'), 'complete', true);
}

// 7. Wireless equipment exceeds the small-wireless size limit.
{
  const name = '7 · Oversized wireless equipment';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/requestedWirelessNodeCount': 1,
    ...eligibleWirelessSite(id), [sitePath(id, 'largestAntennaVolume')]: 7 });
  capture(name, 'oversized antenna', graph, [sitePath(id, 'sizeEligible'), sitePath(id, 'heightEligible'), sitePath(id, 'permitEligible'), '/allWirelessNodesEligible']);
  expect(name, 'oversized antenna', graph, sitePath(id, 'sizeEligible'), 'complete', false);
  expect(name, 'oversized antenna', graph, sitePath(id, 'permitEligible'), 'complete', false);
}

// 8. Wireless facility elevation exceeds its derived height limit.
{
  const name = '8 · Wireless height exceeds limit';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/requestedWirelessNodeCount': 1,
    ...eligibleWirelessSite(id), [sitePath(id, 'facilityHeight')]: 51 });
  capture(name, 'height facts', graph, [sitePath(id, 'poleHeight'), sitePath(id, 'facilityHeight'), sitePath(id, 'heightLimit'), sitePath(id, 'heightEligible'), sitePath(id, 'permitEligible')]);
  const displayedHeightLimit=decimalValue(read(graph,sitePath(id,'heightLimit')).value);
  const displayPass=displayedHeightLimit===50;
  checks.push({scenario:name,step:'height limit presentation',path:sitePath(id,'heightLimit'),expectedStatus:'decimal display',expectedValue:50,actual:{status:displayPass?'decimal display':'raw engine value',value:displayedHeightLimit},pass:displayPass});
  expect(name, 'height facts', graph, sitePath(id, 'heightEligible'), 'complete', false);
}

// 9. Two wireless nodes can have different eligibility while sharing one fee total.
{
  const name = '9 · Mixed per-node eligibility';
  const { graph, ids: [first, second] } = makeGraph(2);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/requestedWirelessNodeCount': 2,
    ...eligibleWirelessSite(first), ...eligibleWirelessSite(second),
    [sitePath(first, 'siteId')]: 'NODE-A', [sitePath(second, 'siteId')]: 'NODE-B',
    [sitePath(second, 'otherEquipmentVolume')]: 30 });
  capture(name, 'two node facts', graph, [sitePath(first, 'permitEligible'), sitePath(second, 'permitEligible'), '/allWirelessNodesEligible', '/wirelessNodeCount', '/wirelessTotalFee']);
  expect(name, 'two node facts', graph, sitePath(first, 'permitEligible'), 'complete', true);
  expect(name, 'two node facts', graph, sitePath(second, 'permitEligible'), 'complete', false);
  expect(name, 'two node facts', graph, '/allWirelessNodesEligible', 'complete', false);
  expect(name, 'two node facts', graph, '/wirelessTotalFee', 'complete', '200.00');
  apply(graph, { '/requestedWirelessNodeCount': 3 });
  capture(name, 'declared count changed without adding a node', graph, ['/requestedWirelessNodeCount', '/wirelessNodeCount', '/wirelessNodeCountMatchesRequest', '/smallWirelessRequirementsSatisfied']);
  expect(name, 'declared count changed without adding a node', graph, '/wirelessNodeCountMatchesRequest', 'complete', false);
}

// 10. GIS independently creates airport and railroad document consequences.
{
  const name = '10 · GIS-derived sensitive-area documents';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/requestedWirelessNodeCount': 1,
    ...eligibleWirelessSite(id),
    [sitePath(id, 'gisIsInAirportAirspace')]: true,
    [sitePath(id, 'gisIsNearRailroad')]: true,
    [sitePath(id, 'airportFormAttached')]: false,
    [sitePath(id, 'railroadProximityReviewAttached')]: false });
  capture(name, 'GIS sensitive-area response', graph, [sitePath(id, 'gisIsInAirportAirspace'), sitePath(id, 'airportReviewRequired'), sitePath(id, 'airportFormRequired'), sitePath(id, 'crossesRailroad'), sitePath(id, 'gisIsNearRailroad'), sitePath(id, 'railroadReviewRequired'), sitePath(id, 'railroadApprovalRequired'), sitePath(id, 'railroadProximityReviewRequired')]);
  expect(name, 'GIS sensitive-area response', graph, sitePath(id, 'airportFormRequired'), 'complete', true);
  expect(name, 'GIS sensitive-area response', graph, sitePath(id, 'railroadApprovalRequired'), 'complete', false);
  expect(name, 'GIS sensitive-area response', graph, sitePath(id, 'railroadProximityReviewRequired'), 'complete', true);
  expect(name, 'GIS sensitive-area response', graph, sitePath(id, 'documentsComplete'), 'complete', false);
}

// 11. One shared site produces coordinated entrance and utility permits.
{
  const name = '11 · Integrated entrance and utility package';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, '/includesEntranceWork': true,
    ...utilityAnswers, ...utilitySiteFacts(id),
    [sitePath(id, 'gisIsStateMaintainedRoad')]: true,
    [sitePath(id, 'hasUndergroundWork')]: true,
    [sitePath(id, 'undergroundOwnerMemberId')]: '811-UTILITY',
    '/entranceType': 'commercial', '/entranceWorkType': 'new', '/entrancePlanningApprovalReceived': true,
    '/entranceExistingAdtEntering': 300, '/entranceExistingAdtExiting': 250, '/entrancePeakHourTrips': 60,
    '/entrancePriorUse': 'Vacant parcel', '/entranceProposedUse': 'Retail', '/entranceStakesDate': '2026-09-15', '/entranceTaxParcelId': '8-00-123.00-01-01.00',
    '/entrancePlanningApprovalAttached': true, '/entranceOwnershipAttached': true, '/entranceRecordedPlanAttached': true,
    '/entranceConstructionPlanAttached': true, '/entranceCostEstimateAttached': true, '/entranceScheduleAttached': true,
    '/entranceTrafficAnalysisAttached': true, '/entrancePedestrianEvidenceAttached': false });
  capture(name, 'shared site and both permit facts', graph, ['/utilityPermitType', '/entrancePermitType', '/entranceTotalAdt', '/entranceTrafficOperationalAnalysisRequired', '/entrancePreSubmittalMeetingRequired', '/crossPermitCoordinationRequired', '/entranceRequirementsSatisfied', '/applicationComplete']);
  expect(name, 'shared site and both permit facts', graph, '/utilityPermitType', 'complete', 'Utility Construction Permit');
  expect(name, 'shared site and both permit facts', graph, '/entrancePermitType', 'complete', 'Entrance Permit');
  expect(name, 'shared site and both permit facts', graph, '/entranceTotalAdt', 'complete', 550);
  expect(name, 'shared site and both permit facts', graph, '/entranceTrafficOperationalAnalysisRequired', 'complete', true);
  expect(name, 'shared site and both permit facts', graph, '/entrancePreSubmittalMeetingRequired', 'complete', true);
  expect(name, 'shared site and both permit facts', graph, '/crossPermitCoordinationRequired', 'complete', true);
  expect(name, 'shared site and both permit facts', graph, '/entranceRequirementsSatisfied', 'complete', true);
}

// 12. Small wireless and entrance work can coexist without mixing the project site and wireless nodes.
{
  const name = '12 · Small wireless and entrance together';
  const { graph, ids: [projectSite, wirelessNode] } = makeGraph(2);
  apply(graph, { ...shared, '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/includesEntranceWork': true,
    '/requestedWirelessNodeCount': 1, '/mlUoaAttached': true, ...utilityAnswers, ...utilitySiteFacts(projectSite), ...eligibleWirelessSite(wirelessNode),
    [sitePath(projectSite, 'gisIsStateMaintainedRoad')]: true,
    [sitePath(projectSite, 'hasUndergroundWork')]: true, [sitePath(projectSite, 'undergroundOwnerMemberId')]: '811-COMBINED',
    '/entranceType': 'industrial', '/entranceWorkType': 'new', '/entrancePlanningApprovalReceived': true,
    '/entranceExistingAdtEntering': 80, '/entranceExistingAdtExiting': 70, '/entrancePeakHourTrips': 30,
    '/entrancePriorUse': 'Warehouse', '/entranceProposedUse': 'Expanded warehouse', '/entranceStakesDate': '2026-10-01', '/entranceTaxParcelId': 'TEST-PARCEL',
    '/entrancePlanningApprovalAttached': true, '/entranceOwnershipAttached': true, '/entranceRecordedPlanAttached': true,
    '/entranceConstructionPlanAttached': true, '/entranceCostEstimateAttached': true, '/entranceScheduleAttached': true });
  capture(name, 'both activity sets evaluated', graph, ['/entrancePermitType', '/wirelessNodeCount', '/allWirelessNodesEligible', '/allSitesGisJurisdictionEligible', '/applicationComplete']);
  expect(name, 'all activity sets evaluated', graph, '/entrancePermitType', 'complete', 'Entrance Permit');
  expect(name, 'all activity sets evaluated', graph, '/wirelessNodeCount', 'complete', 1);
  expect(name, 'all activity sets evaluated', graph, '/allWirelessNodesEligible', 'complete', true);
  expect(name, 'all activity sets evaluated', graph, '/allSitesGisJurisdictionEligible', 'complete', true);
  expect(name, 'all activity sets evaluated', graph, '/crossPermitCoordinationRequired', 'complete', true);
  expect(name, 'all activity sets evaluated', graph, '/applicationComplete', 'complete', true);
}

// 13. Selecting activities alone must not manufacture negative answers or a utility outcome.
{
  const name = '13 · Activity selection does not determine permit outcome';
  const { graph, ids: [projectSite] } = makeGraph(1);
  apply(graph, { '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, '/includesEntranceWork': true,
    [sitePath(projectSite, 'isWirelessNode')]: false, [sitePath(projectSite, 'isProjectSite')]: true });
  capture(name, 'only activities selected', graph, ['/utilityIsEmergency', '/utilityIsInDelDOTJurisdiction', '/utilityGroundDisturbanceSqFt', '/utilityPermitType', '/entrancePermitType', '/applicationComplete']);
  expect(name, 'only activities selected', graph, '/utilityIsEmergency', 'incomplete');
  expect(name, 'only activities selected', graph, '/utilityIsInDelDOTJurisdiction', 'incomplete');
  expect(name, 'only activities selected', graph, '/utilityGroundDisturbanceSqFt', 'incomplete');
  expect(name, 'only activities selected', graph, '/utilityPermitType', 'incomplete');
  expect(name, 'only activities selected', graph, '/entrancePermitType', 'incomplete');
  expect(name, 'only activities selected', graph, '/applicationComplete', 'complete', false);
}

// 14. One project-scoped agent form can satisfy multiple permit consumers.
{
  const name = '14 · Shared agent authorization document';
  const { graph } = makeGraph();
  apply(graph, { '/includesUtilityActivity': true, '/includesSmallWirelessFacilities': true, '/includesEntranceWork': true,
    '/isAuthorizedAgent': true, '/authorizedAgentFormAttached': false, '/mlUoaAttached': true });
  capture(name, 'agent filing for all permit types', graph, ['/authorizedAgentFormRequired', '/authorizedAgentFormRequiredByUtility', '/authorizedAgentFormRequiredByWireless', '/authorizedAgentFormRequiredByEntrance', '/authorizedAgentFormScope', '/authorizedAgentFormReason', '/authorizedAgentRequirementSatisfied']);
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormRequired', 'complete', true);
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormRequiredByUtility', 'complete', false);
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormRequiredByWireless', 'complete', true);
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormRequiredByEntrance', 'complete', true);
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormScope', 'complete', 'project');
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentFormReason', 'complete', 'You are filing as an authorized agent for this project.');
  expect(name, 'agent filing for all permit types', graph, '/authorizedAgentRequirementSatisfied', 'complete', false);
  apply(graph, { '/authorizedAgentFormAttached': true });
  expect(name, 'one upload attached', graph, '/authorizedAgentRequirementSatisfied', 'complete', true);
}

// 15. Other utility work, small wireless, and entrance work can all be selected together.
{
  const name = '15 · All three activity sets in one project';
  const { graph } = makeGraph();
  apply(graph, { '/includesUtilityActivity': true, '/includesGeneralUtilityWork': true, '/includesSmallWirelessFacilities': true, '/includesEntranceWork': true });
  capture(name, 'all activity sets selected', graph, ['/utilitySubtypeSelectionValid', '/isSmallWirelessApplication', '/entrancePermitRequested']);
  expect(name, 'all activity sets selected', graph, '/utilitySubtypeSelectionValid', 'complete', true);
  expect(name, 'all activity sets selected', graph, '/isSmallWirelessApplication', 'complete', true);
  expect(name, 'all activity sets selected', graph, '/entrancePermitRequested', 'complete', true);
}

// 16. Decimal equipment volumes remain valid graph values and retain qualification semantics.
{
  const name = '16 · Decimal wireless equipment volumes';
  const { graph, ids: [id] } = makeGraph(1);
  apply(graph, { ...eligibleWirelessSite(id), [sitePath(id, 'largestAntennaVolume')]: 5.5, [sitePath(id, 'otherEquipmentVolume')]: 27.25 });
  expect(name, 'decimal values supplied', graph, sitePath(id, 'sizeEligible'), 'complete', true);
  apply(graph, { [sitePath(id, 'poleHeight')]: 40.5, [sitePath(id, 'facilityHeight')]: 49.75 });
  expect(name, 'decimal heights supplied', graph, sitePath(id, 'heightEligible'), 'complete', true);
  const decimalLimit=decimalValue(read(graph,sitePath(id,'heightLimit')).value);
  const decimalDisplayPass=decimalLimit===50.5;
  checks.push({scenario:name,step:'decimal height-limit presentation',path:sitePath(id,'heightLimit'),expectedStatus:'decimal display',expectedValue:50.5,actual:{status:decimalDisplayPass?'decimal display':'raw engine value',value:decimalLimit},pass:decimalDisplayPass});
  apply(graph, { [sitePath(id, 'largestAntennaVolume')]: 6.5 });
  expect(name, 'statutory threshold exceeded', graph, sitePath(id, 'sizeEligible'), 'complete', false);
}

// 17. Static fact paths shown by the browser must exist in the loaded dictionary.
{
  const name = '17 · UI fact-path integrity';
  const { graph } = makeGraph();
  const dictionaryPaths = new Set(Array.from(graph.paths()));
  const staticPaths = [...appSource.matchAll(/['"](\/[A-Za-z][A-Za-z0-9/*-]*)['"]/g)].map(match => match[1]);
  for (const path of new Set(staticPaths)) {
    if (path.includes('*') || path.endsWith('/') || path === '/utility') continue;
    const pass = dictionaryPaths.has(path);
    checks.push({ scenario:name, step:'static source scan', path, expectedStatus:'declared', expectedValue:true, actual:{status:pass?'declared':'missing',value:pass}, pass });
  }
}

// 18. Explanations expose writable leaves and preserve the engine's fact groups.
{
  const name = '18 · Native explanation leaves and groups';
  const { graph } = makeGraph();
  apply(graph, { '/utilityIsEmergency': false, '/utilityJurisdiction': 'row', '/utilityGroundDisturbanceSqFt': 480,
    '/utilityTrafficImpact': 'none', '/utilityDuration': 'day' });
  const groups=explanationGroups(graph.explain('/utilityPermitType'));
  const flattened=groups.flat();
  for(const path of ['/utilityIsEmergency','/utilityJurisdiction','/utilityGroundDisturbanceSqFt']){
    const pass=flattened.includes(path);
    checks.push({scenario:name,step:'construction permit explanation',path,expectedStatus:'writable leaf',expectedValue:true,actual:{status:pass?'writable leaf':'missing',value:pass},pass});
  }
  const excludesIntermediate=!flattened.includes('/utilityIsInDelDOTJurisdiction');
  checks.push({scenario:name,step:'construction permit explanation',path:'/utilityIsInDelDOTJurisdiction',expectedStatus:'excluded intermediate',expectedValue:true,actual:{status:excludesIntermediate?'excluded intermediate':'included',value:excludesIntermediate},pass:excludesIntermediate});
  const text=formatGraphExplanation(graph,'/utilityPermitType');
  const preservesGroups=text.includes('determining groups')&&groups.length===3;
  checks.push({scenario:name,step:'group formatting',path:'/utilityPermitType',expectedStatus:'grouped',expectedValue:true,actual:{status:preservesGroups?'grouped':'flattened',value:text},pass:preservesGroups});
}

const failures = checks.filter(check => !check.pass);
const report = { scenarios, checks: { total: checks.length, passed: checks.length - failures.length, failed: failures.length, failures } };
console.log(JSON.stringify(process.argv.includes('--summary') ? report.checks : report, null, 2));
process.exitCode = failures.length ? 1 : 0;
