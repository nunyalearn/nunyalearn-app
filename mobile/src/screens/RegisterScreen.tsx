import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Input from "../components/UI/Input";
import Button from "../components/UI/Button";
import AuthHeader from "../components/UI/AuthHeader";
import { useAuth } from "../hooks/useAuth";
import type { AuthStackParamList } from "../navigation/types";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const fieldErrors = useMemo<FieldErrors>(() => {
    const nextErrors: FieldErrors = {};
    if (!fullName.trim()) {
      nextErrors.fullName = "Please tell us your name.";
    } else if (fullName.trim().split(" ").length < 2) {
      nextErrors.fullName = "Enter your full name.";
    }

    if (!emailPattern.test(email.trim().toLowerCase())) {
      nextErrors.email = "Enter a valid email.";
    }

    if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    return nextErrors;
  }, [fullName, email, password]);

  const isFormValid = Object.keys(fieldErrors).length === 0;

  const handleRegister = async () => {
    setShowErrors(true);
    if (!isFormValid) return;
    setLoading(true);
    setSubmitError(null);
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable>
      <StyledView className="flex-1 justify-between gap-12">
        <StyledView className="gap-8">
          <AuthHeader title="Create account" subtitle="Join Stitch and start learning instantly." />
          <StyledView className="gap-4">
            <Input
              icon="person-outline"
              placeholder="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              error={showErrors ? fieldErrors.fullName : undefined}
            />
            <Input
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              error={showErrors ? fieldErrors.email : undefined}
            />
            <Input
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              error={showErrors ? fieldErrors.password : undefined}
              onSubmitEditing={handleRegister}
            />
            {submitError ? (
              <StyledText className="text-sm text-center text-red-500">{submitError}</StyledText>
            ) : null}
          </StyledView>
        </StyledView>

        <StyledView className="gap-6">
          <Button title="Continue" onPress={handleRegister} loading={loading} disabled={!isFormValid || loading} />
          <StyledView className="flex-row justify-center gap-1">
            <StyledText className="text-sm text-gray-500">Already have an account?</StyledText>
            <StyledPressable onPress={() => navigation.navigate("Login")}>
              <StyledText className="text-sm font-semibold text-[#00E676]">Log in</StyledText>
            </StyledPressable>
          </StyledView>
        </StyledView>
      </StyledView>
    </Screen>
  );
}

