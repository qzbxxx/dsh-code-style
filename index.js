import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// 技能正文和资源放在 assets 目录，安装后相对路径保持不变。
const ASSETS_DIRECTORY = fileURLToPath(new URL("./assets/", import.meta.url));
const SKILL_FILE = new URL("./assets/SKILL.md", import.meta.url);

// 提供方名称会出现在技能目录中，和技能名保持一致。
const PROVIDER_NAME = "code-style";

// 与 DSH 打包技能同层（600），低于用户目录技能（400）。
// rank 数字越小优先级越高，所以用户本地同名的 code-style 会覆盖插件正文，
// 这样“本地自定义优先”的预期不会被安装插件破坏。
const SKILL_RANK = 600;

// 缓存解析结果，避免每次 list/get 都读一次文件。
let skillCache;

// 只解析 SKILL.md 开头用 --- 包起来的简单 frontmatter。
// 这里故意不引入 YAML 库：当前字段只有 name/description/whenToUse，都是单行文本。
function parseSkillDocument(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) {
    throw new Error("assets/SKILL.md 缺少以 --- 包起来的 frontmatter");
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // 支持用单引号或双引号包住的值，方便以后写带冒号的描述。
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    fields[key] = value;
  }

  return {
    fields,
    body: text.slice(match[0].length).trim()
  };
}

async function loadSkill() {
  if (skillCache !== undefined) {
    return skillCache;
  }

  const raw = await readFile(SKILL_FILE, "utf8");
  const text = raw.replace(/^\uFEFF/, "");
  const { fields, body } = parseSkillDocument(text);

  if (fields.name !== PROVIDER_NAME) {
    throw new Error(`assets/SKILL.md 的 name 必须是 ${PROVIDER_NAME}，实际是 ${fields.name}`);
  }
  if (fields.description === undefined || fields.description.length === 0) {
    throw new Error("assets/SKILL.md 的 description 不能为空");
  }
  if (body.length === 0) {
    throw new Error("assets/SKILL.md 的正文不能为空");
  }

  skillCache = {
    name: fields.name,
    description: fields.description,
    whenToUse: fields.whenToUse,
    content: body
  };
  return skillCache;
}

function createInvocation() {
  return {
    modelInvocable: true,
    userInvocable: true
  };
}

function createResourceBase() {
  return {
    kind: "directory",
    path: ASSETS_DIRECTORY
  };
}

function createCandidate(skill) {
  const candidate = {
    name: skill.name,
    description: skill.description,
    invocation: createInvocation(),
    provider: PROVIDER_NAME,
    source: "plugin",
    resourceBase: createResourceBase(),
    rank: SKILL_RANK,
    locator: SKILL_FILE
  };

  if (skill.whenToUse !== undefined) {
    candidate.whenToUse = skill.whenToUse;
  }
  return candidate;
}

const provider = {
  name: PROVIDER_NAME,

  async list() {
    return [createCandidate(await loadSkill())];
  },

  async get() {
    const skill = await loadSkill();
    const definition = {
      name: skill.name,
      description: skill.description,
      invocation: createInvocation(),
      provider: PROVIDER_NAME,
      source: "plugin",
      resourceBase: createResourceBase(),
      content: skill.content
    };

    if (skill.whenToUse !== undefined) {
      definition.whenToUse = skill.whenToUse;
    }
    return definition;
  }
};

export const inject = ["skills"];
export const name = "dsh-code-style";

export function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}
