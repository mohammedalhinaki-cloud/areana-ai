import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPdfTask } from '../pdfService';

type FakeMessage = { id: string; data?: ArrayBuffer; error?: string };
class FakePdfWorker {
  onmessage: ((event: MessageEvent<FakeMessage>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  postMessage(message: { id: string }) {
    this.onmessage?.({ data: { id: message.id, data: new Uint8Array([37, 80, 68, 70]).buffer } } as MessageEvent<FakeMessage>);
  }
  terminate() { this.terminated = true; }
}

describe('PDF worker client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the task to a Worker and resolves the returned PDF bytes', async () => {
    vi.stubGlobal('Worker', FakePdfWorker as unknown as typeof Worker);
    const result = await runPdfTask({ task: 'mergePdfs', files: [] });
    expect([...result]).toEqual([37, 80, 68, 70]);
  });
});
