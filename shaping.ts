// A shared cluster can contain one ligature in one font and several glyphs in
// another. Compose each source's curves over the same text span before morphing.
export function sharedClusters(runs:any[],length:number){
 const boundaries=[...new Set([0,...runs[0].clusters,length])].filter(n=>n===length||runs.every(r=>r.clusters.includes(n))).sort((a,b)=>a-b);
 return boundaries.slice(0,-1).map((start,i)=>({start,end:boundaries[i+1],indices:runs.map(r=>r.clusters.flatMap((c:number,j:number)=>c>=start&&c<boundaries[i+1]?[j]:[]))}));
}
export function clusterGlyph(run:any,indices:number[],font:any){
 let x=0;const commands:any[]=[];
 for(const j of indices){const p=run.positions[j],g=font.getGlyph(run.glyphs[j].id);
  commands.push(...g.path.commands.map((c:any)=>({command:c.command,args:c.args.map((v:number,k:number)=>v+(k%2?p.yOffset:x+p.xOffset))})));x+=p.xAdvance;
 }
 return {path:{commands},advanceWidth:x};
}
