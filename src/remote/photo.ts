/** Foto opcional reduzida no aparelho antes do envio; metadados não são preservados. */
export async function preparePortrait(file: File): Promise<string> {
  if(!file.type.startsWith('image/')) throw new Error('Escolha uma imagem.');
  if(file.size>20*1024*1024) throw new Error('Escolha uma foto de até 20 MB.');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.');
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,128,128);
    for(const quality of [.8,.65,.45,.25]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=14000)return data;}
    throw new Error('Escolha uma foto mais simples.');
  } catch(e) {throw new Error(e instanceof Error&&e.message.startsWith('Escolha')?e.message:'Não foi possível abrir a foto. Tente JPG ou PNG.');}
  finally {URL.revokeObjectURL(url);}
}
