# dsh-code-style

把 `code-style` 技能打包成 DSH 插件。安装后，`code-style` 会作为技能出现在 DSH 技能目录中；模型编写、重构、审查代码时可以加载它，用户也可以显式调用。

这是一个 **Host-only 技能提供方 bundle**：没有客户端代码、没有第三方依赖、没有构建步骤。

仓库地址：<https://github.com/qzbxxx/dsh-code-style>

## 提供的能力

- 注册技能 `code-style`，`source` 为 `plugin`，并声明 `resourceBase` 指向包内 `assets/`。
- 技能正文来自 `assets/SKILL.md`，内容遵循“可读性优先”：减少封装与嵌套、注释用中文、输出完整代码并说明修改点。
- 提供插件管理页需要的元数据：中英文标题/描述和图标。
- 正文在首次 `list()` 或 `get()` 时读取并缓存，升级技能只需要替换 `assets/SKILL.md` 后重载插件。

## 目录结构

```text
dsh-code-style/
├─ index.js                 # Cordis 插件入口：注册技能 provider
├─ cordis.patch.yml         # bundle 插入的插件行
├─ package.json             # 清单 + dsh.bundle.patch
├─ assets/SKILL.md          # 技能正文与 frontmatter
├─ locale/en.json           # 插件管理页英文元数据
├─ locale/zh.json           # 插件管理页中文元数据
├─ icon.svg                 # 插件图标（512 B）
├─ test/plugin.test.mjs     # 无依赖 smoke test
├─ README.md
└─ LICENSE
```

## 安装

1. 克隆仓库到本地：

   ```bash
   git clone https://github.com/qzbxxx/dsh-code-style.git
   ```

2. 打开 DSH 的插件管理界面。
3. 选择“从本地目录安装 / Install bundle”，目标目录选择克隆下来的 `dsh-code-style` 目录。
4. 确认安装后的 bundle 已启用。新增 bundle 通常可以 HMR 生效；如果技能目录没有刷新，重启 DSH。
5. 在技能列表中应该看到“代码风格 / Code Style”，技能名为 `code-style`。

如果当前会话有 `plugin_manager` 工具，应使用它的 `install_bundle`（`target` 传克隆目录的绝对路径），不要手写 profile 的 `package.json` 或 `cordis.patch.yml`，也不要在 profile 目录里跑 pnpm。

## 验证

- 技能目录出现 `code-style`，描述以“按‘可读性优先’……”开头。
- 让 agent“按 code-style 重构这段代码”，应能看到 `<skill_content name="code-style">` 被加载。
- 插件管理页显示中文标题“代码风格”和图标。

命令行 smoke test（不依赖 DSH 运行时）：

```bash
cd dsh-code-style
node test/plugin.test.mjs
```

测试会模拟 `skills` 服务，检查 provider 注册、candidate 元数据和去掉 frontmatter 后的正文。

> 在 DSH 沙箱里直接跑 `node --test` 会因测试运行器启动子进程而报 `spawn EPERM`，所以这里直接执行测试文件。

## 与用户目录同名技能的关系

DSH 文件系统技能按 rank 数字升序决定同名优先级：

| 来源 | rank |
| --- | --- |
| 项目 `.dsh/skills` | 100 |
| 项目 `.agents/skills` | 200 |
| 自定义 | 300 |
| 用户 `~/.dsh/skills` | 400 |
| 用户 `~/.agents/skills` | 500 |
| 打包/插件技能 | 600 |

本插件使用 600，因此 `~/.dsh/skills/code-style`（400）会覆盖插件提供的正文。这符合“本地自定义优先”的预期。

- 想让插件版本生效：暂时移除或重命名本地同名技能。
- 想让插件强制覆盖本地技能：把 `index.js` 里的 `SKILL_RANK` 改成 300 以下，重启 DSH。
- 用户显式调用技能时，注册表会按最终胜出的版本加载。

## 自定义

- **只改技能正文**：编辑 `assets/SKILL.md`，保留开头 `---` frontmatter 里的 `name`、`description`、`whenToUse`。
- **改技能名**：同时修改 frontmatter 的 `name`、`index.js` 的 `PROVIDER_NAME`，以及 `cordis.patch.yml` 的插件 id，避免与已有插件冲突。
- **frontmatter 限制**：解析器只支持单行 `key: value`，不支持 YAML 多行块。描述里如果有冒号，用单引号或双引号把整个值包住。
- **正文格式**：frontmatter 之后的内容会原样成为技能正文，首尾空白会被去掉。

## 设计说明

为什么用 `registerProvider` 而不是 `ctx.skills.register()`：

- provider 可以声明 `resourceBase`，技能正文里的相对路径能解析到 `assets/`。
- provider 可以设置 `source`、`rank`，行为和 DSH 自带技能一致；`register()` 固定落在 runtime 层（rank 250），会反过来覆盖用户目录技能。
- 正文从文件读取，升级技能不需要改 JavaScript。

为什么 rank 是 600：技能包里打包的技能属于“默认值”，应让用户目录的自定义版本优先。这是 DSH 自身 `dsh-skill-badge`、`dsh-skill-office` 等打包技能的选择。

## 兼容性风险

- 插件依赖 `@deepseek-ai/dsh-skill` 提供的 `skills` 服务；本包不直接 import 它，因此安装到 profile 时不需要额外依赖。
- `source: "plugin"` 目前不是 DSH 文件系统 provider 的内置来源名，但 `SkillCandidate.source` 只要求是字符串，可以安全使用。
- 如果未来 `@deepseek-ai/dsh-skill` 收紧 provider 校验（例如限制 `source` 枚举或 rank 范围），需要同步调整 `index.js`。
- 替换已安装包后需要重启 DSH 才能加载新的 JavaScript 模块；只改 `assets/SKILL.md` 时也要重启或触发插件重载，因为正文在首次加载后会缓存。

## License

MIT
