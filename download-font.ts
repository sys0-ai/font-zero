export function downloadFont(bytes:ArrayBuffer,filename:string){
 if(bytes.byteLength<12||String.fromCharCode(...new Uint8Array(bytes,0,4))!=='OTTO')throw new Error('The generated font is incomplete.');
 if(!/^[A-Za-z0-9-]+\.otf$/.test(filename))throw new Error('The font filename must end in .otf.');
 const url=URL.createObjectURL(new Blob([bytes],{type:'font/otf'})),link=document.createElement('a');
 link.href=url;link.download=filename;link.hidden=true;document.body.append(link);
 link.click();link.remove();
 // Keep the complete payload alive while the browser starts its local save.
 window.setTimeout(()=>URL.revokeObjectURL(url),120_000);
}
