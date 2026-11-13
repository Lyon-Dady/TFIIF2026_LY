export type WarningMode = 'state' | 'edge' | 'duration' | 'pulse' | 'count' | 'total' | 'ratio';
export type TimeUnit = '秒' | '分' | '时' | '日';
export interface TimeValue { value: number | null; unit: TimeUnit }
export interface InputSource { type: 'point' | 'upstream'; name: string; code: string }
export interface WarningConfig {
  name: string; mode: WarningMode; input: InputSource | null;
  target: 0 | 1; direction: 'any' | 'rising' | 'falling';
  duration: TimeValue; window: TimeValue; hold: TimeValue; maxGap: TimeValue;
  compare: 'gte' | 'lte'; threshold: number | null;
}
export const warningModes: { value: WarningMode; label: string; description: string }[] = [
  { value: 'state', label: '状态命中', description: '输入值等于目标状态时输出 1，否则输出 0。' },
  { value: 'edge', label: '状态跳变', description: '相邻有效值发生指定方向的跳变时触发，首次取值不算跳变。' },
  { value: 'duration', label: '连续状态超时', description: '目标状态连续保持达到阈值时触发，中途改变状态后重新计时。' },
  { value: 'pulse', label: '短时脉冲', description: '捕获完整脉冲后，保持时长小于阈值时触发；等于阈值不触发。' },
  { value: 'count', label: '窗口跳变次数', description: '在最近一个完整时间窗口内，统计指定方向的跳变次数。' },
  { value: 'total', label: '窗口累计时长', description: '累计时间窗口内目标状态的保持时长，允许中途被另一状态打断。' },
  { value: 'ratio', label: '窗口状态占比', description: '按目标状态累计时长除以窗口时长计算占比，不按采样点数量计算。' },
];
export const directionOptions = [
  { value: 'any', label: '任意跳变' }, { value: 'rising', label: '0 → 1' }, { value: 'falling', label: '1 → 0' },
];
export const measurementOptions: InputSource[] = [
  { type: 'point', name: '开关量测点 A', code: 'DI_001' },
  { type: 'point', name: '开关量测点 B', code: 'DI_002' },
  { type: 'point', name: '模型开关量输出', code: 'MODEL_STATUS_01' },
];
export const upstreamOption: InputSource = { type: 'upstream', name: '这是输入参数', code: 'Value.OUT' };
export const seconds = (v: TimeValue) => (v.value ?? 0) * ({ 秒: 1, 分: 60, 时: 3600, 日: 86400 }[v.unit]);
export const timeText = (v: TimeValue) => `${v.value ?? '—'} ${v.unit}`;
export const windowMode = (m: WarningMode) => ['count', 'total', 'ratio'].includes(m);
export const eventMode = (m: WarningMode) => m === 'edge' || m === 'pulse';
export function defaultConfig(index: number): WarningConfig {
  return { name: index === 1 ? '开关量预警' : `开关量预警 ${index}`, mode: 'duration', input: null,
    target: 1, direction: 'any', duration: { value: 60, unit: '秒' },
    window: { value: 300, unit: '秒' }, hold: { value: 1, unit: '秒' },
    maxGap: { value: 5, unit: '秒' }, compare: 'gte', threshold: 120 };
}
export function changeMode(config: WarningConfig, mode: WarningMode): WarningConfig {
  return { ...config, mode, duration: { value: mode === 'pulse' ? 2 : 60, unit: '秒' },
    window: { value: mode === 'count' ? 60 : 300, unit: '秒' },
    compare: 'gte', threshold: mode === 'count' ? 5 : mode === 'ratio' ? 80 : 120 };
}
export function ruleSummary(c: WarningConfig): string {
  const compare = c.compare === 'gte' ? '≥' : '≤';
  const direction = directionOptions.find(o => o.value === c.direction)!.label;
  switch (c.mode) {
    case 'state': return `输入状态为 ${c.target} 时，预警结果为 1。`;
    case 'edge': return `发生${direction === '任意跳变' ? direction : ` ${direction} 跳变`}时触发，结果保持 ${timeText(c.hold)}。`;
    case 'duration': return `状态为 ${c.target}，连续保持 ≥ ${timeText(c.duration)} 时触发。`;
    case 'pulse': return `状态 ${c.target} 的完整保持时长 < ${timeText(c.duration)} 时触发。`;
    case 'count': return `最近 ${timeText(c.window)}，${direction}次数 ${compare} ${c.threshold ?? '—'} 次时触发。`;
    case 'total': return `最近 ${timeText(c.window)}，状态 ${c.target} 累计时长 ${compare} ${c.threshold ?? '—'} 秒时触发。`;
    case 'ratio': return `最近 ${timeText(c.window)}，状态 ${c.target} 时间占比 ${compare} ${c.threshold ?? '—'}% 时触发。`;
  }
}
export function configErrors(c: WarningConfig, usedNames: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = c.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 50) errors.name = '请输入 1～50 个字符的名称';
  else if (usedNames.includes(name)) errors.name = '当前画布已有同名节点，请修改名称';
  if (!c.input) errors.input = '请选择开关量测点或上游输入';
  const checkTime = (field: 'duration' | 'window' | 'hold' | 'maxGap') => {
    const v = c[field];
    if (v.value === null || !Number.isInteger(v.value) || seconds(v) < 1 || seconds(v) > 2592000) errors[field] = '请输入正整数，换算后为 1 秒～30 天';
  };
  checkTime('maxGap');
  if (c.mode === 'duration' || c.mode === 'pulse') checkTime('duration');
  if (eventMode(c.mode)) checkTime('hold');
  if (windowMode(c.mode)) {
    checkTime('window');
    const n = c.threshold;
    if (n === null || !Number.isFinite(n) || n < 0) errors.threshold = '请输入有效的非负阈值';
    else if (c.mode === 'count' && (!Number.isInteger(n) || n > 1000000 || c.compare === 'gte' && n < 1)) errors.threshold = c.compare === 'gte' ? '请输入 1～1000000 的整数' : '请输入 0～1000000 的整数';
    else if (c.mode === 'total' && (!Number.isInteger(n) || n > seconds(c.window))) errors.threshold = '累计时长须为整数秒，且不能超过统计窗口';
    else if (c.mode === 'ratio' && (n > 100 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7)) errors.threshold = '请输入 0～100，最多两位小数';
  }
  return errors;
}
