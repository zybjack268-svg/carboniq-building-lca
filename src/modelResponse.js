function textPart(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (part.type === "text" || part.type === "output_text") {
    return typeof part.text === "string" ? part.text : part.text?.value || "";
  }
  return "";
}

export function visibleModelText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(textPart).filter(Boolean).join("\n").trim();
    if (text) return text;
  }
  if (typeof choice?.text === "string" && choice.text.trim()) return choice.text.trim();
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (Array.isArray(data?.output)) {
    const text = data.output.flatMap((item) => item?.content || []).map(textPart).filter(Boolean).join("\n").trim();
    if (text) return text;
  }
  return "";
}

export function emptyModelResponseMessage(data) {
  const reason = data?.choices?.[0]?.finish_reason;
  if (reason === "length") return "模型两次用完输出额度仍未生成正文。可重新分析；若持续出现，请在模型服务商处降低思考预算，或改用能直接输出文本的模型。";
  if (reason === "content_filter") return "模型服务过滤了本次输出，请调整问题后重试。";
  if (reason === "tool_calls") return "模型只返回了工具调用，没有返回正文；当前接口未提供可显示的分析结果。";
  return "接口已响应，但没有返回可显示正文。请检查模型的 Chat Completions 兼容性和服务端返回格式。";
}
