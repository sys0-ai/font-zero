interface Bounds {x:number;y:number;width:number;height:number}
/** Preserve the text's display footprint across font changes, not its font data. */
export class PreviewSize {
 private key='';private width=0;private height=0;
 fit(ink:Bounds,key:string,centerX:number,centerY:number){
  if(ink.width<=0||ink.height<=0)return {transform:'',bounds:ink};
  if(key!==this.key){this.key=key;this.width=ink.width;this.height=ink.height;}
  const sx=this.width/ink.width,sy=this.height/ink.height,x=centerX-this.width/2,y=centerY-this.height/2;
  return {transform:`matrix(${sx} 0 0 ${sy} ${x-ink.x*sx} ${y-ink.y*sy})`,bounds:{x,y,width:this.width,height:this.height}};
 }
}
