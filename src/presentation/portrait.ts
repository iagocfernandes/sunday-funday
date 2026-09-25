/** Refresh bundled default artwork without rewriting saves or uploaded photos. */
export function displayPortrait(src: string | undefined): string | undefined {
 const legacy=src?.match(/^\/?assets\/portraits\/gorila-([1-5])\.png$/);
 if(!legacy)return src;
 return `/assets/characters/${['arthur','mari','milena'][(Number(legacy[1])-1)%3]}-v1.png`;
}
