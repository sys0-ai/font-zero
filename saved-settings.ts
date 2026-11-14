export const settingsKey='fontzero.settings.v1';
export function readSettings():unknown {
 const text=localStorage.getItem(settingsKey);
 if(text===null)return undefined;
 const value=JSON.parse(text);
 if(value?.version!==1)throw new Error('Saved Fontzero settings use an unsupported version.');
 return value;
}
export function writeSettings(value:object){localStorage.setItem(settingsKey,JSON.stringify({version:1,...value}));}
