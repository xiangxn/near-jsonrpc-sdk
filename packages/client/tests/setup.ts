import { beforeAll } from 'vitest';

export let sharedState: {
  latestBlockHeight?: number;
} = {};

beforeAll(async () => {
  const res = await fetch('https://test.rpc.fastnear.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'block',
      params: { finality: 'final' },
    }),
  });

  const json = await res.json();
  sharedState.latestBlockHeight = json.result.header.height;
  console.log('[setup] latestBlockHeight =', sharedState.latestBlockHeight);
});
