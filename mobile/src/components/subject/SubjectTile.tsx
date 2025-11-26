import { memo, useMemo } from "react";
import { Image, Pressable, StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import type { Subject } from "../../services/subject.service";
import { colors } from "../../theme/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SubjectTileProps = {
  subject: Subject;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  math: "calculator-outline",
  mathematics: "calculator-outline",
  algebra: "calculator-outline",
  geometry: "shapes-outline",
  science: "flask-outline",
  biology: "leaf-outline",
  chemistry: "flask-outline",
  physics: "planet-outline",
  english: "book-outline",
  reading: "book-outline",
  literature: "book-outline",
  history: "time-outline",
  geography: "globe-outline",
  art: "color-palette-outline",
  music: "musical-notes-outline",
  computer: "code-slash-outline",
  technology: "laptop-outline",
};

const SubjectTileComponent = ({ subject, onPress, style }: SubjectTileProps) => {
  const scale = useSharedValue(1);
  const displayName = subject.subjectName ?? subject.name ?? "Subject";
  const description =
    subject.description ?? subject.summary ?? (subject.topicCount ? `${subject.topicCount} topics` : "Tap to explore");

  const iconName = useMemo(() => {
    const key = displayName.toLowerCase();
    const entries = Object.entries(iconMap);
    for (const [match, icon] of entries) {
      if (key.includes(match)) {
        return icon;
      }
    }
    return "sparkles-outline";
  }, [displayName]);

  const iconNode = subject.iconUrl ? (
    <Image source={{ uri: subject.iconUrl }} style={styles.iconImage} />
  ) : (
    <View style={styles.iconCircle}>
      <Ionicons name={iconName} size={28} color={colors.primary} />
    </View>
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.wrapper, style, animatedStyle]}
    >
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            {iconNode}
            <View className="flex-1">
              <Text className="text-lg font-semibold" style={{ color: colors.surface }}>
                {displayName}
              </Text>
              <Text
                className="text-xs uppercase tracking-wide"
                style={{ color: colors.surface, opacity: 0.75 }}
                numberOfLines={1}
              >
                {description}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.surface }]}>
            <Text className="text-xs font-semibold text-center" style={{ color: colors.primary }}>
              Continue
            </Text>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 24,
  },
  gradient: {
    borderRadius: 24,
    padding: 18,
    minHeight: 120,
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: {
    width: 48,
    height: 48,
    borderRadius: 20,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
});

export default memo(SubjectTileComponent);
