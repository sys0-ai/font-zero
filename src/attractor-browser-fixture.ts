import type {Page} from 'playwright';
import {poem} from './cursor-text';
export async function savedCursorSession(page:Page){
 await page.addInitScript(text=>{
  const key='fontzero.attractors.v1';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,text,size:32,leading:1.65,padding:24,within:false,wrap:false,light:true,selected:'cursor',showPoles:true,paused:false,designMode:false,attractors:[
   {id:'ambient',font:'gf-roboto',mode:'ambient',x:.5,y:.5,radius:200,decay:2,vx:70,vy:55},
   {id:'cursor',font:'gf-nunito',mode:'cursor',x:.5,y:.5,radius:180,decay:2,vx:70,vy:55}
  ]}));
 },poem);
}
