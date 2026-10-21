import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformImage } from '../imageService';

type FakeMessage = { id: string; data?: ArrayBuffer; mime?: 'image/png'; width?: number; height?: number; error?: string };
class FakeImageWorker {
  onmessage: ((event: MessageEvent<FakeMessage>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { id: string }) {
    this.onmessage?.({ data: { id: message.id, data: new Uint8Array([137, 80, 78, 71]).buffer, mime: 'image/png', width: 20, height: 10 } } as MessageEvent<FakeMessage>);
  }
  terminate() {}
}

describe('image worker client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the worker image bytes, dimensions, and MIME type', async () => {
    vi.stubGlobal('Worker', FakeImageWorker as unknown as typeof Worker);
    const source = new File([new Uint8Array([1, 2, 3])], 'source.png', { type: 'image/png' });
    const result = await transformImage(source, { width: 20, height: 10, rotation: 0, format: 'image/png', quality: 1 });
    expect(result.blob.type).toBe('image/png');
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
    expect([...new Uint8Array(await result.blob.arrayBuffer())]).toEqual([137, 80, 78, 71]);
  });
});
