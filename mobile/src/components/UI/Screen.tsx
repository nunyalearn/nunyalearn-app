import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, type Edge, type SafeAreaViewProps } from "react-native-safe-area-context";

type ScreenProps = SafeAreaViewProps & {
  children: ReactNode;
  scrollable?: boolean;
  contentClassName?: string;
};

const BASE_PADDING = "px-6 py-8";
const DEFAULT_EDGES: Edge[] = ["top", "bottom"];

export default function Screen({
  children,
  scrollable = false,
  contentClassName = "",
  edges = DEFAULT_EDGES,
  ...safeAreaProps
}: ScreenProps) {
  if (scrollable) {
    return (
      <SafeAreaView className={`flex-1 bg-white ${BASE_PADDING}`} edges={edges} {...safeAreaProps}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className={`flex-1 ${contentClassName}`}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-white ${BASE_PADDING}`} edges={edges} {...safeAreaProps}>
      <View className={`flex-1 ${contentClassName}`}>{children}</View>
    </SafeAreaView>
  );
}
