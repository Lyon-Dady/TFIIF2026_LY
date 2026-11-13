import { useState } from 'react';
import { AppstoreOutlined, ExportOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { ScreenshotStage, usePrototype } from '@workbench';
import { parameters } from '../data/parameters';
import './production-structure.css';

export const meta = {
  id: 'production-structure-optimized',
  title: '生产结构管理-优化',
  module: '建模中心',
  moduleOrder: 10,
  order: 10,
  description: '直接在原始截图上增加列表与卡片切换，仅替换参数列表区域。',
  tags: ['生产结构', '参数管理', '截图', '卡片'],
  version: '1.1',
};
export const annotationFile = './production-structure.annotations.json';

export default function ProductionStructure() {
  const { asset } = usePrototype();
  const [view, setView] = useState<'list' | 'card'>('list');
  const [selected, setSelected] = useState<string[]>([]);

  return <div className="ly-shot-page">
    <ScreenshotStage
      src={asset('references/参数管理原始截图.png')}
      width={1909}
      height={910}
      hotspots={[
        {
          id: 'parameter-view-switch', x: 1734, y: 130, width: 156, height: 32,
          content: <div className="ly-shot-switch" role="group" aria-label="参数视图切换">
            <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><UnorderedListOutlined />列表</button>
            <button type="button" aria-pressed={view === 'card'} className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}><AppstoreOutlined />卡片</button>
          </div>,
        },
        ...(view === 'card' ? [{
          id: 'parameter-cards', x: 474, y: 171, width: 1416, height: 684,
          content: <section className="ly-shot-card-area" aria-label="参数卡片视图">
            <div className="ly-shot-card-grid">
              {parameters.map((parameter, index) => <article key={parameter.code} className={'ly-shot-card' + (selected.includes(parameter.code) ? ' selected' : '')} aria-label={`参数卡片 ${parameter.name}`}>
                <div className="ly-shot-card-heading"><span>序号 {String(index + 1).padStart(2, '0')}</span><input type="checkbox" aria-label={`选择参数 ${parameter.code}`} checked={selected.includes(parameter.code)} onChange={event => setSelected(previous => event.target.checked ? [...previous, parameter.code] : previous.filter(code => code !== parameter.code))} /></div>
                <h3>{parameter.name}</h3>
                <dl>
                  <div className="ly-shot-full-field"><dt>参数编码</dt><dd className="ly-shot-code">{parameter.code}</dd></div>
                  <div><dt>参数类型</dt><dd><ExportOutlined /> 模型输出 <span className="ly-shot-arrow">↗</span></dd></div>
                  <div><dt>单位</dt><dd>-</dd></div>
                  <div><dt>规则指导类型</dt><dd>{parameter.rule ? <span className="ly-shot-rule">{parameter.rule}</span> : '-'}</dd></div>
                  <div><dt>报警级别</dt><dd>{parameter.alarm || '-'}</dd></div>
                  <div className="ly-shot-full-field"><dt>关联生产结构</dt><dd>哈轴</dd></div>
                </dl>
                <div className="ly-shot-card-actions" aria-label="原有操作入口"><span>编辑</span><i /><span>趋势分析</span></div>
              </article>)}
            </div>
          </section>,
        }] : []),
      ]}
    />
  </div>;
}
