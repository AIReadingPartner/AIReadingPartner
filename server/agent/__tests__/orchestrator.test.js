const { runAgent } = require('../orchestrator');

test('runs a tool then returns the final answer with citations and trace', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'flood' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'A flood hit the town.' }),
  };
  const handlers = {
    retrieve: jest.fn(async () => ({ context: '[2] flood', citations: [2] })),
  };

  const out = await runAgent({ chat, handlers, userTurn: 'Goal: flood', maxSteps: 5 });

  expect(out.answer).toBe('A flood hit the town.');
  expect(out.citations).toEqual([2]);
  expect(out.steps).toBe(1);
  expect(out.toolTrace).toEqual([
    { tool: 'retrieve', args: { query: 'flood' }, result: { context: '[2] flood', citations: [2] } },
  ]);
  expect(chat.send).toHaveBeenCalledTimes(2);
  expect(chat.send.mock.calls[1][0]).toEqual([
    { functionResponse: { name: 'retrieve', response: { context: '[2] flood', citations: [2] } } },
  ]);
});

test('aggregates citations from indices and dedupes across tools', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'highlightRelevant', args: { goal: 'g' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: [{ name: 'retrieve', args: { query: 'g' } }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'done' }),
  };
  const handlers = {
    highlightRelevant: async () => ({ indices: [2, 4] }),
    retrieve: async () => ({ context: 'c', citations: [4, 6] }),
  };

  const out = await runAgent({ chat, handlers, userTurn: 'x', maxSteps: 5 });
  expect(out.citations).toEqual([2, 4, 6]);
  expect(out.steps).toBe(2);
});

test('stops at maxSteps when the model never finalizes', async () => {
  const chat = {
    send: jest.fn().mockResolvedValue({ functionCalls: [{ name: 'retrieve', args: {} }], text: null }),
  };
  const handlers = { retrieve: async () => ({ citations: [] }) };

  const out = await runAgent({ chat, handlers, userTurn: 'x', maxSteps: 3 });
  expect(out.steps).toBe(3);
  expect(out.answer).toMatch(/step limit/i);
});

test('unknown tool call is reported back as an error result, loop continues', async () => {
  const chat = {
    send: jest.fn()
      .mockResolvedValueOnce({ functionCalls: [{ name: 'bogus', args: {} }], text: null })
      .mockResolvedValueOnce({ functionCalls: null, text: 'recovered' }),
  };
  const out = await runAgent({ chat, handlers: {}, userTurn: 'x', maxSteps: 5 });
  expect(out.answer).toBe('recovered');
  expect(out.toolTrace[0].result).toEqual({ error: 'unknown tool: bogus' });
});
