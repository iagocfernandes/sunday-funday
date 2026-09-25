// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {render} from '@testing-library/react';
import {StrictMode} from 'react';
import {usePageScroll} from './usePageScroll';
function Owner({enabled=true}:{enabled?:boolean}){usePageScroll(enabled);return null;}
describe('rolagem do controle móvel',()=>{
 it('habilita documento no celular e restaura viewport ao ir para TV, inclusive em StrictMode',()=>{const v=render(<StrictMode><Owner/></StrictMode>);expect(document.documentElement.classList.contains('remote-scroll-page')).toBe(true);v.rerender(<StrictMode><Owner enabled={false}/></StrictMode>);expect(document.documentElement.classList.contains('remote-scroll-page')).toBe(false);v.unmount();});
 it('não bloqueia rolagem enquanto outro componente móvel ainda está montado',()=>{const a=render(<Owner/>),b=render(<Owner/>);a.unmount();expect(document.documentElement.classList.contains('remote-scroll-page')).toBe(true);b.unmount();expect(document.documentElement.classList.contains('remote-scroll-page')).toBe(false);});
});
