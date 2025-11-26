import { Text, View } from "react-native";

type AuthHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <View className="items-center gap-3">
      <Text className="text-center text-3xl font-bold text-gray-900">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-base text-gray-500">{subtitle}</Text>
      ) : null}
    </View>
  );
}
