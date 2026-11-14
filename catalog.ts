import extra from './extra-fonts.json';
export interface StyleProfile {corner:number;lean:number;hand:number}
export interface FontEntry {variant?:'papyrus-alternates';constructionSignature?:string;id:string;name:string;postscript:string;file?:string;asset?:string;licenseAsset?:string;description?:string;category?:string;constructionInferred?:boolean;face?:number;a:string;g:string;profile:StyleProfile}
export const catalog:FontEntry[]=[
 {id:'krypton',name:'Krypton',postscript:'MonaspaceKryptonVar-Regular',a:'double-storey',g:'single-storey',profile:{corner:1,lean:0,hand:0}},
 {id:'argon',name:'Argon',postscript:'MonaspaceArgonVar-Regular',a:'double-storey',g:'double-storey',profile:{corner:0,lean:0,hand:0}},
 {id:'radon',name:'Radon',postscript:'MonaspaceRadonVar-Regular',a:'single-storey',g:'single-storey',profile:{corner:-.1,lean:.16,hand:1}},
 {id:'comic-sans',name:'Comic Sans',postscript:'ComicSansMS',file:'Comic Sans MS.ttf',a:'single-storey',g:'single-storey',profile:{corner:-.2,lean:.03,hand:.6}},
 {id:'papyrus',name:'Papyrus',postscript:'Papyrus',file:'Papyrus.ttc',face:1,a:'double-storey',g:'double-storey',profile:{corner:.3,lean:.03,hand:.8}},
 {id:'times-new-roman',name:'Times New Roman',postscript:'TimesNewRomanPSMT',file:'Times New Roman.ttf',a:'double-storey',g:'double-storey',profile:{corner:.2,lean:0,hand:0}},
 {id:'arial',name:'Arial',postscript:'ArialMT',file:'Arial.ttf',a:'double-storey',g:'single-storey',profile:{corner:0,lean:0,hand:0}},
 {id:'georgia',name:'Georgia',postscript:'Georgia',file:'Georgia.ttf',a:'double-storey',g:'double-storey',profile:{corner:.15,lean:0,hand:0}},
 {id:'courier-new',name:'Courier New',postscript:'CourierNewPSMT',file:'Courier New.ttf',a:'double-storey',g:'single-storey',profile:{corner:.65,lean:0,hand:0}},
 ...extra,
 {id:'papyrus-alternates',name:'Papyrus Alternates · experimental',postscript:'Papyrus',file:'Papyrus.ttc',face:1,variant:'papyrus-alternates',a:'double-storey',g:'double-storey',description:'organic rustic hand drawn Papyrus with purpose-drawn alternate letter constructions',profile:{corner:.3,lean:.03,hand:.8}},
];
export const defaults=catalog.slice(0,3);
export function entryForFont(font:any):FontEntry {
 if(font.source)return font.source;
 const entry=catalog.find(e=>font.familyName?.toLowerCase().includes(e.name.toLowerCase())||font.postscriptName===e.postscript);
 if(!entry)throw new Error('Font is not in the Type Space catalog: '+font.familyName);
 return entry;
}
