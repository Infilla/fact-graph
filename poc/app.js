import * as FactGraph from '../demo/fg.js';
import { formatGraphExplanation } from './explanation.js';
import { decimalValue } from './presentation.js';

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const hasValue = value => value !== '' && value !== null && value !== undefined;

const dictionaryXml = await fetch('./fact-dictionary.xml').then(response => response.text());
const dictionary = FactGraph.FactDictionaryFactory.importFromXml(dictionaryXml);
let graph;
const enumPaths = {
  '/contactFilerType':'/contactFilerTypeOptions','/utilityType':'/utilityTypeOptions','/utilityWorkType':'/utilityWorkTypeOptions',
  '/utilityJurisdiction':'/utilityJurisdictionOptions','/utilityTrafficImpact':'/utilityTrafficImpactOptions','/utilityDuration':'/utilityDurationOptions',
  '/entranceType':'/entranceTypeOptions','/entranceWorkType':'/entranceWorkTypeOptions',scope:'/siteScopeOptions',structureWork:'/siteStructureWorkOptions',poleOwner:'/sitePoleOwnerOptions'
};
const optionLabels = {
  owner:'Owner / agreement holder',agent:'Authorized consultant / agent',water:'Water',sewer:'Sewer',gas:'Gas / propane',power:'Power / electrical',telephone:'Telephone / cable',fiber:'Fiber-optic',
  simple:'Above ground — simple work',pole:'Above ground — new or revamped poles',underground:'Underground',row:'State-maintained right-of-way',easement:'Permanent DelDOT easement',aerial:'Aerial crossing over right-of-way',none:'None',lane:'Lane / shoulder occupation',major:'Detour, complex site, or pedestrian impact',day:'Up to 1 day',longer:'Longer than 1 working day',
  commercial:'Commercial',subdivision:'Subdivision',industrial:'Industrial',solar:'Solar farm',new:'New installation',modify:'Modification / upgrade',relocate:'Relocate an existing entrance',attach:'Attach to existing structure',replace:'Replace structure',utility:'Utility company',wip:'Wireless infrastructure provider',deldot:'DelDOT',other:'Other private entity'
};

const emptyContact = () => ({ company:'', firstName:'', lastName:'', email:'', phone:'', filer:'' });
const emptyGis = () => ({ stateMaintained:'', limitedAccess:'', airportAirspace:'', nearRailroad:'' });
const emptyNode = (index) => ({ id:crypto.randomUUID(), label:`Node ${index}`, siteId:'', locationRelationship:'', address:'', latitude:'', longitude:'', county:'', scope:'', antennaVolume:'', equipmentVolume:'', poleHeight:'', facilityHeight:'', structureWork:'', poleOwner:'', foundations:null, underground:null, undergroundOwnerMemberId:'', pavement:null, electrical:null, casing:null, railroad:null, majorTrafficImpact:null, detour:null, complexConditions:null, pedestrianImpact:null, travelLaneOccupation:null, taCount:'', gis:emptyGis() });
const emptyEntrance = () => ({ type:'', workType:'', planningApproval:'', adtEntering:'', adtExiting:'', peakHourTrips:'', priorUse:'', proposedUse:'', stakesDate:'', taxParcelId:'' });
const defaultState = { activities:{utility:false,utilitySubtype:'',generalUtility:false,smallWireless:false,entrance:false}, applicationType:'', projectName:'', requestedNodeCount:'', contact:emptyContact(), utility:{ id:crypto.randomUUID(), publicUtility:'', utilityType:'', emergency:'', jurisdiction:'', address:'', latitude:'', longitude:'', county:'', disturbance:'', trafficImpact:'', duration:'', workType:'', description:'', foundations:null, underground:null, undergroundOwnerMemberId:'', pavement:null, electrical:null, casing:null, railroad:null, detour:null, complexConditions:null, pedestrianImpact:null, travelLaneOccupation:null, taCount:'', gis:emptyGis() }, entrance:emptyEntrance(), nodes:[], currentNode:0, documentComplete:{}, attestationAccepted:false, submitted:false };
let state = JSON.parse(localStorage.getItem('deldot-poc') || 'null') || structuredClone(defaultState);
state.utility=Object.assign({},defaultState.utility,state.utility);
state.utility.gis=Object.assign(emptyGis(),state.utility.gis);
state.entrance=Object.assign(emptyEntrance(),state.entrance);
state.activities=Object.assign({},defaultState.activities,state.activities);
if(!Object.values(state.activities).some(Boolean)&&state.applicationType){ state.activities.generalUtility=state.applicationType==='utility'||state.applicationType==='combined'; state.activities.smallWireless=state.applicationType==='wireless'; state.activities.entrance=state.applicationType==='combined'; }
if(state.activities.generalUtility||state.activities.smallWireless){ state.activities.utility=true; state.activities.utilitySubtype=state.activities.smallWireless?'wireless':'other'; }
state.nodes=state.nodes.map((node,index)=>({...emptyNode(index+1),...node,gis:{...emptyGis(),...node.gis}}));
if (state.requestedNodeCount === undefined) state.requestedNodeCount = state.nodes.length || '';
state.documentComplete ||= {};
state.attestationAccepted ||= false;
if(Object.entries(state.documentComplete).some(([key,complete])=>complete&&key.endsWith(':Authorized agent form'))) state.documentComplete['project:Authorized agent form']=true;
if(Object.entries(state.documentComplete).some(([key,complete])=>complete&&key.endsWith(':Master Limited Use & Occupancy Agreement (MLUOA)'))) state.documentComplete['project:Master Limited Use & Occupancy Agreement (MLUOA)']=true;
let step = 0;
let previousVisualizerValues = new Map();
const hasGeneralUtility = () => Boolean(state.activities.generalUtility);
const hasWireless = () => Boolean(state.activities.smallWireless);
const hasEntrance = () => Boolean(state.activities.entrance);
const hasUtilityActivity = () => Boolean(state.activities.utility);
const hasAnyActivity = () => hasUtilityActivity()||hasEntrance();
const activityCount = () => [hasGeneralUtility(),hasWireless(),hasEntrance()].filter(Boolean).length;
const hasSharedProjectSite = () => hasGeneralUtility()||hasEntrance();
const nodeUsesProjectSite = node => Boolean(node&&hasSharedProjectSite()&&node.locationRelationship==='shared');
const nodeLocation = node => nodeUsesProjectSite(node)?state.utility:node;
function syncLegacyApplicationType(){ state.applicationType=[hasGeneralUtility()?'utility':'',hasWireless()?'wireless':'',hasEntrance()?'entrance':''].filter(Boolean).join('+'); }

const graphSet = (path, value, type='string') => {
  if (value === '' || value === null || value === undefined) return;
  let typed = type === 'int' ? Number(value) : type === 'boolean' ? Boolean(value) : value;
  if(type==='rational'){
    const decimals=(String(value).split('.')[1]||'').length;
    const denominator=10**decimals;
    typed=FactGraph.RationalFactory(Math.round(Number(value)*denominator),denominator);
  }
  const enumOptionsPath=enumPaths[path]||enumPaths[path.split('/').pop()];
  if(enumOptionsPath) typed=FactGraph.EnumFactory(String(value),enumOptionsPath).right;
  graph.set__T__O__V(path, typed);
};
const graphResult = path => {
  try{
    const result = graph.get(path);
    if(result?.productPrefix__T?.()!=='Complete') return null;
    const value=result.productElement__I__O(0);
    return value&&typeof value==='object'&&value.toString__T ? value.toString__T() : value;
  }catch(error){
    console.warn(`Unable to read fact ${path}`,error);
    return null;
  }
};
const graphBoolean = path => graphResult(path) === true;
const scalaList = value => {
  const values=[];
  while(value&&Object.hasOwn(value,'sci_$colon$colon__f_head')){ values.push(value['sci_$colon$colon__f_head']); value=value['sci_$colon$colon__f_next']; }
  return values;
};
const enumChoices = optionsPath => {
  const result=graph.get(optionsPath);
  return result?.productPrefix__T?.()==='Complete' ? scalaList(result.productElement__I__O(0)).map(value=>[value,optionLabels[value]||value]) : [];
};

function rebuildGraph(){
  graph=FactGraph.GraphFactory.apply(dictionary);
  if(hasAnyActivity()){
    graphSet('/includesUtilityActivity',hasUtilityActivity(),'boolean');
    graphSet('/includesGeneralUtilityWork',hasGeneralUtility(),'boolean');
    graphSet('/includesSmallWirelessFacilities',hasWireless(),'boolean');
    graphSet('/includesEntranceWork',hasEntrance(),'boolean');
  }
  graphSet('/projectName',state.projectName);
  graphSet('/contactCompany',state.contact.company);
  graphSet('/contactFirstName',state.contact.firstName);
  graphSet('/contactLastName',state.contact.lastName);
  graphSet('/contactEmail',state.contact.email);
  graphSet('/contactPhone',state.contact.phone);
  graphSet('/contactFilerType',state.contact.filer);
  if(hasValue(state.contact.filer)) graphSet('/isAuthorizedAgent',state.contact.filer==='agent','boolean');
  graphSet('/requestedWirelessNodeCount',state.requestedNodeCount,'int');
  graphSet('/attestationsAccepted',state.attestationAccepted,'boolean');
  const u=state.utility;
  if(hasGeneralUtility()){
    if(hasValue(u.publicUtility)) graphSet('/utilityIsPublic',u.publicUtility==='yes','boolean');
    graphSet('/utilityType',u.utilityType);
    graphSet('/utilityWorkType',u.workType);
    graphSet('/utilityWorkDescription',u.description);
    if(hasValue(u.emergency)) graphSet('/utilityIsEmergency',u.emergency==='yes','boolean');
    graphSet('/utilityJurisdiction',u.jurisdiction);
    graphSet('/utilityGroundDisturbanceSqFt',u.disturbance,'int');
    graphSet('/utilityTrafficImpact',u.trafficImpact);
    graphSet('/utilityDuration',u.duration);
  }
  if(hasEntrance()){
    const e=state.entrance;
    graphSet('/entranceType',e.type);
    graphSet('/entranceWorkType',e.workType);
    if(hasValue(e.planningApproval)) graphSet('/entrancePlanningApprovalReceived',e.planningApproval==='yes','boolean');
    graphSet('/entranceExistingAdtEntering',e.adtEntering,'int');
    graphSet('/entranceExistingAdtExiting',e.adtExiting,'int');
    graphSet('/entrancePeakHourTrips',e.peakHourTrips,'int');
    graphSet('/entrancePriorUse',e.priorUse);
    graphSet('/entranceProposedUse',e.proposedUse);
    graphSet('/entranceStakesDate',e.stakesDate);
    graphSet('/entranceTaxParcelId',e.taxParcelId);
  }
  const sites=[...(hasGeneralUtility()||hasEntrance()?[state.utility]:[]),...(hasWireless()?state.nodes:[])];
  graph.set__T__O__V('/sites',FactGraph.CollectionFactory(sites.map(site=>site.id)));
  graph.save();
  sites.forEach((site,index)=>{
    const p=`/sites/#${site.id}`;
    const isNode=state.nodes.includes(site);
    const sharesProjectLocation=isNode&&site.locationRelationship==='shared'&&(hasGeneralUtility()||hasEntrance());
    const effectiveLocation=sharesProjectLocation?state.utility:site;
    const values=isNode?{
      siteId:site.siteId,usesProjectSiteLocation:[hasSharedProjectSite()?(hasValue(site.locationRelationship)?sharesProjectLocation:''):false,'boolean'],address:effectiveLocation.address,latitude:effectiveLocation.latitude,longitude:effectiveLocation.longitude,county:effectiveLocation.county,scope:site.scope,structureWork:site.structureWork,poleOwner:site.poleOwner,
      largestAntennaVolume:[site.antennaVolume,'rational'],otherEquipmentVolume:[site.equipmentVolume,'rational'],poleHeight:[site.poleHeight,'rational'],facilityHeight:[site.facilityHeight,'rational'],typicalApplicationCount:[site.taCount,'int'],
      hasFoundation:[site.foundations,'boolean'],hasUndergroundWork:[site.underground,'boolean'],undergroundOwnerMemberId:site.undergroundOwnerMemberId,hasPavementDisturbance:[site.pavement,'boolean'],hasElectricalComponents:[site.electrical,'boolean'],hasCasing:[site.casing,'boolean'],crossesRailroad:[site.railroad,'boolean'],hasMajorTrafficImpact:[site.majorTrafficImpact,'boolean'],requiresDetour:[site.detour,'boolean'],hasComplexFieldConditions:[site.complexConditions,'boolean'],impactsPedestrianAccess:[site.pedestrianImpact,'boolean'],occupiesTravelLane:[site.travelLaneOccupation,'boolean']
    }:{siteId:'Utility site',address:site.address,latitude:site.latitude,longitude:site.longitude,county:site.county,hasFoundation:[site.foundations,'boolean'],hasUndergroundWork:[site.underground,'boolean'],undergroundOwnerMemberId:site.undergroundOwnerMemberId,hasPavementDisturbance:[site.pavement,'boolean'],hasElectricalComponents:[site.electrical,'boolean'],hasCasing:[site.casing,'boolean'],crossesRailroad:[site.railroad,'boolean'],hasMajorTrafficImpact:[hasValue(site.trafficImpact)?site.trafficImpact==='major':null,'boolean'],requiresDetour:[site.detour,'boolean'],hasComplexFieldConditions:[site.complexConditions,'boolean'],impactsPedestrianAccess:[site.pedestrianImpact,'boolean'],occupiesTravelLane:[site.travelLaneOccupation,'boolean'],typicalApplicationCount:[site.taCount,'int']};
    values.isWirelessNode=[isNode,'boolean']; values.isProjectSite=[!isNode,'boolean'];
    Object.entries(values).forEach(([name,entry])=>graphSet(`${p}/${name}`,...(Array.isArray(entry)?entry:[entry])));
    const gis=(sharesProjectLocation?state.utility:site).gis||emptyGis();
    [['gisIsStateMaintainedRoad',gis.stateMaintained],['gisIsLimitedAccessRoad',gis.limitedAccess],['gisIsInAirportAirspace',gis.airportAirspace],['gisIsNearRailroad',gis.nearRailroad]].forEach(([name,value])=>{ if(value!=='') graphSet(`${p}/${name}`,value==='true','boolean'); });
  });
  graph.save();
  graphSet('/mlUoaAttached',Boolean(state.documentComplete['project:Master Limited Use & Occupancy Agreement (MLUOA)']),'boolean');
  graphSet('/authorizedAgentFormAttached',Boolean(state.documentComplete['project:Authorized agent form']),'boolean');
  graphDocumentRecords().filter(record=>record.scope!=='project').forEach(record=>graphSet(record.attached,Boolean(state.documentComplete[record.key]),'boolean'));
  graph.save();
}
const facts = () => {
  const node = state.nodes[state.currentNode];
  const wireless = hasWireless();
  const docs = graphDocumentRecords().filter(record=>wireless?record.scope==='node'&&record.node===node:record.requiredBy.includes('utility')).map(record=>record.label);
  const derivedUtilityPermit=graphResult('/utilityPermitType');
  const wirelessPermit = graphResult('/wirelessPermitType')||'Not determined';
  return { wireless, utility:hasGeneralUtility(), entrance:hasEntrance(), combined:activityCount()>1, permitType:hasGeneralUtility()?(derivedUtilityPermit||'Not determined'):(wireless?wirelessPermit:'Not requested'), wirelessPermitType:wirelessPermit, entrancePermitType:graphResult('/entrancePermitType')||'Not determined', nodeCount:graphResult('/wirelessNodeCount')??state.nodes.length, fee:wireless ? Number(graphResult('/wirelessTotalFee')??0) : 0, documents:docs };
};

const documentCatalog = [
  {label:'Authorized agent form',scope:'/authorizedAgentFormScope',attached:'/authorizedAgentFormAttached',reason:'/authorizedAgentFormReason',consumers:{utility:'/authorizedAgentFormRequiredByUtility',wireless:'/authorizedAgentFormRequiredByWireless',entrance:'/authorizedAgentFormRequiredByEntrance'}},
  {label:'Master Limited Use & Occupancy Agreement (MLUOA)',scope:'/mlUoaScope',attached:'/mlUoaAttached',reason:'/mlUoaReason',consumers:{wireless:'/mlUoaRequiredByWireless'}},
  {label:'Drawing / construction plans',scope:'/utilityDocumentScope',attached:'/utilityDrawingAttached',reason:'/utilityDrawingReason',consumers:{utility:'/utilityDrawingRequiredByUtility'}},
  {label:'Use & Occupancy Agreement',scope:'/utilityDocumentScope',attached:'/utilityOccupancyAgreementAttached',reason:'/utilityOccupancyAgreementReason',consumers:{utility:'/utilityOccupancyAgreementRequiredByUtility'}},
  {label:'Traffic Control Plan',scope:'/utilityDocumentScope',attached:'/utilityTrafficControlPlanAttached',reason:'/utilityTrafficControlPlanReason',consumers:{utility:'/utilityTrafficControlPlanRequiredByUtility'}},
  {label:'Pole foundation designs',scope:'/utilityDocumentScope',attached:'/utilityFoundationDesignAttached',reason:'/utilityFoundationDesignReason',consumers:{utility:'/utilityFoundationDesignRequiredByUtility'}},
  {label:'Casing specifications',scope:'/utilityDocumentScope',attached:'/utilityCasingSpecificationsAttached',reason:'/utilityCasingSpecificationsReason',consumers:{utility:'/utilityCasingSpecificationsRequiredByUtility'}},
  {label:'Airport Zone Notification Form',scope:'/utilityDocumentScope',attached:'/utilityAirportFormAttached',reason:'/utilityAirportFormReason',consumers:{utility:'/utilityAirportFormRequiredByUtility'}},
  {label:'Railroad company approval',scope:'/utilityDocumentScope',attached:'/utilityRailroadApprovalAttached',reason:'/utilityRailroadApprovalReason',consumers:{utility:'/utilityRailroadApprovalRequiredByUtility'}},
  {label:'Railroad proximity review information',scope:'/utilityDocumentScope',attached:'/utilityRailroadProximityReviewAttached',reason:'/utilityRailroadProximityReason',consumers:{utility:'/utilityRailroadProximityReviewRequiredByUtility'}},
  {label:'Planning and zoning approval',scope:'/entranceDocumentScope',attached:'/entrancePlanningApprovalAttached',reason:'/entrancePlanningApprovalReason',consumers:{entrance:'/entrancePlanningApprovalRequiredByEntrance'}},
  {label:'Proof of property ownership',scope:'/entranceDocumentScope',attached:'/entranceOwnershipAttached',reason:'/entranceOwnershipReason',consumers:{entrance:'/entranceOwnershipRequiredByEntrance'}},
  {label:'Recorded plan or subdivision plan',scope:'/entranceDocumentScope',attached:'/entranceRecordedPlanAttached',reason:'/entranceRecordedPlanReason',consumers:{entrance:'/entranceRecordedPlanRequiredByEntrance'}},
  {label:'Entrance construction plan',scope:'/entranceDocumentScope',attached:'/entranceConstructionPlanAttached',reason:'/entranceConstructionPlanReason',consumers:{entrance:'/entranceConstructionPlanRequiredByEntrance'}},
  {label:'Construction cost estimate',scope:'/entranceDocumentScope',attached:'/entranceCostEstimateAttached',reason:'/entranceCostEstimateReason',consumers:{entrance:'/entranceCostEstimateRequiredByEntrance'}},
  {label:'Construction schedule',scope:'/entranceDocumentScope',attached:'/entranceScheduleAttached',reason:'/entranceScheduleReason',consumers:{entrance:'/entranceScheduleRequiredByEntrance'}},
  {label:'Traffic Operational Analysis',scope:'/entranceDocumentScope',attached:'/entranceTrafficAnalysisAttached',reason:'/entranceTrafficAnalysisReason',consumers:{entrance:'/entranceTrafficAnalysisRequiredByEntrance'}},
  {label:'Pedestrian access evidence',scope:'/entranceDocumentScope',attached:'/entrancePedestrianEvidenceAttached',reason:'/entrancePedestrianEvidenceReason',consumers:{entrance:'/entrancePedestrianEvidenceRequiredByEntrance'}}
];
const nodeDocumentCatalog=[
  {label:'Construction plan set',required:'constructionPlanRequired',attached:'constructionPlanAttached',reason:'constructionPlanReason'},
  {label:'Support structure owner consent',required:'supportOwnerConsentRequired',attached:'supportOwnerConsentAttached',reason:'supportOwnerConsentReason'},
  {label:'DelDOT attachment agreement',required:'delDotAttachmentAgreementRequired',attached:'delDotAttachmentAgreementAttached',reason:'delDotAttachmentAgreementReason'},
  {label:'Structural calculations',required:'structuralCalculationsRequired',attached:'structuralCalculationsAttached',reason:'structuralCalculationsReason'},
  {label:'Written Request to Remove DelDOT Structure',required:'writtenRemovalRequestRequired',attached:'writtenRemovalRequestAttached',reason:'writtenRemovalRequestReason'},
  {label:'Pole foundation designs',required:'foundationDesignRequired',attached:'foundationDesignAttached',reason:'foundationDesignReason'},
  {label:'Arc Flash Hazard Analysis',required:'arcFlashAnalysisRequired',attached:'arcFlashAnalysisAttached',reason:'arcFlashAnalysisReason'},
  {label:'Casing specifications',required:'casingSpecificationsRequired',attached:'casingSpecificationsAttached',reason:'casingSpecificationsReason'},
  {label:'Airport Zone Notification Form',required:'airportFormRequired',attached:'airportFormAttached',reason:'airportFormReason'},
  {label:'Railroad company approval',required:'railroadApprovalRequired',attached:'railroadApprovalAttached',reason:'railroadApprovalReason'},
  {label:'Railroad proximity review information',required:'railroadProximityReviewRequired',attached:'railroadProximityReviewAttached',reason:'railroadProximityReason'},
  {label:'Traffic Control Plan',required:'requiresTrafficControlPlan',attached:'trafficControlPlanAttached',reason:'trafficControlPlanReason'}
];
function graphDocumentRecords(){
  const records=documentCatalog.map(definition=>{
    const requiredBy=Object.entries(definition.consumers).filter(([,path])=>graphBoolean(path)).map(([permit])=>permit);
    const scope=graphResult(definition.scope);
    return {...definition,scope,requiredBy,key:scope==='project'?`project:${definition.label}`:`${requiredBy[0]}:application:${definition.label}`};
  }).filter(record=>record.requiredBy.length);
  if(hasWireless()) state.nodes.forEach((node,index)=>nodeDocumentCatalog.filter(document=>graphBoolean(`/sites/#${node.id}/${document.required}`)).forEach(document=>records.push({label:document.label,scope:graphResult(`/sites/#${node.id}/wirelessDocumentScope`),requiredBy:['wireless'],node,index,key:`wireless:${node.id}:${document.label}`,attached:`/sites/#${node.id}/${document.attached}`,reason:`/sites/#${node.id}/${document.reason}`,triggerPaths:[`/sites/#${node.id}/${document.required}`]})));
  return records;
}
rebuildGraph();

function utilityTrafficControlPlanRequired(){
  const result=graphResult('/utilityRequiresTrafficControlPlan');
  return result===null?null:Boolean(result);
}

const requirement = (path,label,satisfied,stage,reason='Required to submit') => ({path,label,satisfied:Boolean(satisfied),stage,reason});
function validationFacts(){
  const f=facts(), u=state.utility;
  const requirements=[
    requirement('/atLeastOneActivitySelected','Select at least one project activity',hasAnyActivity(),routeStep('activities')),
    requirement('/utilitySubtypeSelectionValid','Select at least one type of utility work',graphBoolean('/utilitySubtypeSelectionValid'),routeStep('utilityKind')),
    requirement('/contactCompany','Enter the company name',hasValue(graphResult('/contactCompany')),routeStep('contact')),
    requirement('/contactFirstName','Enter the contact first name',hasValue(graphResult('/contactFirstName')),routeStep('contact')),
    requirement('/contactLastName','Enter the contact last name',hasValue(graphResult('/contactLastName')),routeStep('contact')),
    requirement('/contactEmail','Enter a valid email address',hasValue(graphResult('/contactEmail')),routeStep('contact'),'Validated by the graph email limit'),
    requirement('/contactPhone','Enter the contact phone number',hasValue(graphResult('/contactPhone')),routeStep('contact')),
    requirement('/contactFilerType','Choose who is filing',hasValue(graphResult('/contactFilerType')),routeStep('contact')),
    requirement('/projectName','Enter a project name',hasValue(graphResult('/projectName')),routeStep('project'))
  ];
  if(hasWireless()){
    requirements.push(requirement('/requestedWirelessNodeCount','Enter a node count from 1 to 50',hasValue(graphResult('/requestedWirelessNodeCount')),routeStep('project'),'Validated by graph limits; each node requires a separate permit and $100 fee'));
    state.nodes.forEach((n,index)=>{
      const location=nodeLocation(n);
      const prefix=`/sites/#${n.id}`;
      const overviewStage=index===state.currentNode?routeStep('wirelessOverview'):null;
      const constructionStage=index===state.currentNode?routeStep('wirelessConstruction'):null;
      requirements.push(
        requirement(`${prefix}/siteId`,`Node ${index+1}: enter the carrier site ID`,hasValue(graphResult(`${prefix}/siteId`)),overviewStage),
        requirement(`${prefix}/usesProjectSiteLocation`,`Node ${index+1}: choose whether it uses the project site`,!hasSharedProjectSite()||hasValue(n.locationRelationship),overviewStage),
        requirement(`${prefix}/address`,`Node ${index+1}: enter the address or cross-streets`,hasValue(graphResult(`${prefix}/address`)),overviewStage),
        requirement(`${prefix}/latitude`,`Node ${index+1}: enter the latitude`,hasValue(graphResult(`${prefix}/latitude`)),overviewStage),
        requirement(`${prefix}/longitude`,`Node ${index+1}: enter the longitude`,hasValue(graphResult(`${prefix}/longitude`)),overviewStage),
        requirement(`${prefix}/county`,`Node ${index+1}: enter the county`,hasValue(graphResult(`${prefix}/county`)),overviewStage),
        requirement(`${prefix}/scope`,`Node ${index+1}: choose the scope`,hasValue(graphResult(`${prefix}/scope`)),overviewStage),
        requirement(`${prefix}/structureWork`,`Node ${index+1}: choose the structure work`,hasValue(graphResult(`${prefix}/structureWork`)),overviewStage),
        requirement(`${prefix}/sizeEligible`,`Node ${index+1}: enter qualifying equipment volumes`,graphBoolean(`${prefix}/sizeEligible`),overviewStage,'Derived small-wireless size qualification'),
        requirement(`${prefix}/poleHeight`,`Node ${index+1}: enter the pole height`,hasValue(graphResult(`${prefix}/poleHeight`)),overviewStage),
        requirement(`${prefix}/heightEligible`,`Node ${index+1}: enter an eligible facility height`,graphBoolean(`${prefix}/heightEligible`),overviewStage,'Derived statutory height qualification'),
        requirement(`${prefix}/poleOwner`,`Node ${index+1}: choose the structure owner`,hasValue(graphResult(`${prefix}/poleOwner`)),constructionStage),
        requirement(`${prefix}/undergroundOwnerRequirementSatisfied`,`Node ${index+1}: enter the underground facility owner’s member ID`,graphBoolean(`${prefix}/undergroundOwnerRequirementSatisfied`),constructionStage,'Derived when underground facilities are proposed'),
        requirement(`${prefix}/typicalApplicationCount`,`Node ${index+1}: enter the number of Typical Applications`,hasValue(graphResult(`${prefix}/typicalApplicationCount`)),constructionStage)
      );
    });
  }
  if(hasGeneralUtility()||hasEntrance()) requirements.push(
    requirement(`/sites/#${u.id}/address`,'Enter the work address or nearest cross-streets',hasValue(graphResult(`/sites/#${u.id}/address`)),routeStep('site')),
    requirement(`/sites/#${u.id}/latitude`,'Enter the work latitude',hasValue(graphResult(`/sites/#${u.id}/latitude`)),routeStep('site')),
    requirement(`/sites/#${u.id}/longitude`,'Enter the work longitude',hasValue(graphResult(`/sites/#${u.id}/longitude`)),routeStep('site')),
    requirement(`/sites/#${u.id}/county`,'Enter the work county',hasValue(graphResult(`/sites/#${u.id}/county`)),routeStep('site'))
  );
  if(hasGeneralUtility()){
    requirements.push(
      requirement('/utilityIsPublic','Choose whether this is a public utility',hasValue(graphResult('/utilityIsPublic')),routeStep('utility')),
      requirement('/utilityType','Choose the utility type',hasValue(graphResult('/utilityType')),routeStep('utility')),
      requirement('/utilityIsEmergency','Choose whether this is emergency work',hasValue(graphResult('/utilityIsEmergency')),routeStep('utility')),
      requirement('/utilityJurisdiction','Choose where the work will occur',hasValue(graphResult('/utilityJurisdiction')),routeStep('utility')),
      requirement('/utilityGroundDisturbanceSqFt','Enter ground disturbance, including 0',hasValue(graphResult('/utilityGroundDisturbanceSqFt')),routeStep('utility')),
      requirement('/utilityTrafficImpact','Choose the traffic impact',hasValue(graphResult('/utilityTrafficImpact')),routeStep('utility')),
      requirement('/utilityDuration','Choose the work duration',hasValue(graphResult('/utilityDuration')),routeStep('utility')),
      requirement('/utilityPermitEligible','Answers must produce a DelDOT permit',graphBoolean('/utilityPermitEligible'),routeStep('utility'),'Derived from the current application and GIS facts'),
      requirement('/utilityWorkType','Choose the scope of work',hasValue(graphResult('/utilityWorkType')),routeStep('utility')),
      requirement('/utilityWorkDescription','Describe the proposed work',hasValue(graphResult('/utilityWorkDescription')),routeStep('utility')),
      requirement(`/sites/#${u.id}/undergroundOwnerRequirementSatisfied`,'Enter the underground facility owner’s member ID',graphBoolean(`/sites/#${u.id}/undergroundOwnerRequirementSatisfied`),routeStep('utility'),'Derived when underground facilities are proposed'),
      requirement(`/sites/#${u.id}/typicalApplicationCount`,'Enter the number of Typical Applications',hasValue(graphResult(`/sites/#${u.id}/typicalApplicationCount`)),routeStep('utility'))
    );
  }
    if(hasEntrance()){
      const e=state.entrance;
      requirements.push(
        requirement('/entranceType','Choose the entrance type',hasValue(graphResult('/entranceType')),routeStep('entrance')),
        requirement('/entranceWorkType','Choose the entrance work',hasValue(graphResult('/entranceWorkType')),routeStep('entrance')),
        requirement('/entrancePlanningApprovalReceived','Answer whether planning approval was received',hasValue(graphResult('/entrancePlanningApprovalReceived')),routeStep('entrance')),
        requirement('/entranceExistingAdtEntering','Enter daily traffic entering, including 0',hasValue(graphResult('/entranceExistingAdtEntering')),routeStep('entrance')),
        requirement('/entranceExistingAdtExiting','Enter daily traffic exiting, including 0',hasValue(graphResult('/entranceExistingAdtExiting')),routeStep('entrance')),
        requirement('/entrancePeakHourTrips','Enter peak-hour trips, including 0',hasValue(graphResult('/entrancePeakHourTrips')),routeStep('entrance')),
        requirement('/entrancePriorUse','Enter the prior property use',hasValue(graphResult('/entrancePriorUse')),routeStep('entrance')),
        requirement('/entranceProposedUse','Enter the proposed property use',hasValue(graphResult('/entranceProposedUse')),routeStep('entrance')),
        requirement('/entranceStakesDate','Enter the date entrance stakes will be set',hasValue(graphResult('/entranceStakesDate')),routeStep('entrance')),
        requirement('/entranceTaxParcelId','Enter the tax parcel ID',hasValue(graphResult('/entranceTaxParcelId')),routeStep('entrance'))
      );
    }
  graphDocumentRecords().forEach(record=>{
    const stage=record.scope==='node'&&record.index!==state.currentNode?null:record.scope==='project'&&hasWireless()&&state.currentNode>0?null:documentStep();
    requirements.push(requirement(record.attached,`Attach ${record.label}`,graphBoolean(record.attached),stage,graphResult(record.reason)||'Required by the current fact graph'));
  });
  requirements.push(requirement('/attestationsAccepted','Accept all applicable attestations',state.attestationAccepted,reviewStep()));
  const substantive=requirements.filter(r=>r.path!=='/attestationsAccepted');
  const utilityRequirements=substantive.filter(r=>r.path.startsWith('/utility'));
  const wirelessRequirements=substantive.filter(r=>r.path.startsWith('/sites')&&!r.path.includes('/common/'));
  const utilityBranchSatisfied=!hasGeneralUtility()||utilityRequirements.every(r=>r.satisfied);
  const wirelessBranchSatisfied=!hasWireless()||wirelessRequirements.every(r=>r.satisfied);
  const applicationComplete=graphBoolean('/applicationComplete');
  const readyToSubmit=graphBoolean('/readyToSubmit');
  return {requirements,currentRequirements:requirements.filter(r=>r.stage===step),utilityBranchSatisfied,wirelessBranchSatisfied,applicationComplete,readyToSubmit};
}

const field = (label,name,value='',type='text',extra='') => `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeAttribute(value ?? '')}" ${extra}></div>`;
const radio = (name,value,label,description,current) => `<label class="choice"><input type="radio" name="${name}" value="${value}" ${current===value?'checked':''}><strong>${label}</strong><small>${description}</small></label>`;
const activityChoice = (name,label,description,checked) => `<label class="choice"><input type="checkbox" name="${name}" ${checked?'checked':''}><strong>${label}</strong><small>${description}</small></label>`;
const checkbox = (name,label,checked=false) => name==='airport'?'':`<label class="check"><input type="checkbox" name="${name}" ${checked?'checked':''}>${label}</label>`;
const select = (label,name,options,current) => `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}"><option value="">Select one</option>${options.map(([v,l])=>`<option value="${v}" ${current===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
const intro = (eyebrow,title,lede) => `<p class="eyebrow">${eyebrow}</p><h2>${title}</h2><p class="lede">${lede}</p>`;

function routeIds(){ return ['activities',...(hasUtilityActivity()?['utilityKind']:[]),'contact','project',...(hasGeneralUtility()||hasEntrance()?['site']:[]),...(hasEntrance()?['entrance']:[]),...(hasGeneralUtility()?['utility']:[]),...(hasWireless()?['wirelessOverview','wirelessConstruction']:[]),'documents','review']; }
const currentRoute = () => routeIds()[step];
const routeStep = id => routeIds().indexOf(id);
const documentStep = () => routeStep('documents');
const reviewStep = () => routeStep('review');
function startScreen(){ return intro('Project activities','What work are you planning?','Select all broad activities included in the project. We will ask follow-up questions to determine the permit or permits needed.') + `<div class="choice-grid">${activityChoice('utilityActivity','Build or maintain a utility','Install, construct, maintain, repair, or modify utility infrastructure.',hasUtilityActivity())}${activityChoice('entrance','Create or modify an entrance','Construct, modify, or relocate a commercial, subdivision, industrial, or solar-farm entrance.',hasEntrance())}</div><p class="hint">Select both when the same project includes utility and entrance work.</p>`; }
function utilityKindScreen(){ return intro('Utility activity','What types of utility work are included?','Select every type included in the project. A project can include both.') + `<div class="choice-grid">${activityChoice('smallWireless','Small wireless facilities','One or more antenna nodes and associated equipment.',hasWireless())}${activityChoice('otherUtility','Water, sewer, gas, power, telephone, cable, or fiber','Install, construct, maintain, repair, or modify any of these utilities.',hasGeneralUtility())}</div><p class="hint">These answers describe the work. The graph will determine the specific permits required.</p>`; }
function contactScreen(){ return intro('Contact','Who is responsible for this project?','This information is shared across every application record produced for the project.') + `<div class="field-grid">${field('Company name','company',state.contact.company)}${field('Project contact email','email',state.contact.email,'email')}${field('First name','firstName',state.contact.firstName)}${field('Last name','lastName',state.contact.lastName)}${field('Phone','phone',state.contact.phone,'tel')}<div class="field">${select('Who is filing?','filer',enumChoices('/contactFilerTypeOptions'),state.contact.filer)}</div></div>`; }
function projectScreen(){ return intro('Project','Tell us about your project','Give the overall project a name. Permit records derived later will remain linked to this project.') + `<div class="field-grid">${field('Project name','projectName',state.projectName)}${hasWireless()?field('How many small wireless nodes are included?','requestedNodeCount',state.requestedNodeCount,'number','min="1" max="50"'):''}</div>` + (hasWireless()&&state.requestedNodeCount?`<div class="notice"><strong>${state.requestedNodeCount} wireless node${Number(state.requestedNodeCount)===1?'':'s'} · ${money.format(Number(state.requestedNodeCount)*100)}</strong><br>Each node is evaluated independently.</div>`:''); }
function renderCurrentScreen(){ return ({activities:startScreen,utilityKind:utilityKindScreen,contact:contactScreen,project:projectScreen,site:siteLocationScreen,utility:otherUtilityDetailsScreen,wirelessOverview:wirelessOverviewScreen,wirelessConstruction,entrance:entranceDetails,documents:documentsScreen,review:reviewScreenApplicant})[currentRoute()](); }

function siteLocationScreen(){
  const u=state.utility;
  const siteName=hasEntrance()&&hasGeneralUtility()?'Entrance and other utility work site':hasEntrance()?'Entrance site':'Other utility work site';
  const title=hasEntrance()&&hasGeneralUtility()?'Where will the entrance and other utility work occur?':hasEntrance()?'Where will the entrance be located?':'Where will this utility work occur?';
  const help=hasWireless()?'This is not automatically a wireless-node location. For each node, you can reuse this complete location or provide a different one.':'GIS facts for this location can affect permit requirements.';
  return intro(siteName,title,help)+`<div class="field-grid">${field('Address or nearest cross-streets','address',u.address)}${field('County','county',u.county)}${field('Latitude','latitude',u.latitude,'number','step="any"')}${field('Longitude','longitude',u.longitude,'number','step="any"')}</div>`;
}

function otherUtilityDetailsScreen(){
  const u=state.utility;
  const permitQuestions=`<div class="field-grid">${select('Public utility?','publicUtility',[['yes','Yes'],['no','No — private / unfranchised']],u.publicUtility)}${select('Utility type','utilityType',enumChoices('/utilityTypeOptions'),u.utilityType)}${select('Where will this work occur?','jurisdiction',enumChoices('/utilityJurisdictionOptions').map(([v,l])=>[v,v==='none'?'None of these':l]),u.jurisdiction)}${select('Was this work performed as an emergency?','emergency',[['no','No'],['yes','Yes']],u.emergency)}${field('Ground disturbance (sq. ft.)','disturbance',u.disturbance,'number','min="0"')}${select('Traffic impact','trafficImpact',enumChoices('/utilityTrafficImpactOptions'),u.trafficImpact)}${select('Total duration','duration',enumChoices('/utilityDurationOptions'),u.duration)}</div>`;
  const workQuestions=`${select('Scope of work','workType',enumChoices('/utilityWorkTypeOptions'),u.workType)}<div class="field"><label>Describe the proposed work</label><textarea name="description">${escapeHtml(u.description)}</textarea></div><fieldset><legend>Construction elements</legend>${checkbox('foundations','New pole / support structure foundations',u.foundations)}${checkbox('underground','Underground service feeds or conduit runs',u.underground)}${u.underground?field('Underground facility owner’s Delmarva 811 member ID','undergroundOwnerMemberId',u.undergroundOwnerMemberId):''}${checkbox('pavement','Pavement disturbance in travel lanes or shoulders',u.pavement)}${checkbox('electrical','New electrical components',u.electrical)}${checkbox('casing','Casing',u.casing)}</fieldset><fieldset><legend>Location-sensitive work</legend>${checkbox('railroad','Crossing over or under a railroad',u.railroad)}</fieldset><fieldset><legend>Traffic-control conditions</legend>${checkbox('detour','Work requires a detour of roadway traffic',u.detour)}${checkbox('complexConditions','Field conditions are complicated by a bridge, sharp curve, sight distance, or atypical geometry',u.complexConditions)}${checkbox('pedestrianImpact','Work substantially impacts an established pedestrian access route',u.pedestrianImpact)}${checkbox('travelLaneOccupation','Work is performed over a travel lane, turn lane, or bike lane',u.travelLaneOccupation)}</fieldset>${field('Number of DE MUTCD Typical Applications','taCount',u.taCount,'number','min="0" max="56"')}`;
  return intro('Other utility work','Tell us about the water, sewer, gas, power, telephone, cable, or fiber work','These answers determine whether the work requires a Construction, Safety, or After-the-Fact Emergency permit.')+permitQuestions+workQuestions;
}

function wirelessOverviewScreen(){
  let n=state.nodes[state.currentNode];
  if(!n){ state.nodes.push(emptyNode(1)); n=state.nodes[0]; }
  const canReuse=hasSharedProjectSite();
  const previousLocation=state.utility.address||'the entrance/other utility work site';
  const locationChoice=canReuse?select(`Is this node at ${previousLocation}?`,'locationRelationship',[['shared','Yes — reuse that complete location'],['different','No — this node is somewhere else']],n.locationRelationship):'';
  const locationFields=!canReuse||n.locationRelationship==='different'?`${field('Address or nearest cross-streets','address',n.address)}${field('Latitude','latitude',n.latitude,'number','step="any"')}${field('Longitude','longitude',n.longitude,'number','step="any"')}${field('County','county',n.county)}`:n.locationRelationship==='shared'?`<div class="notice"><strong>Location reused</strong><br>${escapeHtml(state.utility.address||'Address not entered')} · ${escapeHtml(state.utility.county||'County not entered')} · ${escapeHtml(state.utility.latitude||'Latitude not entered')}, ${escapeHtml(state.utility.longitude||'Longitude not entered')}<br><span class="hint">The node also uses this location’s GIS results.</span></div>`:'';
  return intro('Node overview',`Node ${state.currentNode+1} of ${state.nodes.length}`,'Provide the equipment and support structure information for this node. Another location is collected only when this node is somewhere else.')+nodeProgress()+`<div class="field-grid">${field('Carrier site ID','siteId',n.siteId)}${locationChoice}${locationFields}${select('Scope','scope',enumChoices('/siteScopeOptions'),n.scope)}${select('Structure work','structureWork',enumChoices('/siteStructureWorkOptions').map(([v,l])=>[v,v==='new'?'New stand-alone pole':l]),n.structureWork)}${field('Largest antenna volume (cu. ft.)','antennaVolume',n.antennaVolume,'number','min="0" step="0.1"')}${field('Other equipment total (cu. ft.)','equipmentVolume',n.equipmentVolume,'number','min="0" step="0.1"')}${field('Pole / structure height (ft.)','poleHeight',n.poleHeight,'number','min="0" step="0.1"')}${field('Highest facility elevation (ft.)','facilityHeight',n.facilityHeight,'number','min="0" step="0.1"')}</div>`;
}

function entranceDetails(){ const e=state.entrance; const outcomes=[hasGeneralUtility()?facts().permitType:'',hasWireless()?`${state.nodes.length} small wireless permit${state.nodes.length===1?'':'s'}`:'','Entrance Permit'].filter(Boolean); return intro('Entrance activity','Tell us about the proposed entrance','These answers are evaluated with the shared project, site, GIS, construction-impact, and applicant facts already supplied.') + `<div class="permit-package-banner"><strong>Permits identified for this project</strong><span>${outcomes.join(' + ')}</span></div><div class="field-grid">${select('Entrance type','type',enumChoices('/entranceTypeOptions'),e.type)}${select('Entrance work','entranceWorkType',enumChoices('/entranceWorkTypeOptions').map(([v,l])=>[v,v==='new'?'Construct a new entrance':v==='modify'?'Modify an existing entrance':l]),e.workType)}${select('Planning and zoning approval received?','planningApproval',[['yes','Yes'],['no','No']],e.planningApproval)}${field('Tax parcel ID','taxParcelId',e.taxParcelId)}${field('Existing daily traffic entering','adtEntering',e.adtEntering,'number','min="0"')}${field('Existing daily traffic exiting','adtExiting',e.adtExiting,'number','min="0"')}${field('Peak-hour trips','peakHourTrips',e.peakHourTrips,'number','min="0"')}${field('Date entrance stakes will be set','stakesDate',e.stakesDate,'date')}${field('Prior property use','priorUse',e.priorUse)}${field('Proposed property use','proposedUse',e.proposedUse)}</div>`; }
function nodeProgress(){ return `<div class="node-bar"><span>${state.nodes.map((n,i)=>`<span class="pill ${i===state.currentNode?'current':''}">${i+1}${n.siteId?` · ${escapeHtml(n.siteId)}`:''}</span>`).join(' ')}</span><strong>${money.format(state.nodes.length*100)}</strong></div>`; }
function wirelessConstruction(){ const n=state.nodes[state.currentNode]; return intro('Construction',`Construction for Node ${state.currentNode+1}`,'Tell us about the structure, construction activities, nearby sensitive areas, and planned traffic control.') + nodeProgress() + `${select('Pole / support structure owner','poleOwner',enumChoices('/sitePoleOwnerOptions'),n.poleOwner)}<fieldset><legend>Construction elements</legend>${checkbox('foundations','New pole / support structure foundations',n.foundations)}${checkbox('underground','Underground service feeds or conduit runs',n.underground)}${n.underground?field('Underground facility owner’s Delmarva 811 member ID','undergroundOwnerMemberId',n.undergroundOwnerMemberId):''}${checkbox('pavement','Pavement disturbance in travel lanes or shoulders',n.pavement)}${checkbox('electrical','New electrical components',n.electrical)}${checkbox('casing','Casing',n.casing)}</fieldset><fieldset><legend>Sensitive areas</legend>${checkbox('airport','Airport airspace',n.airport)}${checkbox('railroad','Crossing over or under a railroad',n.railroad)}</fieldset><fieldset><legend>Traffic-control conditions</legend>${checkbox('detour','Work requires a detour of roadway traffic',n.detour)}${checkbox('complexConditions','Field conditions are complicated by a bridge, sharp curve, sight distance, or atypical geometry',n.complexConditions)}${checkbox('pedestrianImpact','Work substantially impacts an established pedestrian access route',n.pedestrianImpact)}${checkbox('travelLaneOccupation','Work is performed over a travel lane, turn lane, or bike lane',n.travelLaneOccupation)}</fieldset>${field('Number of DE MUTCD Typical Applications','taCount',n.taCount,'number','min="0" max="56"')}`; }
function documentKey(name){ return `utility:application:${name}`; }
const permitNameFor = permit => permit==='utility'?(facts().permitType==='Not determined'?'Permit determination pending':facts().permitType):permit==='wireless'?'Small Wireless Facility Permit':'Entrance Permit';
function documentInputs(records){ return `<ul class="documents">${records.map(record=>{const consumers=record.requiredBy.map(permitNameFor).join(' · '); const reason=graphResult(record.reason); const triggerPaths=record.triggerPaths||Object.values(record.consumers||{}).filter(path=>graphBoolean(path)); const triggers=triggerPaths.join(' · '); const trace=triggerPaths.map(path=>`${path}: ${graphExplanation(path)}`).join(' | '); return `<li><strong>${record.label}</strong><span class="document-consumers">Required for ${consumers}</span>${reason?`<span class="document-reason">Why required: ${reason}</span>`:''}${triggers?`<details class="document-trace"><summary>View graph trace</summary><code>${escapeHtml(trace)}</code></details>`:''}<input type="file" data-document-key="${record.key}" aria-label="Upload ${record.label}">${state.documentComplete[record.key]?'<span class="hint">Attached</span>':''}</li>`;}).join('')}</ul>`; }
function documentsScreen(){ const records=graphDocumentRecords(); const sections=[]; const projectRecords=records.filter(record=>record.scope==='project'); const utilityRecords=records.filter(record=>record.scope==='permit'&&record.requiredBy.includes('utility')); const entranceRecords=records.filter(record=>record.scope==='permit'&&record.requiredBy.includes('entrance')); const nodeRecords=records.filter(record=>record.scope==='node'&&record.index===state.currentNode);
  if(hasWireless()) sections.push(nodeProgress()+`<p class="hint">You are completing documents for Node ${state.currentNode+1} of ${state.nodes.length}.${state.currentNode<state.nodes.length-1?` Node ${state.currentNode+2} documents come next.`:''}</p>`);
  if(projectRecords.length&&(!hasWireless()||state.currentNode===0)) sections.push(`<h3>Shared project documents</h3><p class="hint">Each document is uploaded once and applied to every permit listed below.</p>${documentInputs(projectRecords)}`);
  if(utilityRecords.length) sections.push(`<h3>${facts().permitType} documents</h3>${documentInputs(utilityRecords)}`);
  if(entranceRecords.length) sections.push(`<h3>Entrance permit documents</h3>${documentInputs(entranceRecords)}`);
  if(nodeRecords.length) sections.push(`<h3>Small wireless · Node ${state.currentNode+1}</h3>${documentInputs(nodeRecords)}`);
  return intro('Documents','Documents required for this project','Each requirement and explanation below comes from the current fact graph. Shared documents are uploaded only once.')+sections.join(''); }
function nextStepsPanel(){
  const steps=[];
  if(graphBoolean('/entrancePreSubmittalMeetingRequired')) steps.push('<strong>Meet with DelDOT before final review.</strong> DelDOT will contact you to arrange a pre-submittal meeting based on the traffic generated by the proposed entrance.');
  if(graphBoolean('/crossPermitCoordinationRequired')) steps.push('<strong>Coordinated permit review.</strong> DelDOT will review the entrance and underground utility work together because they affect the same project site.');
  if(graphBoolean('/anySiteGisSpecialReviewRequired')) steps.push('<strong>Limited-access roadway review.</strong> The mapped location requires an additional roadway review. DelDOT may request design changes or supporting information.');
  if(graphBoolean('/anySiteAirportFormRequired')) steps.push('<strong>Airport-area review.</strong> The project will be reviewed for airport-airspace considerations using the documentation you provided.');
  if(graphBoolean('/anySiteRailroadApprovalRequired')||graphBoolean('/anySiteRailroadProximityReviewRequired')) steps.push('<strong>Railroad coordination.</strong> DelDOT will evaluate the crossing or nearby railroad as part of its review.');
  if(hasGeneralUtility()&&state.utility.emergency==='yes') steps.push('<strong>After-the-fact emergency review.</strong> DelDOT will review the completed emergency work and may contact you about restoration or follow-up requirements.');
  if(!steps.length) steps.push('<strong>Standard technical review.</strong> DelDOT will review the submitted plans and contact you if clarification or revisions are needed.');
  return `<section class="next-steps"><h3>What happens next</h3><ol>${steps.map(step=>`<li>${step}</li>`).join('')}</ol></section>`;
}
function reviewScreen(){ const f=facts(); const validity=validationFacts(); const ready=validity.readyToSubmit; const onlyAttestationMissing=validity.applicationComplete&&!state.attestationAccepted; const nodeRows=hasWireless()?state.nodes.map((n,i)=>{const eligible=graphResult(`/sites/#${n.id}/permitEligible`);return `<div class="review-card"><h3>Node ${i+1}: ${escapeHtml(n.siteId||'Unnamed')}</h3><dl><dt>Location</dt><dd>${escapeHtml(n.address||'—')}</dd><dt>Eligibility</dt><dd>${eligible===true?'Eligible':eligible===false?'Does not qualify':'Not determined'}</dd><dt>Fee</dt><dd>$100.00</dd></dl></div>`;}).join(''):''; const permits=[hasGeneralUtility()?`<dt>Utility permit</dt><dd>${escapeHtml(f.permitType)}</dd>`:'',hasWireless()?`<dt>Small wireless permits</dt><dd>${state.nodes.length} × ${escapeHtml(f.wirelessPermitType)}</dd>`:'',hasEntrance()?`<dt>Entrance permit</dt><dd>${escapeHtml(f.entrancePermitType)}</dd>`:''].join(''); return intro('Review',activityCount()>1?'Review the permit applications':'Review and submit','Check your information and attachments before submitting.') + `<div class="review-card"><h3>${escapeHtml(state.projectName)}</h3><dl><dt>Applicant</dt><dd>${escapeHtml(state.contact.company)}</dd><dt>Contact</dt><dd>${escapeHtml(state.contact.email)}</dd>${permits}</dl></div>${nodeRows}${nextStepsPanel()}<label class="check"><input type="checkbox" name="attest" ${state.attestationAccepted?'checked':''}>I have reviewed the application and agree to all applicable attestations.</label><div class="result ${ready?'':'blocked'}"><strong>${ready?'Ready to submit':onlyAttestationMissing?'Review and accept the attestation':'Complete the remaining requirements'}</strong><p>${ready?(activityCount()>1?'All derived permit applications will be submitted together as one project.':hasWireless()?`${state.nodes.length} node application${state.nodes.length===1?'':'s'} will be submitted together after payment.`:'The application is ready for submission.'):onlyAttestationMissing?'Confirm that you reviewed the application, then select the checkbox above.':'Review the application for missing answers, documents, or agreements before submitting.'}</p></div>`; }
function reviewScreenApplicant(){ return reviewScreen().replace('<dt>Utility permit</dt>','<dt>Required permit</dt>'); }

function bindValues(form){ const data=new FormData(form); const route=currentRoute();
  if(route==='activities'){ state.activities.utility=data.has('utilityActivity'); state.activities.entrance=data.has('entrance'); if(!state.activities.utility){ state.activities.utilitySubtype=''; state.activities.generalUtility=false; state.activities.smallWireless=false; } syncLegacyApplicationType(); }
  if(route==='utilityKind'){ state.activities.generalUtility=data.has('otherUtility'); state.activities.smallWireless=data.has('smallWireless'); state.activities.utilitySubtype=state.activities.generalUtility&&state.activities.smallWireless?'both':state.activities.smallWireless?'wireless':state.activities.generalUtility?'other':''; syncLegacyApplicationType(); }
  if(route==='contact') Object.assign(state.contact,Object.fromEntries(data));
  if(route==='project'){ state.projectName=data.get('projectName')||state.projectName; if(hasWireless()){ state.requestedNodeCount=data.get('requestedNodeCount')||''; const count=Number(state.requestedNodeCount); if(Number.isInteger(count)&&count>=1&&count<=50){ while(state.nodes.length<count) state.nodes.push(emptyNode(state.nodes.length+1)); state.nodes=state.nodes.slice(0,count); state.currentNode=Math.min(state.currentNode,state.nodes.length-1); } } }
  if(route==='site'||route==='utility'){ const target=state.utility; for(const [k,v] of data) target[k]=v; if(route==='utility'){ const checkboxFacts=['foundations','underground','pavement','electrical','casing','railroad','detour','complexConditions','pedestrianImpact','travelLaneOccupation']; checkboxFacts.forEach(k=>target[k]=data.has(k)); } }
  if(route==='wirelessOverview'||route==='wirelessConstruction'){ const target=state.nodes[state.currentNode]; for(const [k,v] of data) target[k]=v; if(route==='wirelessConstruction'){ const checkboxFacts=['foundations','underground','pavement','electrical','casing','railroad','detour','complexConditions','pedestrianImpact','travelLaneOccupation']; checkboxFacts.forEach(k=>target[k]=data.has(k)); } }
  if(route==='entrance'){ const values=Object.fromEntries(data); state.entrance.type=values.type||state.entrance.type; state.entrance.workType=values.entranceWorkType||state.entrance.workType; ['planningApproval','adtEntering','adtExiting','peakHourTrips','priorUse','proposedUse','stakesDate','taxParcelId'].forEach(k=>{ if(values[k]!==undefined) state.entrance[k]=values[k]; }); }
  if(route==='documents') form.querySelectorAll('input[type=file][data-document-key]').forEach(input=>{ if(input.files?.length) state.documentComplete[input.dataset.documentKey]=true; });
  if(route==='review') state.attestationAccepted=data.has('attest'); save(); }
function save(){ rebuildGraph(); localStorage.setItem('deldot-poc',JSON.stringify(state)); }
function render(){ $('#screen').innerHTML=renderCurrentScreen(); $('#back').disabled=step===0; $('#next').textContent=currentRoute()==='documents'&&hasWireless()&&state.currentNode<state.nodes.length-1?`Continue to Node ${state.currentNode+2} documents`:currentRoute()==='review'?(hasWireless()?`Pay ${money.format(facts().fee)} & submit`:activityCount()>1?'Submit permit applications':'Submit application'):'Continue'; $('#application-title').textContent=state.projectName||'New right-of-way application'; renderSummary(); renderGisSettings(); $('#notice').classList.add('hidden'); }
function renderSummary(){
  const f=facts();
  const completedNodes=f.wireless?state.nodes.filter(node=>graphBoolean(`/sites/#${node.id}/requiredAnswersComplete`)):[];
  const records=hasAnyActivity()?graphDocumentRecords():[];
  const projectDocumentCount=records.filter(record=>record.scope==='project').length;
  const nodeDocumentCount=records.filter(record=>record.scope==='node'&&completedNodes.includes(record.node)).length;
  const documentCount=hasAnyActivity()?records.filter(record=>record.scope!=='node'||completedNodes.includes(record.node)).length:null;
  const permits=[];
  if(hasUtilityActivity()&&!hasGeneralUtility()&&!hasWireless()) permits.push({name:'Permit determination pending',required:false,pending:true});
  if(hasGeneralUtility()) permits.push({name:f.permitType,required:f.permitType!=='Not determined'&&!f.permitType.startsWith('No DelDOT'),pending:f.permitType==='Not determined'});
  if(hasWireless()) permits.push({name:hasValue(state.requestedNodeCount)?`${f.nodeCount} × ${f.wirelessPermitType}`:'Small wireless permit determination pending',required:hasValue(state.requestedNodeCount),pending:!hasValue(state.requestedNodeCount)});
  if(hasEntrance()) permits.push({name:f.entrancePermitType,required:f.entrancePermitType!=='Not determined'&&!f.entrancePermitType.startsWith('No DelDOT'),pending:f.entrancePermitType==='Not determined'});
  const requiredPermits=permits.filter(permit=>permit.required);
  const pending=permits.filter(permit=>permit.pending).length;
  const permitList=!hasAnyActivity()?'<li>Select a project activity</li>':requiredPermits.length?requiredPermits.map(permit=>`<li>${permit.name}</li>`).join(''):pending?'<li>Permit determination pending</li>':'<li>No DelDOT permit is required</li>';
  $('#summary').innerHTML=`<p class="summary-section-title">Required permits</p><ul class="summary-permits">${permitList}</ul>${pending&&requiredPermits.length?`<p class="summary-pending">${pending} additional permit determination pending</p>`:''}${f.wireless?`<div class="summary-row"><span>Wireless nodes completed</span><strong>${completedNodes.length}</strong></div>`:''}<div class="summary-row"><span>Required documents</span><strong>${documentCount??'—'}</strong></div><div class="fee">Estimated due <strong>${money.format(f.fee)}</strong></div>`;
  const noFeePermits=[];
  if(hasGeneralUtility()&&f.permitType!=='Not determined'&&!f.permitType.startsWith('No DelDOT')) noFeePermits.push(f.permitType);
  if(hasEntrance()&&f.entrancePermitType==='Entrance Permit') noFeePermits.push('Entrance Permit');
  const noFeeText=noFeePermits.length?`There is no application fee for ${noFeePermits.join(noFeePermits.length>1?' or ':'')}.`:'';
  const wirelessFeeText=hasWireless()?`${money.format(100)} per wireless node × ${f.nodeCount} node${f.nodeCount===1?'':'s'} = <strong>${money.format(f.fee)}</strong>.`:'';
  $('#summary-explanation').innerHTML=`<strong>Application fees:</strong> ${[noFeeText,wirelessFeeText].filter(Boolean).join(' ')||'No fee can be calculated until the required permits are determined.'}<br><br><strong>Documents:</strong> ${documentCount??0} unique required upload${documentCount===1?'':'s'} identified by the graph. Shared documents are counted once.`;
}

const gisSelect=(name,label,value)=>`<label class="gis-field"><span>${label}</span><select data-gis-fact="${name}"><option value="" ${value===''?'selected':''}>Not returned</option><option value="true" ${value==='true'?'selected':''}>Yes</option><option value="false" ${value==='false'?'selected':''}>No</option></select></label>`;
function renderGisSettings(){
  const container=$('#gis-settings');
  const onWirelessRoute=['wirelessOverview','wirelessConstruction','documents'].includes(currentRoute())&&hasWireless();
  const activeNode=onWirelessRoute?state.nodes[state.currentNode]:null;
  const site=activeNode?nodeLocation(activeNode):hasSharedProjectSite()?state.utility:hasWireless()?state.nodes[state.currentNode]:null;
  if(!site){ container.innerHTML=''; container.classList.add('hidden'); return; }
  const gis=site.gis||emptyGis();
  const siteLabel=activeNode?(nodeUsesProjectSite(activeNode)?`Project site · used by Node ${state.currentNode+1}`:`Node ${state.currentNode+1}`):'Project site';
  container.classList.remove('hidden');
  container.innerHTML=`<p class="gis-settings-title">Demo GIS settings</p><p class="gis-settings-site">${siteLabel}</p><p class="hint">Simulate facts returned by an external map service.</p>${gisSelect('stateMaintained','State-maintained road',gis.stateMaintained)}${gisSelect('limitedAccess','Limited-access highway',gis.limitedAccess)}${gisSelect('airportAirspace','Airport airspace',gis.airportAirspace)}${gisSelect('nearRailroad','Near a railroad',gis.nearRailroad)}`;
}

const displayValue=(value,labels={}) => !hasValue(value)?'Unanswered':labels[value]??value;
function graphExplanation(path){
  try{
    const friendlyFactPath=factPath=>{
      const match=factPath.match(/^\/sites\/#([^/]+)(\/.*)?$/);
      if(!match) return factPath;
      const [uuid,suffix]=[match[1],match[2]||''];
      const nodeIndex=state.nodes.findIndex(node=>node.id===uuid);
      if(nodeIndex>=0) return `Node ${nodeIndex+1}${state.nodes[nodeIndex].siteId?` (${state.nodes[nodeIndex].siteId})`:''}${suffix}`;
      if(state.utility.id===uuid) return `Project site${suffix}`;
      return `Site${suffix}`;
    };
    return formatGraphExplanation(graph,path,friendlyFactPath);
  }catch(error){
    console.warn(`Unable to explain fact ${path}`,error);
    return 'Explanation unavailable; inspect the current graph state below.';
  }
}

function visualizerGraph(){
  const f=facts();
  const inputs=[
    {path:'/includesUtilityActivity',label:'Activity · utility work',value:hasAnyActivity()?String(hasUtilityActivity()):'Unanswered'},
    {path:'/includesGeneralUtilityWork',label:'Activity · water/sewer/gas/power/telecom/fiber',value:hasAnyActivity()?String(hasGeneralUtility()):'Unanswered'},
    {path:'/includesSmallWirelessFacilities',label:'Utility subtype · small wireless',value:hasAnyActivity()?String(hasWireless()):'Unanswered'},
    {path:'/includesEntranceWork',label:'Activity · entrance work',value:hasAnyActivity()?String(hasEntrance()):'Unanswered'},
    {path:'/projectName',label:'Project',value:graphResult('/projectName')||'Unanswered'},
    {path:'/contactCompany',label:'Applicant',value:graphResult('/contactCompany')||'Unanswered'},
    {path:'/contactFilerType',label:'Filing party',value:graphResult('/contactFilerType')||'Unanswered'}
  ];
  const consequences=[];
  if(hasUtilityActivity()) consequences.push({path:'/includesUtilityWork',label:'Utility work identified',value:hasGeneralUtility()&&hasWireless()?'Small wireless + other listed utility work':hasGeneralUtility()?'Water/sewer/gas/power/telecom/fiber work':hasWireless()?'Small wireless':'Not determined',reason:'Follow-up activity answers'});
  if(hasGeneralUtility()){
    const tcpRequired=utilityTrafficControlPlanRequired();
    inputs.push(
      {path:'/utilityIsEmergency',label:'Emergency',value:displayValue(graphResult('/utilityIsEmergency'),{true:'Yes',false:'No'})},
      {path:'/utilityJurisdiction',label:'Jurisdiction',value:displayValue(graphResult('/utilityJurisdiction'),{row:'State-maintained right-of-way',easement:'Permanent DelDOT easement',aerial:'Aerial crossing',none:'Outside DelDOT jurisdiction'})},
      {path:'/utilityGroundDisturbanceSqFt',label:'Ground disturbance',value:hasValue(graphResult('/utilityGroundDisturbanceSqFt'))?`${graphResult('/utilityGroundDisturbanceSqFt')} sq. ft.`:'Unanswered'},
      {path:'/utilityTrafficImpact',label:'Traffic impact',value:displayValue(graphResult('/utilityTrafficImpact'),{none:'None',lane:'Lane or shoulder occupation',major:'Detour, complex site, or pedestrian impact'})},
      {path:'/utilityDuration',label:'Duration',value:displayValue(graphResult('/utilityDuration'),{day:'Up to 1 day',longer:'Longer than 1 working day'})},
      {path:`/sites/#${state.utility.id}/typicalApplicationCount`,label:'Typical Applications',value:graphResult(`/sites/#${state.utility.id}/typicalApplicationCount`)??'Unanswered'}
    );
    inputs.push(
      {path:`/sites/#${state.utility.id}/gisIsStateMaintainedRoad`,label:'GIS · state-maintained road',value:displayValue(graphResult(`/sites/#${state.utility.id}/gisIsStateMaintainedRoad`),{true:'Yes',false:'No'})},
      {path:`/sites/#${state.utility.id}/gisIsLimitedAccessRoad`,label:'GIS · limited-access road',value:displayValue(graphResult(`/sites/#${state.utility.id}/gisIsLimitedAccessRoad`),{true:'Yes',false:'No'})},
      {path:`/sites/#${state.utility.id}/gisIsInAirportAirspace`,label:'GIS · airport airspace',value:displayValue(graphResult(`/sites/#${state.utility.id}/gisIsInAirportAirspace`),{true:'Yes',false:'No'})},
      {path:`/sites/#${state.utility.id}/gisIsNearRailroad`,label:'GIS · railroad proximity',value:displayValue(graphResult(`/sites/#${state.utility.id}/gisIsNearRailroad`),{true:'Yes',false:'No'})}
    );
    consequences.push(
      {path:'/utilityPermitType',label:'Permit outcome',value:f.permitType,reason:graphExplanation('/utilityPermitType')},
      {path:'/utilityRequiresTrafficControlPlan',label:'Traffic Control Plan',value:tcpRequired===null?'Not determined':tcpRequired?'Required':'Not required',reason:graphExplanation('/utilityRequiresTrafficControlPlan')},
      {path:'/utilityDocumentsComplete',label:'Required documents',value:tcpRequired===null?`At least ${f.documents.length} currently known`:`${f.documents.length} documents`,reason:graphExplanation('/utilityDocumentsComplete')},
      {path:'/wirelessTotalFee',label:'Amount due',value:money.format(f.fee),reason:hasWireless()?graphExplanation('/wirelessTotalFee'):'Both utility and entrance applications have no application fee'}
    );
  }
  if(hasEntrance()){
    inputs.push(
      {path:'/entranceType',label:'Entrance type',value:graphResult('/entranceType')||'Unanswered'},
      {path:'/entranceExistingAdtEntering',label:'Daily traffic entering',value:graphResult('/entranceExistingAdtEntering')??'Unanswered'},
      {path:'/entranceExistingAdtExiting',label:'Daily traffic exiting',value:graphResult('/entranceExistingAdtExiting')??'Unanswered'},
      {path:'/entrancePeakHourTrips',label:'Peak-hour trips',value:graphResult('/entrancePeakHourTrips')??'Unanswered'}
    );
    const total=graphResult('/entranceTotalAdt');
    consequences.push(
      {path:'/entrancePermitType',label:'Entrance permit outcome',value:f.entrancePermitType,reason:'An Entrance Permit is requested for this project'},
      {path:'/entranceTotalAdt',label:'Total daily traffic',value:total??'Not determined',reason:'Daily traffic entering + daily traffic exiting'},
      {path:'/entranceTrafficOperationalAnalysisRequired',label:'Traffic analysis',value:total===null?'Not determined':graphBoolean('/entranceTrafficOperationalAnalysisRequired')?'Required':'Not required',reason:'Required when total daily traffic is 200 or more'},
      {path:'/entrancePreSubmittalMeetingRequired',label:'Pre-submittal meeting',value:total===null?'Not determined':graphBoolean('/entrancePreSubmittalMeetingRequired')?'Required':'Not required',reason:'Required at 500 daily trips or more than 50 peak-hour trips'},
      {path:'/crossPermitCoordinationRequired',label:'Coordinated permit review',value:graphBoolean('/crossPermitCoordinationRequired')?'Required':'Not required',reason:'Entrance permit requested AND underground utility work at the shared site'},
      {path:'/entranceDocumentsComplete',label:'Entrance documents',value:graphBoolean('/entranceDocumentsComplete')?'Complete':'Incomplete',reason:`${graphDocumentRecords().filter(record=>record.requiredBy.includes('entrance')).length} documents currently required`}
    );
  }
  if(hasWireless()){
    const n=state.nodes[state.currentNode];
    inputs.push({path:'/requestedWirelessNodeCount',label:'Declared nodes',value:graphResult('/requestedWirelessNodeCount')??'Unanswered'});
    if(n) inputs.push(
      {path:`/sites/#${n.id}/siteId`,label:`Node ${state.currentNode+1} site ID`,value:graphResult(`/sites/#${n.id}/siteId`)||'Unanswered'},
      {path:`/sites/#${n.id}/usesProjectSiteLocation`,label:'Location source',value:displayValue(graphResult(`/sites/#${n.id}/usesProjectSiteLocation`),{true:'Project site',false:'Node-specific site'})},
      {path:`/sites/#${n.id}/address`,label:'Effective address',value:graphResult(`/sites/#${n.id}/address`)||'Unanswered'},
      {path:`/sites/#${n.id}/latitude`,label:'Effective latitude',value:graphResult(`/sites/#${n.id}/latitude`)||'Unanswered'},
      {path:`/sites/#${n.id}/longitude`,label:'Effective longitude',value:graphResult(`/sites/#${n.id}/longitude`)||'Unanswered'},
      {path:`/sites/#${n.id}/largestAntennaVolume`,label:'Largest antenna',value:hasValue(graphResult(`/sites/#${n.id}/largestAntennaVolume`))?`${decimalValue(graphResult(`/sites/#${n.id}/largestAntennaVolume`))} cu. ft.`:'Unanswered'},
      {path:`/sites/#${n.id}/otherEquipmentVolume`,label:'Other equipment',value:hasValue(graphResult(`/sites/#${n.id}/otherEquipmentVolume`))?`${decimalValue(graphResult(`/sites/#${n.id}/otherEquipmentVolume`))} cu. ft.`:'Unanswered'},
      {path:`/sites/#${n.id}/facilityHeight`,label:'Facility height',value:hasValue(graphResult(`/sites/#${n.id}/facilityHeight`))?`${decimalValue(graphResult(`/sites/#${n.id}/facilityHeight`))} ft.`:'Unanswered'},
      {path:`/sites/#${n.id}/typicalApplicationCount`,label:'Typical Applications',value:graphResult(`/sites/#${n.id}/typicalApplicationCount`)??'Unanswered'}
    );
    if(n) inputs.push(
      {path:`/sites/#${n.id}/gisIsStateMaintainedRoad`,label:'GIS · state-maintained road',value:displayValue(graphResult(`/sites/#${n.id}/gisIsStateMaintainedRoad`),{true:'Yes',false:'No'})},
      {path:`/sites/#${n.id}/gisIsLimitedAccessRoad`,label:'GIS · limited-access road',value:displayValue(graphResult(`/sites/#${n.id}/gisIsLimitedAccessRoad`),{true:'Yes',false:'No'})},
      {path:`/sites/#${n.id}/gisIsInAirportAirspace`,label:'GIS · airport airspace',value:displayValue(graphResult(`/sites/#${n.id}/gisIsInAirportAirspace`),{true:'Yes',false:'No'})},
      {path:`/sites/#${n.id}/gisIsNearRailroad`,label:'GIS · railroad proximity',value:displayValue(graphResult(`/sites/#${n.id}/gisIsNearRailroad`),{true:'Yes',false:'No'})}
    );
    const nodeEligibility=state.nodes.map((node,index)=>{
      const prefix=`/sites/#${node.id}`;
      const result=graphResult(`${prefix}/permitEligible`);
      const determined=result!==null;
      const eligible=result===true;
      const facilityHeight=decimalValue(graphResult(`${prefix}/facilityHeight`));
      const heightLimit=decimalValue(graphResult(`${prefix}/heightLimit`));
      const measurement=hasValue(facilityHeight)&&hasValue(heightLimit)?` Current facility height: ${facilityHeight} ft.; applicable limit: ${heightLimit} ft.`:'';
      return {path:`${prefix}/permitEligible`,label:`Node ${index+1}${node.siteId?` (${node.siteId})`:''} eligibility`,value:determined?(eligible?'Eligible':'Does not qualify'):'Not determined',reason:`${graphExplanation(`${prefix}/permitEligible`)}${measurement}`,blocking:determined&&!eligible,determined,eligible};
    });
    const allEligible=nodeEligibility.every(result=>result.determined&&result.eligible);
    consequences.push(...nodeEligibility);
    if(n) consequences.push({path:`/sites/#${n.id}/gisSpecialReviewRequired`,label:'Roadway review',value:graphBoolean(`/sites/#${n.id}/gisSpecialReviewRequired`)?'Special review required':'Standard review',reason:'GIS limited-access-road result'});
    consequences.push(
      {path:'/allWirelessNodesEligible',label:'All-node eligibility',value:allEligible?'All nodes eligible':'Not yet satisfied',reason:`${nodeEligibility.filter(result=>result.eligible).length} of ${f.nodeCount} nodes are currently eligible`,blocking:nodeEligibility.some(result=>result.determined&&!result.eligible)},
      {path:'/wirelessNodeCount',label:'Application records',value:`${f.nodeCount} nodes`,reason:'One permit application per declared node'},
      {path:'/projectDocumentsComplete',label:'Project-wide documents',value:`${graphDocumentRecords().filter(record=>record.scope==='project').length} required once`,reason:graphExplanation('/projectDocumentsComplete')},
      {path:`/sites/#${n?.id}/documentsComplete`,label:`Node ${state.currentNode+1} documents`,value:`${f.documents.length} required`,reason:n?graphExplanation(`/sites/#${n.id}/documentsComplete`):'No node selected'},
      {path:'/wirelessTotalFee',label:'Package fee',value:money.format(f.fee),reason:`${f.nodeCount} nodes × $100`}
    );
  }
  const validity=validationFacts();
  if(hasGeneralUtility()) consequences.push({path:'/generalUtilityRequirementsSatisfied',label:'Construction, safety, or emergency permit requirements',value:graphBoolean('/generalUtilityRequirementsSatisfied')?'Satisfied':'Not satisfied',reason:'Required work answers + derived permit outcome + required documents'});
  if(hasWireless()) consequences.push({path:'/smallWirelessRequirementsSatisfied',label:'Small wireless requirements',value:graphBoolean('/smallWirelessRequirementsSatisfied')?'Satisfied':'Not satisfied',reason:'Every declared wireless node is complete and eligible'});
  if(hasEntrance()) consequences.push({path:'/entranceRequirementsSatisfied',label:'Entrance permit requirements',value:graphBoolean('/entranceRequirementsSatisfied')?'Satisfied':'Not satisfied',reason:'Entrance answers + shared GIS jurisdiction + entrance documents'});
  consequences.push({path:'/applicationComplete',label:'Required information',value:validity.applicationComplete?'Complete':'Incomplete',reason:`${validity.requirements.filter(r=>!r.satisfied&&r.path!=='/attestationsAccepted').length} unmet application requirements`,blocking:!validity.applicationComplete});
  consequences.push({path:'/readyToSubmit',label:'Submission readiness',value:validity.readyToSubmit?'Ready':'Not ready',reason:'Application complete + eligible + documents attached + attestations accepted',blocking:!validity.readyToSubmit});
  return {inputs,consequences};
}

function renderVisualizer(){
  const view=visualizerGraph();
  if(!hasAnyActivity()){ $('#visualizer-content').innerHTML='<div class="visualizer-empty">Select one or more project activities to derive possible permit applications.</div>'; return; }
  const renderNode=(node,derived=false)=>{ const serialized=String(node.value); const changed=previousVisualizerValues.has(node.path)&&previousVisualizerValues.get(node.path)!==serialized; previousVisualizerValues.set(node.path,serialized); return `<div class="fact-node ${derived?'derived':''} ${node.blocking?'blocking':''} ${changed?'changed':''}"><span class="fact-path">${escapeHtml(node.path)}</span><span class="fact-value">${escapeHtml(node.label)}: ${escapeHtml(serialized)}</span>${node.reason?`<span class="fact-reason">Because: ${escapeHtml(node.reason)}</span>`:''}</div>`; };
  $('#visualizer-content').innerHTML=`<div class="graph-stage"><div><p class="graph-column-title">Applicant and external source facts</p>${view.inputs.map(n=>renderNode(n)).join('')}</div><div><p class="graph-column-title">Derived consequences</p>${view.consequences.map(n=>renderNode(n,true)).join('')}</div></div><details class="raw-facts"><summary>Inspect current graph state</summary><pre>${escapeHtml(graph.toJSON(2))}</pre></details>`;
}
function escapeHtml(value){ return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function escapeAttribute(value){ return escapeHtml(value).replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function setVisualizer(open){ $('#fact-visualizer').classList.toggle('open',open); $('#fact-visualizer').setAttribute('aria-hidden',String(!open)); $('#open-visualizer').setAttribute('aria-expanded',String(open)); $('#visualizer-scrim').classList.toggle('hidden',!open); if(open) renderVisualizer(); }

$('#application-form').addEventListener('input',()=>{ bindValues($('#application-form')); renderSummary(); renderVisualizer(); });
$('#application-form').addEventListener('change',(event)=>{ bindValues($('#application-form')); const conditionalQuestionChanged=(event.target.name==='underground'&&(currentRoute()==='utility'||currentRoute()==='wirelessConstruction'))||(event.target.name==='locationRelationship'&&currentRoute()==='wirelessOverview'); if((currentRoute()==='review'&&event.target.name==='attest')||conditionalQuestionChanged||currentRoute()==='entrance') render(); else { renderSummary(); renderGisSettings(); } renderVisualizer(); });
$('#application-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  bindValues(e.currentTarget);
  const validity=validationFacts();
  let failures=validity.currentRequirements.filter(r=>!r.satisfied);
  if(step===reviewStep()&&!validity.readyToSubmit&&failures.length===0) failures=validity.requirements.filter(r=>!r.satisfied);
  if(failures.length){
    $('#notice').innerHTML=`<strong>More information is needed</strong><ul>${failures.slice(0,8).map(r=>`<li>${r.label}</li>`).join('')}</ul>`;
    $('#notice').className='notice error';
    renderVisualizer();
    return;
  }
  if(currentRoute()==='wirelessConstruction'&&hasWireless()&&state.currentNode<state.nodes.length-1){ state.currentNode++; step=routeStep('wirelessOverview'); save(); render(); return; }
  if(currentRoute()==='documents'&&hasWireless()&&state.currentNode<state.nodes.length-1){ state.currentNode++; save(); render(); return; }
  if(step===reviewStep()){
    state.submitted=true; save();
    const submittedPermits=[hasGeneralUtility()?facts().permitType:'',hasWireless()?`${state.nodes.length} Small Wireless Facility Permit${state.nodes.length===1?'':'s'}`:'',hasEntrance()?'Entrance Permit':''].filter(Boolean);
    $('#screen').innerHTML=intro('Submitted','Your project has been submitted','You will receive a confirmation email with every application record produced for this project.')+`<div class="result"><strong>${submittedPermits.join(' + ')}</strong><p>DelDOT will coordinate review of the related permit applications and contact you if additional information is needed.</p></div>`;
    $('.actions').classList.add('hidden'); renderVisualizer(); return;
  }
  const leavingLastNode=currentRoute()==='wirelessConstruction'&&hasWireless()&&state.currentNode===state.nodes.length-1;
  step++;
  if(hasWireless()&&leavingLastNode&&currentRoute()==='documents') state.currentNode=0;
  save(); render();
});
$('#back').addEventListener('click',()=>{ if(currentRoute()==='wirelessOverview'&&hasWireless()&&state.currentNode>0){ state.currentNode--; step=routeStep('wirelessConstruction'); render(); return; } if(currentRoute()==='documents'&&hasWireless()&&state.currentNode>0){ state.currentNode--; render(); return; } if(step>0){ step--; if(currentRoute()==='wirelessConstruction'&&hasWireless()) state.currentNode=state.nodes.length-1; render(); }});
$('#open-visualizer').addEventListener('click',()=>setVisualizer(true));
$('#close-visualizer').addEventListener('click',()=>setVisualizer(false));
$('#visualizer-scrim').addEventListener('click',()=>setVisualizer(false));
document.addEventListener('keydown',(event)=>{ if(event.key==='Escape') setVisualizer(false); });
$('#gis-settings').addEventListener('change',(event)=>{
  const fact=event.target.dataset.gisFact;
  if(!fact) return;
  const node=['wirelessOverview','wirelessConstruction','documents'].includes(currentRoute())&&hasWireless()?state.nodes[state.currentNode]:null;
  const site=node?nodeLocation(node):state.utility;
  site.gis[fact]=event.target.value;
  save();
  render();
  renderVisualizer();
});
$('#reset-application').addEventListener('click',()=>{
  if(!window.confirm('Reset this application? All locally saved answers and nodes will be removed.')) return;
  localStorage.removeItem('deldot-poc');
  state=structuredClone(defaultState);
  step=0;
  previousVisualizerValues=new Map();
  $('.actions').classList.remove('hidden');
  setVisualizer(false);
  render();
  renderVisualizer();
});
render();
renderVisualizer();
