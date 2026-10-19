/** GrsAI 多账号：GRSAI_API_KEY + GRSAI_API_KEY_2，或 GRSAI_API_KEYS 逗号分隔 */
export function getGrsaiApiKeys(): string[] {
  const listEnv = process.env.GRSAI_API_KEYS?.trim();
  if (listEnv) {
    const fromList = listEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromList.length) return [...new Set(fromList)];
  }

  const keys: string[] = [];
  const k1 = process.env.GRSAI_API_KEY?.trim();
  const k2 = process.env.GRSAI_API_KEY_2?.trim();
  if (k1) keys.push(k1);
  if (k2 && k2 !== k1) keys.push(k2);
  if (keys.length) return keys;

  return [];
}

export function getGrsaiApiKeyCount(): number {
  return getGrsaiApiKeys().length;
}
