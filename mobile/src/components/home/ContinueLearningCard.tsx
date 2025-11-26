import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { styled } from "../../utils/styled";

import Button from "../UI/Button";
import { colors } from "../../theme/colors";

const StyledView = styled(View);
const StyledText = styled(Text);

export type ContinueLearningActivity = {
  type: "quiz" | "practice";
  title: string;
  topicName: string;
  metaLabel: string;
  progressPercent?: number;
  progressCaption?: string;
};

type ContinueLearningCardProps = {
  activity: ContinueLearningActivity;
  onPress: () => void;
};

const typeIcon: Record<ContinueLearningActivity["type"], keyof typeof Ionicons.glyphMap> = {
  quiz: "sparkles-outline",
  practice: "trophy-outline",
};

export default function ContinueLearningCard({ activity, onPress }: ContinueLearningCardProps) {
  const progressWidth = `${Math.min(Math.max(activity.progressPercent ?? 0, 0), 100)}%`;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <StyledView className="flex-row items-center justify-between">
        <StyledView className="flex-1 pr-3">
          <StyledText className="uppercase text-xs font-semibold tracking-wide text-white/80">
            {activity.metaLabel}
          </StyledText>
          <StyledText className="mt-1 text-2xl font-bold text-white">{activity.topicName}</StyledText>
          <StyledText className="mt-1 text-white/90">{activity.title}</StyledText>
        </StyledView>
        <StyledView className="h-14 w-14 items-center justify-center rounded-full bg-white/15">
          <Ionicons name={typeIcon[activity.type]} size={28} color={colors.surface} />
        </StyledView>
      </StyledView>

      <StyledView className="mt-5 space-y-2">
        <StyledView className="h-2 w-full overflow-hidden rounded-full bg-white/25">
          <StyledView className="h-full rounded-full bg-white" style={{ width: progressWidth }} />
        </StyledView>
        <StyledText className="text-xs font-semibold uppercase tracking-wider text-white/80">
          {activity.progressCaption ?? "Keep the rhythm alive"}
        </StyledText>
      </StyledView>

      <Button title="Continue" onPress={onPress} className="mt-5" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 20,
  },
});
