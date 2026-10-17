# IaC Cloud Architecture Visualizer 使用说明

将 Terraform/OpenTofu 的 **`show -json` 输出**转换为原生、可编辑的 diagrams.net 架构图。默认在本地处理，不执行 Terraform、不访问 AWS API、不上传 IaC 数据。

## 安装与运行

需要 Node.js 22 或 24、pnpm 9.15.9。处理已有 JSON 不需要 Python、Terraform、AWS CLI 或 AWS 凭据。

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm iacviz generate --input fixtures/dataset-01-network/plan.json --view all --output out/architecture.drawio
pnpm iacviz inspect --input fixtures/dataset-01-network/plan.json
pnpm iacviz validate --input fixtures/dataset-01-network/plan.json
```

在 diagrams.net 中选择「文件 → 从设备打开」，打开生成的文件。`--view all` 包含 Overview 和 Network 两页。节点、容器、文字与连接线是原生对象；资源地址及筛选后的元数据可在节点数据中查看。AWS 服务以带 diagrams.net aws4 图标的卡片显示，VPC/子网使用 AWS 分组样式边框；当子网记录了可用区时，Network 页按 AZ 分列显示。全部 9 个示例已在 app.diagrams.net 中打开并检查（页面、连线端点、可移动/可编辑、保存后元数据），详见 [draw.io 导出与验收](docs/drawio-export.md)。A4/A3 打印可读性仍需人工确认。

开发模式与其他示例：

```powershell
pnpm dev generate --input fixtures/dataset-02-three-tier/plan.json --view overview --output out/overview.drawio
pnpm iacviz generate --input fixtures/dataset-07-multi-subnet/plan.json --view network --direction TOP_TO_BOTTOM --output out/network.drawio
pnpm examples
pnpm verify:drawio
pnpm bench
```

含空格的路径需要引号。Linux/macOS 使用相同单行命令。

## 输入文件

自行从已有状态或已保存的计划导出：

```powershell
terraform show -json saved.tfstate > state.json
terraform show -json saved.tfplan > plan.json
# OpenTofu：tofu show -json saved.tfplan > plan.json
```

PowerShell 7 默认输出 UTF-8。Windows PowerShell 5.1 请使用 `terraform show -json saved.tfplan | Set-Content -Encoding UTF8 plan.json`；程序支持 UTF-8 BOM。直接读取原始 `.tfstate` 的 JSON 不属于支持范围。支持 `format_version` 1.x，拒绝未知主版本，不依赖文件名。两种引擎的 JSON 结构相似，无法可靠识别时标记 `unknown`。

State 只是记录中的状态，可能过期或存在 Drift。Plan 表示计划结果，资源 ID 可能未知。明确配置引用可以保留为推断关系；多实例无法唯一匹配时保持未解决并给出警告。`depends_on` 只是 IaC 依赖，不表示网络绑定或业务通信。替换动作保留原始顺序。工具不会执行部署。

## 视图与配置

Overview 隐藏部分底层配置以降低复杂度，但 Graph Core 保留资源。Network 展示更多网络、安全与路由资源。ALB 等跨子网资源在证据充分时放入共同 VPC；不能确定时放在图的根层。S3/IAM 不强行塞入 VPC。不会猜测 ECS 到 RDS 的业务调用。

`--config diagram.json` 支持以下结构：

```json
{
  "schemaVersion": "1.0",
  "view": "network",
  "layout": { "direction": "LEFT_TO_RIGHT", "spacing": 40, "nodeSpacing": 40 },
  "hiddenResourceAddresses": [],
  "collapsedGroups": [],
  "manualPositions": {},
  "annotations": []
}
```

CLI 显式指定的视图、方向优先。隐藏资源与布局间距会生效；折叠、人工位置和注释目前仅预留 Schema，非空时会警告，尚无完整图形编辑器。

## 安全、验证与限制

属性通过显式白名单进入中间模型，结合敏感标记和额外测试秘密检测。嵌套字段存在敏感标记时保守过滤；不复制原始 outputs、配置常量、完整 values。XML 使用成熟库生成，标签采用纯文本。未标记的秘密无法全部识别，分享前仍需复核；Terraform 导出的原始 JSON 可能包含明文秘密，应妥善保管。

目前是可运行的 MVP 基线，尚未完成全部验收：更多同构聚合策略、部分高级路由推导、历史/deposed 对象、人工布局仍待增强。AWS 图标仅使用 2026-10-17 在 app.diagrams.net 中确认存在的模具名称；旧版和离线版 diagrams.net 未经验证（即使图标缺失，卡片文字仍可阅读）。大图打印可能跨页。未知资源以通用节点保留。

详见 [开发结果](docs/development-report.md)、[限制](docs/limitations.md)、[安全说明](docs/security.md)、[性能实测](docs/performance-results.json)。九组数据集参与回归测试；08 为确定性的 200 资源合成样本。原有样本来源见各目录 PROVENANCE.json，本轮未重新运行 Terraform 核验原有来源声明。GitHub Actions 在 Windows/Linux/macOS × Node 22/24 的全部 6 个任务已通过（2026-10-17）。

扩展 AWS 规则应修改独立 providers-aws 层，避免把业务语义写入 XML。开发、模型与路线图见 docs 目录。预期以 Apache-2.0 发布，许可证见 LICENSE。
