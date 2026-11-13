# TFIIF2026_LY

在用户原始截图上直接增加局部交互的个人原型工程。

工作台地址：http://127.0.0.1:5173/ 。选择 TFIIF2026_LY → 建模中心 → 生产结构管理-优化。

页面默认直接展示原截图，右上角新增「列表 / 卡片」按钮。点击卡片，只将原参数表区域替换为卡片；点击列表恢复原截图。卡片区域可滚动，包含原截图当前页的17条参数和全部字段。

其他区域继续使用原截图，不重做树、搜索、页签、编辑、趋势分析或分页。卡片上的编辑、趋势分析保留入口视觉。

- pages/production-structure.tsx：页面、截图底图与两个交互热区。
- pages/production-structure.css：新增控件和卡片的局部样式。
- data/parameters.ts：从原截图整理的17条参数。
- pages/production-structure.annotations.json：保留的用户手动标注；默认不自动编写内容。
- references/参数管理原始截图.png：用户原图，1909×910。
- docs/：需求、样式和验收说明。

修改前的完整重建版本已备份到 .history/full-page-before-screenshot-revision.zip。当前卡片效果见 references/截图局部卡片验收.jpg。

工程独立维护 Git 仓库：https://github.com/Lyon-Dady/TFIIF2026_LY 。本地历史备份、旧版验收图、依赖、构建产物和本机配置由 .gitignore 排除。

后续截图按当次需求作为风格参考、功能参考或页面底图，不固定默认用途；仅在明确要求时重建整页。标注仅在明确要求后，按用户提供的提示词与规范编写。
