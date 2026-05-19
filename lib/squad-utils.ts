import type { Team, TeamId, Staff, Role } from "@/lib/types";

export type Tree = Team & { children: Tree[] };

export function sortMembersByRoleThenName(
  memberIds: string[],
  staff: Record<string, Staff>,
  roles: Record<string, Role>,
): string[] {
  const roleOrder = Object.keys(roles);
  return [...memberIds].sort((a, b) => {
    const sa = staff[a];
    const sb = staff[b];
    if (!sa || !sb) return 0;
    const ra = roleOrder.indexOf(sa.roleId);
    const rb = roleOrder.indexOf(sb.roleId);
    if (ra !== rb) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    return sa.name.localeCompare(sb.name);
  });
}

export function buildForest(teams: Record<TeamId, Team>): Tree[] {
  const childrenOf: Record<string, TeamId[]> = {};
  for (const t of Object.values(teams)) {
    const key = t.parentId ?? "__root__";
    (childrenOf[key] ??= []).push(t.id);
  }
  for (const key of Object.keys(childrenOf)) {
    childrenOf[key].sort((a, b) => (teams[a]?.order ?? 0) - (teams[b]?.order ?? 0));
  }
  const build = (id: TeamId): Tree => ({
    ...teams[id],
    children: (childrenOf[id] ?? []).map(build),
  });
  return (childrenOf["__root__"] ?? []).map(build);
}

export function collectTeamIds(trees: Tree[]): TeamId[] {
  const ids: TeamId[] = [];
  for (const t of trees) {
    ids.push(t.id);
    ids.push(...collectTeamIds(t.children));
  }
  return ids;
}
