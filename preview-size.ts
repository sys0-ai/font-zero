interface Bounds {x:number;y:number;width:number;height:number}
/** Fit natural letter proportions inside a stable preview frame. */
export class PreviewSize {
 private key='';private width=0;private height=0;
 fit(ink:Bounds,key:string,centerX:number,centerY:number){
  if(ink.width<=0||ink.height<=0)return {transform:'',bounds:ink};
  if(key!==this.key){this.key=key;this.width=ink.width;this.height=ink.height;}
  const scale=Math.min(this.width/ink.width,this.height/ink.height);
  const x=centerX-ink.width*scale/2,y=centerY-ink.height*scale/2;
  return {transform:`matrix(${scale} 0 0 ${scale} ${x-ink.x*scale} ${y-ink.y*scale})`,bounds:{x:centerX-this.width/2,y:centerY-this.height/2,width:this.width,height:this.height}};
 }
}
