// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultMap } from '../data/map';
import { createGame } from '../game/engine';
import { BoardV4 } from './BoardV4';

afterEach(cleanup);

const state = () => createGame([
  { id: 'p0', name: 'Iago', color: '#347bb8', symbol: 'I', portrait: '/iago.png' },
  { id: 'p1', name: 'Milena', color: '#ba3530', symbol: 'M', portrait: '/milena.png' },
], {}, { map: createDefaultMap(), seed: 1, shuffleOrder: false });

describe('BoardV4 render layers', () => {
  it('keeps masked ambient effects outside the gameplay SVG', () => {
    const { container } = render(<BoardV4 state={state()} living />);
    const board = container.querySelector<HTMLElement>('[data-board-layered="true"]')!;
    const art = board.querySelector<HTMLImageElement>(':scope > .board-art-layer')!;
    const ambient = board.querySelector<SVGSVGElement>(':scope > .board-ambient-layer')!;
    const gameplay = board.querySelector<SVGSVGElement>(':scope > .board-gameplay-layer')!;

    expect(art.getAttribute('src')).toBe('/assets/board/ilha-v4.png');
    expect(ambient.querySelectorAll('mask, filter').length).toBeGreaterThan(0);
    expect(gameplay.querySelector('mask, filter')).toBeNull();
    expect(gameplay.querySelectorAll('[data-board-node]').length).toBe(Object.keys(state().map.nodes).length);
    expect(gameplay.querySelectorAll('[data-kind="minus"] path[d="M-6 0H6"]').length).toBeGreaterThan(0);
  });

  it('removes only the optional ambient layer when living mode is off', () => {
    const { container } = render(<BoardV4 state={state()} living={false} />);

    expect(container.querySelector('.board-art-layer')).not.toBeNull();
    expect(container.querySelector('.board-gameplay-layer')).not.toBeNull();
    expect(container.querySelector('.board-ambient-layer')).toBeNull();
  });
});
