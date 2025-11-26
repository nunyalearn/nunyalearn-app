import { ActivityIndicator, Text, TouchableOpacity, type TouchableOpacityProps, View } from "react-native";

type ButtonProps = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
  className?: string;
};

export default function Button({ title, loading = false, disabled, onPress, className = "", ...touchable }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      className={`w-full rounded-full bg-[#00E676] py-4 shadow-lg ${isDisabled ? "opacity-60" : ""} ${className}`}
      {...touchable}
    >
      <View className="flex-row items-center justify-center gap-2">
        {loading ? <ActivityIndicator color="#06411d" /> : null}
        <Text className="text-center text-base font-semibold text-[#06411d]">
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

