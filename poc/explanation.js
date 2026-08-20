const field=(value,suffix)=>Object.entries(value||{}).find(([key])=>key.endsWith(suffix))?.[1];

const scalaList=value=>{
  const items=[];
  const seen=new WeakSet();
  while(value&&typeof value==='object'&&!seen.has(value)){
    seen.add(value);
    const head=field(value,'__f_head');
    if(head===undefined) break;
    items.push(head);
    value=field(value,'__f_next');
  }
  return items;
};

const combine=(left,right)=>left.flatMap(a=>right.map(b=>[...a,...b]));

export function explanationGroups(explanation){
  const writablePath=field(explanation,'Explanation$Writable__f_path');
  if(writablePath?.toString__T) return [[writablePath.toString__T()]];
  const childList=field(explanation,'__f_childList');
  if(!childList) return [[]];
  return scalaList(childList).flatMap(set=>
    scalaList(set).reduce((sets,child)=>combine(sets,explanationGroups(child)),[[]])
  );
}

export function formatGraphExplanation(graph,path,formatPath=value=>value){
  const groups=explanationGroups(graph.explain(path))
    .map(group=>[...new Set(group.filter(item=>item!==path).map(formatPath))])
    .filter(group=>group.length);
  if(!groups.length){
    const missing=Array.from(graph.explainAndSolve(path)||[], group=>Array.from(group).map(formatPath));
    return missing.length
      ? `Waiting for ${missing.map(group=>group.join(' and ')).join(' or ')}`
      : 'Derived directly by the fact graph.';
  }
  if(groups.length===1) return `All of these facts determine the result: ${groups[0].join(' and ')}`;
  return `A change in any of these determining groups can change the result: ${groups.map(group=>`(${group.join(' and ')})`).join(' · ')}`;
}
