const clamp=(p:number)=>Math.max(0,Math.min(1,p));
export class Timeline {
 position=0;running=false;duration=10_000;
 private anchor=0;private origin=0;
 sample(now:number){if(this.running){this.position=clamp(this.origin+(now-this.anchor)/this.duration);if(this.position===1)this.running=false;}return this.position;}
 play(now:number){if(this.position===1)this.position=0;this.origin=this.position;this.anchor=now;this.running=true;}
 pause(now:number){this.sample(now);this.running=false;}
 seek(position:number,now:number){this.position=clamp(position);this.origin=this.position;this.anchor=now;}
 setDuration(ms:number,now:number){if(!Number.isFinite(ms)||ms<100||ms>86_400_000)throw new Error('Choose a duration between 0.1 seconds and 24 hours.');this.sample(now);this.duration=ms;this.origin=this.position;this.anchor=now;}
}
export function clockProgress(now:Date,start:number,end:number){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start===end)throw new Error('Choose different start and end times.');
 const minute=now.getHours()*60+now.getMinutes()+now.getSeconds()/60+now.getMilliseconds()/60000;
 if(end>start)return clamp((minute-start)/(end-start));
 return minute>=start?(minute-start)/(1440-start+end):minute<=end?(minute+1440-start)/(1440-start+end):1;
}
export function pace(position:number,eased:boolean){return eased?position*position*(3-2*position):position;}
export function timeLabel(milliseconds:number){const seconds=Math.floor(milliseconds/1000);return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');}
