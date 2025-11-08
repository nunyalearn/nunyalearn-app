"use client";

import useSWR from "swr";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

type BadgeItem = { id: number; name: string; xp_required: number };
type AchievementItem = { id: number; name: string; xp_reward: number };
type ChallengeItem = { id: number; title: string; type: string; xp_reward: number };
type RewardItem = { id: number; title: string; description?: string };

const GamificationPage = () => {
  const { data: badgesData } = useSWR<BadgeItem[] | { badges?: BadgeItem[] }>("/admin/badges", fetcher);
  const { data: achievementsData } = useSWR<AchievementItem[] | { achievements?: AchievementItem[] }>("/admin/achievements", fetcher);
  const { data: challengesData } = useSWR<ChallengeItem[] | { challenges?: ChallengeItem[] }>("/admin/challenges", fetcher);
  const { data: rewardsData } = useSWR<RewardItem[] | { rewards?: RewardItem[] }>("/admin/rewards", fetcher);
  const badges = Array.isArray(badgesData) ? badgesData : badgesData?.badges ?? [];
  const achievements = Array.isArray(achievementsData) ? achievementsData : achievementsData?.achievements ?? [];
  const challenges = Array.isArray(challengesData) ? challengesData : challengesData?.challenges ?? [];
  const rewards = Array.isArray(rewardsData) ? rewardsData : rewardsData?.rewards ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Gamification</h1>
        <p className="text-muted-foreground">Badges, achievements, rewards, and challenges powering engagement.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {badges?.map((badge) => (
          <div key={badge.id} className="rounded-3xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Badge</p>
            <p className="text-lg font-semibold">{badge.name}</p>
            <p className="text-xs text-muted-foreground">{badge.xp_required} XP</p>
          </div>
        ))}
      </section>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Achievements</h2>
        <div className="flex flex-wrap gap-2">
          {achievements?.map((achievement) => (
            <Badge key={achievement.id} variant="outline">
              {achievement.name} · {achievement.xp_reward} XP
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Challenges</h2>
        <DataTable
          columns={[
            { key: "title", label: "Title" },
            { key: "type", label: "Type" },
            { key: "xp_reward", label: "XP" },
          ]}
          data={challenges}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Rewards</h2>
        <DataTable columns={[{ key: "title", label: "Reward" }, { key: "description", label: "Description" }]} data={rewards} />
      </div>
    </div>
  );
};

export default GamificationPage;
