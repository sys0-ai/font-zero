export async function fontDownloadResponse(request:Request){
 if(request.method!=='POST')return new Response('Use POST',{status:405,headers:{Allow:'POST'}});
 const filename=new URL(request.url).pathname.slice('/downloads/'.length);
 if(!/^[A-Za-z0-9-]+\.otf$/.test(filename))return new Response('Invalid font filename',{status:400});
 const form=await request.formData(),encoded=form.get('font');
 if(typeof encoded!=='string'||encoded.length>16*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return new Response('Invalid font data',{status:400});
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.subarray(0,4).toString()!=='OTTO')return new Response('Expected an OpenType font',{status:400});
 return new Response(bytes,{headers:{'Content-Type':'font/otf','Content-Disposition':`attachment; filename="${filename}"; filename*=UTF-8''${filename}`,'Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
