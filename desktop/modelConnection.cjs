function textPart(part) {
  if (typeof part === 'string') return part;
  if (part?.type === 'text' || part?.type === 'output_text') return typeof part.text === 'string' ? part.text : part.text?.value || '';
  return '';
}

function visibleReply(payload) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(textPart).filter(Boolean).join('\n').trim();
  if (typeof choice?.text === 'string') return choice.text.trim();
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  return Array.isArray(payload?.output)
    ? payload.output.flatMap((item) => item?.content || []).map(textPart).filter(Boolean).join('\n').trim()
    : '';
}

async function testModelConnection({ baseUrl, model, apiKey }, request = fetch) {
  const url = new URL(baseUrl);
  const base = url.pathname.replace(/\/+$/, '');
  url.pathname = base.endsWith('/chat/completions') ? base : `${base || '/v1'}/chat/completions`;
  for (const maxTokens of [256, 1024]) {
    const response = await request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '请回复 OK' }], max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`连接测试失败，服务返回 HTTP ${response.status}。`);
    let payload;
    try { payload = await response.json(); } catch { throw new Error('连接测试失败，服务未返回有效 JSON。'); }
    if (visibleReply(payload)) return;
    if (payload?.choices?.[0]?.finish_reason !== 'length') break;
  }
  throw new Error('连接测试失败，模型没有返回可显示的文本。');
}

module.exports = { testModelConnection, visibleReply };
