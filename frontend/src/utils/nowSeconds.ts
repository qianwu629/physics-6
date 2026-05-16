/**
 * 共享的"当前时间(秒)" helper
 *
 * W-04 fix:
 * 之前 ChartSampler 与 ChartCanvas 各自独立调用 Date.now()/1000,
 * C-01 时间基准不一致 bug 因此能溜过测试。本 helper 把"现在"集中到一处,
 * 测试可 vi.spyOn(nowSeconds) 校验写入侧与读取侧使用同一时间源。
 *
 * 语义: Unix epoch seconds (与 lightweight-charts 的 UTCTimestamp 对齐)。
 */

export function nowSeconds(): number {
  return Date.now() / 1000;
}
