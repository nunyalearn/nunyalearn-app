import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { styled } from "../../utils/styled";

import { colors } from "../../theme/colors";

const StyledText = styled(Text);

type GradeTileProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function GradeTile({ label, onPress, style }: GradeTileProps) {
  return (
    <Pressable onPress={onPress} style={[styles.wrapper, style]} accessibilityRole="button">
      <LinearGradient colors={[colors.primary, colors.accent]} style={styles.gradient}>
        <StyledText className="text-lg font-semibold text-white">{label}</StyledText>
        <Ionicons name="chevron-forward" size={24} color={colors.surface} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: "48%",
  },
  gradient: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    minHeight: 110,
    justifyContent: "space-between",
  },
});
