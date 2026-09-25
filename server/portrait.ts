/** Somente JPEG pequeno embutido, sem URLs externas ou SVG executável. */
export function validPortrait(value: unknown): value is string {
  if(typeof value!=='string'||value.length>14000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  const bytes=Buffer.from(value.slice(23),'base64');
  if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return false;
  // Verifica as dimensões no marcador SOF; a imagem deve ser uma miniatura.
  for(let i=2;i+8<bytes.length;){
    if(bytes[i]!==255)return false;
    const marker=bytes[i+1];if(marker===0xda)break;
    const length=bytes.readUInt16BE(i+2);if(length<2||i+2+length>bytes.length)return false;
    if([0xc0,0xc1,0xc2].includes(marker))return bytes.readUInt16BE(i+5)<=128&&bytes.readUInt16BE(i+5)>0&&bytes.readUInt16BE(i+7)<=128&&bytes.readUInt16BE(i+7)>0;
    i+=length+2;
  }
  return false;
}
