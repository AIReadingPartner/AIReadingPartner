const { makeChatFromModel } = require('../geminiChat');

test('maps a function-call response then a text response', async () => {
  const sendMessage = jest.fn()
    .mockResolvedValueOnce({ response: { functionCalls: () => [{ name: 'retrieve', args: { query: 'x' } }], text: () => '' } })
    .mockResolvedValueOnce({ response: { functionCalls: () => [], text: () => 'final answer' } });
  const model = { startChat: () => ({ sendMessage }) };

  const chat = makeChatFromModel(model);
  const first = await chat.send([{ text: 'hi' }]);
  expect(first.functionCalls).toEqual([{ name: 'retrieve', args: { query: 'x' } }]);
  expect(first.text).toBeNull();

  const second = await chat.send([{ functionResponse: { name: 'retrieve', response: {} } }]);
  expect(second.functionCalls).toBeNull();
  expect(second.text).toBe('final answer');
});

test('handles SDKs where functionCalls() returns undefined', async () => {
  const sendMessage = jest.fn().mockResolvedValue({ response: { functionCalls: () => undefined, text: () => 'plain' } });
  const model = { startChat: () => ({ sendMessage }) };
  const chat = makeChatFromModel(model);
  const out = await chat.send([{ text: 'hi' }]);
  expect(out.functionCalls).toBeNull();
  expect(out.text).toBe('plain');
});
