import { forwardRef, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, type ViewStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type InputProps = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  allowPasswordToggle?: boolean;
  containerStyle?: ViewStyle;
};

const Input = forwardRef<TextInput, InputProps>(function Input(
  { icon, error, secureTextEntry, allowPasswordToggle = true, containerStyle, ...textInputProps },
  ref,
) {
  const shouldAllowToggle = allowPasswordToggle && Boolean(secureTextEntry);
  const [isHidden, setIsHidden] = useState(Boolean(secureTextEntry));
  const { autoCorrect, ...restInputProps } = textInputProps;

  const borderClasses = useMemo(
    () => (error ? "border-red-400" : "border-transparent"),
    [error],
  );

  return (
    <View className="w-full">
      <View
        className={`flex-row items-center rounded-full bg-white px-4 py-3 border ${borderClasses}`}
        style={[styles.shadow, containerStyle]}
      >
        <Ionicons name={icon} size={20} color={error ? "#f87171" : "#00E676"} />
        <TextInput
          ref={ref}
          className="flex-1 px-3 text-base text-gray-900"
          placeholderTextColor="#9ca3af"
          secureTextEntry={shouldAllowToggle ? isHidden : secureTextEntry}
          autoCorrect={autoCorrect ?? false}
          {...restInputProps}
        />
        {shouldAllowToggle ? (
          <Pressable accessibilityRole="button" onPress={() => setIsHidden((prev) => !prev)}>
            <Ionicons name={isHidden ? "eye-off" : "eye"} size={20} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-2 text-sm text-red-500">{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});

export default Input;
