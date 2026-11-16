import extra from './extra-fonts.json';
export interface StyleProfile {corner:number;lean:number;hand:number}
export interface FontEntry {effect?:'redacted';variant?:'papyrus-alternates'|'comic-sans-universal'|'arial-alternates'|'times-universal';constructionSignature?:string;id:string;name:string;postscript:string;file?:string;asset?:string;licenseAsset?:string;description?:string;category?:string;constructionInferred?:boolean;face?:number;axes?:{wght:number};a:string;g:string;profile:StyleProfile}
export const catalog:FontEntry[]=[
 {id:'krypton',name:'Krypton',postscript:'MonaspaceKryptonVar-Regular',a:'double-storey',g:'single-storey',profile:{corner:1,lean:0,hand:0}},
 {id:'argon',name:'Argon',postscript:'MonaspaceArgonVar-Regular',a:'double-storey',g:'double-storey',profile:{corner:0,lean:0,hand:0}},
 {id:'radon',name:'Radon',postscript:'MonaspaceRadonVar-Regular',a:'single-storey',g:'single-storey',profile:{corner:-.1,lean:.16,hand:1}},
 {id:'comic-sans',name:'Comic Sans',postscript:'ComicSansMS',file:'Comic Sans MS.ttf',asset:'licensed/Comic Sans MS.ttf',a:'single-storey',g:'single-storey',profile:{corner:-.2,lean:.03,hand:.6}},
 {id:'papyrus',name:'Papyrus',postscript:'Papyrus',file:'Papyrus.ttc',asset:'licensed/Papyrus.ttc',face:1,a:'double-storey',g:'double-storey',profile:{corner:.3,lean:.03,hand:.8}},
 {id:'times-new-roman',name:'Times New Roman',postscript:'TimesNewRomanPSMT',file:'Times New Roman.ttf',asset:'licensed/Times New Roman.ttf',a:'double-storey',g:'double-storey',profile:{corner:.2,lean:0,hand:0}},
 {id:'arial',name:'Arial',postscript:'ArialMT',file:'Arial.ttf',asset:'licensed/Arial.ttf',a:'double-storey',g:'single-storey',profile:{corner:0,lean:0,hand:0}},
 {id:'georgia',name:'Georgia',postscript:'Georgia',file:'Georgia.ttf',asset:'licensed/Georgia.ttf',a:'double-storey',g:'double-storey',profile:{corner:.15,lean:0,hand:0}},
 {id:'courier-new',name:'Courier New',postscript:'CourierNewPSMT',file:'Courier New.ttf',asset:'licensed/Courier New.ttf',a:'double-storey',g:'single-storey',profile:{corner:.65,lean:0,hand:0}},
 ...extra,
 {id:'papyrus-alternates',name:'Papyrus Universal',postscript:'Papyrus',file:'Papyrus.ttc',asset:'licensed/Papyrus.ttc',face:1,variant:'papyrus-alternates',a:'double-storey',g:'double-storey',description:'organic rustic hand drawn Papyrus with purpose-drawn alternate letter constructions',profile:{corner:.3,lean:.03,hand:.8}},
 {id:'comic-sans-universal',name:'Comic Sans Universal',postscript:'ComicSansMS',file:'Comic Sans MS.ttf',asset:'licensed/Comic Sans MS.ttf',variant:'comic-sans-universal',a:'single-storey',g:'single-storey',description:'Comic Sans with drawn ordinary-text construction alternatives',profile:{corner:-.2,lean:.03,hand:.6}},
 {id:'arial-alternates',name:'Arial · compatible g',postscript:'ArialMT',file:'Arial.ttf',asset:'licensed/Arial.ttf',variant:'arial-alternates',a:'double-storey',g:'single-storey',description:'Arial with a double-storey g drawn from its native oval strokes; experimental compatible construction',profile:{corner:0,lean:0,hand:0}},
 {id:'times-universal',name:'Times New Roman · alternate forms',postscript:'TimesNewRomanPSMT',file:'Times New Roman.ttf',asset:'licensed/Times New Roman.ttf',variant:'times-universal',a:'double-storey',g:'double-storey',description:'Experimental Times New Roman with native-stroke alternatives for ordinary letter constructions',profile:{corner:.2,lean:0,hand:0}},
 {id:'redacted',name:'Redacted',postscript:'Redacted-Regular',asset:'redacted/font.ttf',licenseAsset:'redacted/OFL.txt',effect:'redacted',a:'block',g:'block',description:'Solid blackout bars by Christian Naths, SIL Open Font License',profile:{corner:1,lean:0,hand:0}},
 {id:'neon',name:'Neon',postscript:'MonaspaceNeonVar-ExtraLight',asset:'monaspace/neon.ttf',licenseAsset:'monaspace/OFL.txt',a:'double-storey',g:'double-storey',profile:{corner:0,lean:0,hand:0}},
 {id:'xenon',name:'Xenon',postscript:'MonaspaceXenonVar-ExtraLight',asset:'monaspace/xenon.ttf',licenseAsset:'monaspace/OFL.txt',a:'double-storey',g:'double-storey',profile:{corner:.3,lean:0,hand:0}},
];
export const monaspaceIds=['argon','krypton','neon','radon','xenon'];
export const defaults=catalog.slice(0,3);
export function entryForFont(font:any):FontEntry {
 if(font.source)return font.source;
 const entry=catalog.find(e=>font.familyName?.toLowerCase().includes(e.name.toLowerCase())||font.postscriptName===e.postscript);
 if(!entry)throw new Error('Font is not in the Font Zero catalog: '+font.familyName);
 return entry;
}
