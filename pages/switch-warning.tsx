import { useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { App as AntApp, Button, Collapse, Empty, Input, InputNumber, Modal, Radio, Segmented, Select, Space, Table, Tag, Tooltip } from 'antd';
import { ApartmentOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, DisconnectOutlined, ExportOutlined, ImportOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { FieldLabel, ScreenshotStage, usePrototype } from '@workbench';
import { changeMode, configErrors, defaultConfig, directionOptions, eventMode, measurementOptions, ruleSummary, seconds, upstreamOption, warningModes, windowMode, type InputSource, type TimeUnit, type TimeValue, type WarningConfig, type WarningMode } from '../data/switch-warning-config';
import './switch-warning.css';

export const meta = {
  id: 'switch-warning-operator',
  title: '智能模型-新增算子',
  module: '应用创建中心',
  moduleOrder: 20,
  order: 10,
  description: '开关量预警算子：在原截图上拖入节点并配置属性。',
  tags: ['开关量预警算子', '数学函数', '时序函数', 'SC-PC'],
  version: '1.0',
};

interface WarningNode { id: number; x: number; y: number; config: WarningConfig }
const WIDTH = 1907;
const HEIGHT = 910;
const CANVAS = { x: 535, y: 160, width: 980, height: 670 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Field({ label, help, required, error, children }: { label: string; help: string; required?: boolean; error?: string; children: ReactNode }) {
  return <div className={'ly-warning-field' + (error ? ' has-error' : '')}>
    <div className="ly-warning-label">{required && <span className="ly-warning-required">*</span>}<FieldLabel label={label} help={help} /></div>
    {children}
    {error && <div className="ly-warning-error" role="alert">{error}</div>}
  </div>;
}

function TimeInput({ label, value, onChange }: { label: string; value: TimeValue; onChange: (value: TimeValue) => void }) {
  return <div className="ly-warning-time-input">
    <InputNumber aria-label={label} value={value.value} controls={false} min={1} max={2592000} precision={0} onChange={next => onChange({ ...value, value: next })} />
    <Select aria-label={`${label}单位`} value={value.unit} onChange={(unit: TimeUnit) => onChange({ ...value, unit })} options={['秒', '分', '时', '日'].map(unit => ({ value: unit, label: unit }))} />
  </div>;
}

export default function SwitchWarningOperator() {
  const { asset } = usePrototype();
  const { message, modal } = AntApp.useApp();
  const [nodes, setNodes] = useState<WarningNode[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<WarningConfig | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'point' | 'upstream'>('point');
  const [candidate, setCandidate] = useState<InputSource | null>(null);
  const [search, setSearch] = useState('');
  const serial = useRef(0);
  const moving = useRef<{ id: number; startX: number; startY: number; x: number; y: number; scale: number } | null>(null);
  const selected = nodes.find(node => node.id === selectedId);
  const usedNames = ['这是输入参数', 'TON', ...nodes.filter(node => node.id !== selectedId).map(node => node.config.name.trim().replace(/\s+/g, ' '))];
  const errors = draft ? configErrors(draft, usedNames) : {};
  const dirty = !!selected && !!draft && JSON.stringify(selected.config) !== JSON.stringify(draft);
  const displayedConfig = (node: WarningNode) => node.id === selectedId && draft ? draft : node.config;

  const checkLeave = (action: () => void) => {
    if (!dirty) return action();
    modal.confirm({ title: '放弃未应用的配置？', content: '当前修改尚未应用到节点。放弃后恢复上次配置。', okText: '放弃修改', cancelText: '继续编辑', onOk: action });
  };
  const selectNode = (node: WarningNode) => {
    if (selectedId === node.id) return;
    checkLeave(() => { setSelectedId(node.id); setDraft(structuredClone(node.config)); setShowErrors(false); });
  };
  const closePanel = () => checkLeave(() => { setSelectedId(null); setDraft(null); setShowErrors(false); });
  const update = (changes: Partial<WarningConfig>) => setDraft(current => current ? { ...current, ...changes } : null);
  const addNode = (x: number, y: number) => {
    const id = ++serial.current;
    setNodes(current => [...current, { id, x: clamp(x, 20, CANVAS.width - 260), y: clamp(y, 70, CANVAS.height - 210), config: defaultConfig(id) }]);
  };
  const dropNode = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragOver(false);
    if (event.dataTransfer.getData('text/plain') !== 'ly-switch-warning') return;
    const rect = event.currentTarget.getBoundingClientRect(), scale = rect.width / CANVAS.width;
    addNode((event.clientX - rect.left) / scale - 112, (event.clientY - rect.top) / scale - 16);
  };
  const startMove = (event: PointerEvent<HTMLDivElement>, node: WarningNode) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const canvas = event.currentTarget.closest('.ly-warning-dropzone')!.getBoundingClientRect();
    moving.current = { id: node.id, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, scale: canvas.width / CANVAS.width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const info = moving.current;
    if (!info) return;
    setNodes(current => current.map(node => node.id === info.id ? { ...node, x: clamp(info.x + (event.clientX - info.startX) / info.scale, 20, CANVAS.width - 260), y: clamp(info.y + (event.clientY - info.startY) / info.scale, 70, CANVAS.height - 210) } : node));
  };
  const openPicker = () => {
    if (!draft) return;
    setCandidate(draft.input); setPickerType(draft.input?.type ?? 'point'); setSearch(''); setPickerOpen(true);
  };
  const applyInput = () => {
    if (!candidate) return;
    const commit = () => { update({ input: candidate }); setPickerOpen(false); };
    if (draft?.input && draft.input.type !== candidate.type) modal.confirm({ title: '替换当前输入来源？', content: `确认将“${draft.input.name}”替换为“${candidate.name}”。每个算子只接收一路开关量。`, okText: '替换', cancelText: '取消', onOk: commit });
    else commit();
  };
  const applyConfig = () => {
    if (!draft || !selected) return;
    setShowErrors(true);
    if (Object.keys(errors).length) { void message.error('请检查标红的配置项'); return; }
    const config = { ...draft, name: draft.name.trim().replace(/\s+/g, ' ') };
    setNodes(current => current.map(node => node.id === selectedId ? { ...node, config } : node));
    setDraft(config); setShowErrors(false); void message.success('配置已应用到当前节点');
  };
  const deleteNode = () => {
    modal.confirm({ title: '删除当前开关量预警算子？', content: '同时移除该节点的输入连线。', okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => { setNodes(current => current.filter(node => node.id !== selectedId)); setSelectedId(null); setDraft(null); } });
  };
  const visibleParameters = (pickerType === 'point' ? measurementOptions : [upstreamOption]).filter(point => `${point.name} ${point.code}`.toLowerCase().includes(search.toLowerCase().trim()));
  const modeInfo = warningModes.find(mode => mode.value === draft?.mode);

  return <div className="ly-warning-page">
    <nav className="ly-warning-page-tabs" aria-label="智能模型新增算子页面"><button type="button" aria-current="page">开关量预警算子</button></nav>
    <ScreenshotStage src={asset('references/智能模型-时序函数原始截图.png')} width={WIDTH} height={HEIGHT} hotspots={[
      { id: 'switch-warning-toolbox-entry', x: 1526, y: 699, width: 348, height: 173, content: <div className="ly-warning-toolbox-bottom"><div className="ly-warning-entry-area"><button type="button" className="ly-warning-toolbox-item" draggable aria-label="拖入开关量预警算子" onDragStart={event => { event.dataTransfer.setData('text/plain', 'ly-switch-warning'); event.dataTransfer.effectAllowed = 'copy'; }} onDoubleClick={() => addNode(470 + nodes.length * 20, 320)} onKeyDown={event => { if (event.key === 'Enter') addNode(470 + nodes.length * 20, 320); }}><span className="ly-warning-function-icon">⌁</span>开关量预警</button></div><div className="ly-warning-original-categories" aria-hidden="true" style={{ backgroundImage: `url("${asset('references/智能模型-时序函数原始截图.png')}")` }} /></div> },
      { id: 'switch-warning-canvas', ...CANVAS, content: <div className={'ly-warning-dropzone' + (dragOver ? ' drag-over' : '')} aria-label="开关量预警算子画布" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={dropNode} onClick={closePanel}>
        {dragOver && <div className="ly-warning-drop-hint"><PlusOutlined />松开以添加开关量预警算子</div>}
        <svg className="ly-warning-wires" viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} aria-label="新增算子输入连线"><defs><marker id="ly-warning-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#80a6ff" /></marker></defs>{nodes.filter(node => displayedConfig(node).input?.type === 'upstream').map(node => <path key={node.id} d={`M417,208 C${Math.max(440, node.x - 50)},208 ${node.x - 70},${node.y + 91} ${node.x},${node.y + 91}`} markerEnd="url(#ly-warning-arrow)" />)}</svg>
        {nodes.map(node => { const config = displayedConfig(node); const active = node.id === selectedId; return <article key={node.id} className={'ly-warning-node' + (active ? ' selected' : '')} style={{ left: node.x, top: node.y }} aria-label={`算子节点 ${config.name}`}>
          <div className="ly-warning-node-heading" onPointerDown={event => startMove(event, node)} onPointerMove={move} onPointerUp={event => { moving.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { moving.current = null; }} onClick={event => { event.stopPropagation(); selectNode(node); }}><span className="ly-warning-function-icon">⌁</span>开关量预警</div>
          <button type="button" className="ly-warning-node-body" aria-label={`打开 ${config.name} 属性面板`} onClick={event => { event.stopPropagation(); selectNode(node); }}><strong>{config.name || '开关量预警'}</strong><div className="ly-warning-node-ports"><div><span><ImportOutlined /> IN</span><em className={config.input ? '' : 'unconfigured'}>{config.input ? config.input.type === 'upstream' ? '上游输入' : '测点输入' : '请选择输入'}</em></div><div><span><ExportOutlined /> OUT</span><em>预警结果</em></div></div><small>{warningModes.find(item => item.value === config.mode)?.label}</small></button>
          {active && <><span className="ly-warning-port port-top" /><span className="ly-warning-port-label label-top">流程判断</span><span className="ly-warning-port port-left" /><span className="ly-warning-port-label label-left">开关量输入</span><span className="ly-warning-port port-right" /><span className="ly-warning-port-label label-right">预警结果</span></>}
        </article>; })}
      </div> },
      ...(draft && selected ? [{ id: 'switch-warning-properties', x: 1525, y: 108, width: 351, height: 764, content: <section className="ly-warning-properties" aria-label="开关量预警属性框" onClick={event => event.stopPropagation()}>
        <header><strong>属性框</strong><Tooltip title="关闭属性框，返回功能块"><Button type="text" icon={<CloseOutlined />} aria-label="关闭属性框" onClick={closePanel} /></Tooltip></header>
        <div className="ly-warning-properties-scroll">
          <Field label="功能块名称" required help="用于识别当前画布节点，最多 50 个字符，同一画布内不能重名。" error={showErrors ? errors.name : undefined}><Input aria-label="功能块名称" maxLength={50} value={draft.name} onChange={event => update({ name: event.target.value })} /></Field>
          <Field label="输入参数" required help="绑定一个时序开关量测点，或选择一路上游开关量输入。两种来源互斥，输入值为 0 / 1。" error={showErrors ? errors.input : undefined}>
            <div className="ly-warning-source"><button type="button" className={draft.input?.type === 'upstream' ? 'upstream' : ''} aria-label="选择输入参数" onClick={draft.input?.type === 'upstream' ? undefined : openPicker} disabled={draft.input?.type === 'upstream'}><span>{draft.input?.name || '请选择参数'}</span><span>···</span></button>{draft.input && <Tooltip title={draft.input.type === 'upstream' ? '断开上游输入' : '清除测点绑定'}><Button type="text" size="small" aria-label="清除输入来源" icon={draft.input.type === 'upstream' ? <DisconnectOutlined /> : <CloseOutlined />} onClick={() => update({ input: null })} /></Tooltip>}</div>
            {draft.input && <div className="ly-warning-source-info">{draft.input.type === 'upstream' ? '由上游连线赋值 · 断开后可重新配置' : `${draft.input.code} · 时序 / 开关量`}</div>}
          </Field>
          <Field label="预警模式" required help="选择一种数学判定模式；切换后使用对应默认阈值，不改变输入来源和节点端口。"><Select aria-label="预警模式" value={draft.mode} onChange={(mode: WarningMode) => { setDraft(changeMode(draft, mode)); setShowErrors(false); }} options={warningModes.map(mode => ({ value: mode.value, label: mode.label }))} /></Field>
          {!['edge', 'count'].includes(draft.mode) && <Field label="目标状态" required help="指定要监测的状态，0 和 1 的实际业务含义由所选输入定义。"><Radio.Group aria-label="目标状态" value={draft.target} onChange={event => update({ target: event.target.value as 0 | 1 })}><Radio value={0}>0</Radio><Radio value={1}>1</Radio></Radio.Group></Field>}
          {['edge', 'count'].includes(draft.mode) && <Field label="跳变方向" required help="0→1 为上升沿，1→0 为下降沿，任意跳变同时统计两个方向；首次输入不算跳变。"><Select aria-label="跳变方向" value={draft.direction} options={directionOptions} onChange={direction => update({ direction })} /></Field>}
          {['duration', 'pulse'].includes(draft.mode) && <Field label={draft.mode === 'pulse' ? '脉冲时长阈值' : '持续时间'} required help={draft.mode === 'pulse' ? '完整脉冲时长严格小于此值时触发，必须观察到进入和离开目标状态。' : '连续保持达到此时长时触发；中途改变状态后重新计时。正整数，1 秒～30 天。'} error={showErrors ? errors.duration : undefined}><TimeInput label={draft.mode === 'pulse' ? '脉冲时长阈值' : '持续时间'} value={draft.duration} onChange={duration => update({ duration })} /></Field>}
          {windowMode(draft.mode) && <>
            <Field label="统计窗口" required help="每次观察最近这一段时间，按时间滚动，完整有效窗口形成后再判断。正整数，1 秒～30 天。" error={showErrors ? errors.window : undefined}><TimeInput label="统计窗口" value={draft.window} onChange={window => update({ window })} /></Field>
            <Field label={draft.mode === 'count' ? '跳变次数阈值' : draft.mode === 'total' ? '累计时长阈值' : '状态占比阈值'} required help={draft.mode === 'count' ? '至少支持 ≥1 次，或 ≤0 次表示完整窗口内无指定跳变。' : draft.mode === 'total' ? '按目标状态的累计保持秒数判断，阈值不能超过窗口时长。' : '按保持时长占比判断，范围 0～100%，最多两位小数。'} error={showErrors ? errors.threshold : undefined}><div className="ly-warning-threshold"><Select aria-label="比较方式" value={draft.compare} options={[{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }]} onChange={compare => update({ compare })} /><InputNumber aria-label="预警阈值" value={draft.threshold} min={0} max={draft.mode === 'ratio' ? 100 : draft.mode === 'total' ? seconds(draft.window) : 1000000} precision={draft.mode === 'ratio' ? 2 : 0} controls={false} onChange={threshold => update({ threshold })} /><span>{draft.mode === 'ratio' ? '%' : draft.mode === 'total' ? '秒' : '次'}</span></div></Field>
          </>}
          {eventMode(draft.mode) && <Field label="结果保持时间" required help="瞬时事件命中后结果为 1 的时长，再次命中后从最近一次事件重新计时。正整数，1 秒～30 天。" error={showErrors ? errors.hold : undefined}><TimeInput label="结果保持时间" value={draft.hold} onChange={hold => update({ hold })} /></Field>}
          <div className="ly-warning-rule-preview"><span>规则预览</span><p>{ruleSummary(draft)}</p></div>
          <Collapse ghost className="ly-warning-advanced" items={[{ key: 'advanced', label: '高级配置', children: <><Field label="最大无更新时长" required help="超过此时长无法确认输入有效时，结果标记为无效，不直接按 0 恢复。应大于来源正常更新间隔。" error={showErrors ? errors.maxGap : undefined}><TimeInput label="最大无更新时长" value={draft.maxGap} onChange={maxGap => update({ maxGap })} /></Field><p className="ly-warning-muted">数据中断后重新积累连续状态和窗口。重复时间戳不重复计数。</p></> }]} />
        </div>
        <div className="ly-warning-description">{modeInfo?.description}</div>
        <footer><Tooltip title="删除当前新增节点"><Button type="text" danger aria-label="删除当前算子" icon={<DeleteOutlined />} onClick={deleteNode} /></Tooltip><Space size={8}><Button onClick={closePanel}>取消</Button><Button type="primary" icon={<CheckOutlined />} onClick={applyConfig}>应用配置</Button></Space></footer>
      </section> }] : []),
    ]} />
    <Modal title="选择开关量输入" open={pickerOpen} width={720} okText="确定" cancelText="取消" okButtonProps={{ disabled: !candidate }} onOk={applyInput} onCancel={() => setPickerOpen(false)} maskClosable={false} className="ly-warning-input-modal">
      <Segmented aria-label="输入来源类型" value={pickerType} options={[{ value: 'point', label: '绑定测点' }, { value: 'upstream', label: '上游输入' }]} onChange={value => { setPickerType(value as 'point' | 'upstream'); setCandidate(null); setSearch(''); }} />
      <p className="ly-warning-picker-description">{pickerType === 'point' ? '从已有时序测点中选择一路开关量。以下为模拟测点。' : '选择截图中 Value 节点的开关量输出，确认后显示与新增节点的连线。'}</p>
      <Input aria-label="搜索输入参数" placeholder="搜索名称或编码" prefix={<SearchOutlined />} allowClear value={search} onChange={event => setSearch(event.target.value)} />
      <Table<InputSource> size="small" rowKey="code" dataSource={visibleParameters} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的开关量输入" /> }} rowSelection={{ type: 'radio', selectedRowKeys: candidate ? [candidate.code] : [], onChange: (_keys, rows) => setCandidate(rows[0] ?? null) }} onRow={record => ({ onClick: () => setCandidate(record), style: { cursor: 'pointer' } as CSSProperties })} columns={[{ title: '参数名称', dataIndex: 'name' }, { title: '编码 / 端口', dataIndex: 'code' }, { title: '数据类型', render: () => <Tag color="blue">开关量</Tag> }]} />
      <div className="ly-warning-picker-selected"><ApartmentOutlined />已选：{candidate ? `${candidate.name}（${candidate.code}）` : '未选择'}</div>
    </Modal>
  </div>;
}
