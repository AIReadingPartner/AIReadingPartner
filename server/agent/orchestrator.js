// Drive a chat adapter through a bounded function-calling loop.
// chat.send(parts) -> { functionCalls: [{name,args}]|null, text: string|null }
const runAgent = async ({ chat, handlers, userTurn, maxSteps = 5 }) => {
  const toolTrace = [];
  const citations = [];
  const addCitations = (arr) => {
    for (const i of arr || []) if (!citations.includes(i)) citations.push(i);
  };

  let response = await chat.send([{ text: userTurn }]);
  let steps = 0;

  while (steps < maxSteps) {
    const calls = response.functionCalls || [];
    if (calls.length === 0) {
      return { answer: response.text || '', citations, toolTrace, steps };
    }

    const parts = [];
    for (const call of calls) {
      const handler = handlers[call.name];
      const result = handler
        ? await handler(call.args || {})
        : { error: `unknown tool: ${call.name}` };
      addCitations(result.citations || result.indices);
      toolTrace.push({ tool: call.name, args: call.args, result });
      parts.push({ functionResponse: { name: call.name, response: result } });
    }

    steps += 1;
    response = await chat.send(parts);
  }

  // Hit the step ceiling. Return whatever text the model last produced, else a notice.
  const answer = (response.functionCalls && response.functionCalls.length)
    ? 'Reached step limit before completing.'
    : (response.text || 'Reached step limit before completing.');
  return { answer, citations, toolTrace, steps };
};

module.exports = { runAgent };
