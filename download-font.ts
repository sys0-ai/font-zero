export function downloadFont(bytes:ArrayBuffer,filename:string){
 document.querySelector('#font-download-form')?.remove();
 const form=document.createElement('form');form.id='font-download-form';form.method='POST';form.action='downloads/'+encodeURIComponent(filename);form.hidden=true;
 const data=new Uint8Array(bytes),chunks:string[]=[];
 for(let i=0;i<data.length;i+=8192)chunks.push(String.fromCharCode(...data.subarray(i,i+8192)));
 const input=document.createElement('input');input.type='hidden';input.name='font';input.value=btoa(chunks.join(''));form.append(input);
 document.body.append(form);form.submit();
}
