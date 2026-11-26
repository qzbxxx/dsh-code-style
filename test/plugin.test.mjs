import assert from "node:assert/strict";
import test from "node:test";

import { apply, inject, name } from "../index.js";

// 记录插件注册的 provider，模拟 skills 服务的最小接口。
function installFakeSkills() {
  let provider;

  return {
    registerProvider(create) {
      provider = create({
        signal: new AbortController().signal,
        invalidate() {}
      });
      return () => {};
    },
    getProvider() {
      return provider;
    }
  };
}

test("插件声明依赖 skills 服务", () => {
  assert.deepEqual(inject, ["skills"]);
  assert.equal(name, "dsh-code-style");
});

test("注册 code-style 技能并给出可用元数据", async () => {
  const skills = installFakeSkills();
  apply({ skills });

  const provider = skills.getProvider();
  assert.ok(provider);

  const candidates = await provider.list();
  assert.equal(candidates.length, 1);

  const candidate = candidates[0];
  assert.equal(candidate.name, "code-style");
  assert.equal(candidate.provider, "code-style");
  assert.equal(candidate.source, "plugin");
  assert.equal(candidate.rank, 600);
  assert.equal(candidate.invocation.modelInvocable, true);
  assert.equal(candidate.invocation.userInvocable, true);
  assert.equal(candidate.resourceBase.kind, "directory");
  assert.ok(candidate.description.includes("可读性优先"));
});

test("get 返回去掉 frontmatter 的完整正文", async () => {
  const skills = installFakeSkills();
  apply({ skills });

  const provider = skills.getProvider();
  const [candidate] = await provider.list();
  const definition = await provider.get(candidate);

  assert.equal(definition.name, "code-style");
  assert.match(definition.content, /^# 代码风格规范/);
  assert.match(definition.content, /## 核心原则/);
  assert.doesNotMatch(definition.content, /^---/);
  assert.ok(definition.content.endsWith("为什么这样做。"));
});
