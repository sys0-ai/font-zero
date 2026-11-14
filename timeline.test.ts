import {describe,expect,test} from 'bun:test';
import {Timeline,clockProgress,pace,timeLabel} from './timeline';

describe('duration playback',()=>{
 test('pause, scrub and resume preserve the chosen position',()=>{
  const time=new Timeline();time.setDuration(2000,0);time.play(100);
  expect(time.sample(600)).toBe(.25);time.pause(1100);
  expect(time.sample(9000)).toBe(.5);
  time.seek(.75,9100);time.play(9200);
  expect(time.sample(9700)).toBe(1);expect(time.running).toBe(false);
  time.play(10000);expect(time.sample(10000)).toBe(0);
 });
 test('eight-hour playback catches up after sleep and finishes exactly',()=>{
  const time=new Timeline();time.setDuration(8*3600000,0);time.play(0);
  expect(time.sample(4*3600000)).toBe(.5);
  expect(time.sample(24*3600000)).toBe(1);expect(time.running).toBe(false);
 });
 test('duration changes preserve phase and reject invalid durations',()=>{
  const time=new Timeline();time.play(0);time.setDuration(20000,5000);
  expect(time.sample(10000)).toBe(.75);
  for(const n of [0,NaN,Infinity,86400001])expect(()=>time.setDuration(n,10000)).toThrow();
 });
});
const at=(hours:number,minutes=0)=>new Date(2026,10,12,hours,minutes);
test('daytime schedule holds its endpoints outside its interval',()=>{
 expect(clockProgress(at(8),540,1020)).toBe(0);
 expect(clockProgress(at(13),540,1020)).toBe(.5);
 expect(clockProgress(at(20),540,1020)).toBe(1);
});
test('overnight schedule crosses midnight and holds the end during daytime',()=>{
 expect(clockProgress(at(22),1320,360)).toBe(0);
 expect(clockProgress(at(2),1320,360)).toBe(.5);
 expect(clockProgress(at(6),1320,360)).toBe(1);
 expect(clockProgress(at(15),1320,360)).toBe(1);
 expect(()=>clockProgress(at(9),540,540)).toThrow();
});
test('easing keeps endpoints and midpoint, with slower edges',()=>{
 expect(pace(0,true)).toBe(0);expect(pace(1,true)).toBe(1);
 expect(pace(.5,true)).toBe(.5);expect(pace(.1,true)).toBeLessThan(.1);
 expect(pace(.1,false)).toBe(.1);expect(timeLabel(28800000)).toBe('08:00:00');
});
