import {test,expect} from 'bun:test';
import {chromium} from 'playwright';
import {create} from 'fontkit';
import fonts from './fonts.json';
import {sourcePath,outlineFillRule} from './curves';

test('all ASCII endpoints rasterize identically to the original font commands',async()=>{
 const cases=fonts.flatMap(f=>{
  const font=create(Buffer.from(f.data,'base64')).getVariation({wght:450,wdth:100,slnt:0});
  return Array.from({length:94},(_,i)=>{
   const commands=font.glyphForCodePoint(i+33).path.commands;
   return {name:f.name+' '+String.fromCharCode(i+33),commands,path:sourcePath(commands,20,220,.15)};
  });
 });
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const result=await page.evaluate(({cases,rule})=>{
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=240;a.height=b.height=260;
   const x=a.getContext('2d',{willReadFrequently:true})!,y=b.getContext('2d',{willReadFrequently:true})!;
   const failures:string[]=[];let overlapDifference=0;
   for(const item of cases){
    x.clearRect(0,0,240,260);y.clearRect(0,0,240,260);x.beginPath();
    for(const {command,args}of item.commands)(x as any)[command](...args.map((v:number,i:number)=>i%2===0?20+v*.15:220-v*.15));
    x.fill();y.fill(new Path2D(item.path),rule);
    const expected=x.getImageData(0,0,240,260).data,actual=y.getImageData(0,0,240,260).data;
    if(expected.some((v,i)=>v!==actual[i]))failures.push(item.name);
    if(item.name.endsWith(' k')){
     y.clearRect(0,0,240,260);y.fill(new Path2D(item.path),'evenodd');const wrong=y.getImageData(0,0,240,260).data;
     for(let i=3;i<wrong.length;i+=4)if(wrong[i]!==expected[i])overlapDifference++;
    }
   }
   return{failures,overlapDifference};
  },{cases,rule:outlineFillRule});
  expect(result.failures).toEqual([]);expect(result.overlapDifference).toBeGreaterThan(0);
 }finally{await browser.close();}
},15000);
