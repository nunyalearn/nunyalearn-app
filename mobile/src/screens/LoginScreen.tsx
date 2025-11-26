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

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type FieldErrors = {
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const fieldErrors = useMemo<FieldErrors>(() => {
    const nextErrors: FieldErrors = {};
    if (!emailPattern.test(email.trim().toLowerCase())) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    return nextErrors;
  }, [email, password]);

  const isFormValid = Object.keys(fieldErrors).length === 0;

  const handleLogin = async () => {
    setShowErrors(true);
    if (!isFormValid) return;
    setLoading(true);
    setSubmitError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    console.log("Forgot password tapped");
  };

  return (
    <Screen scrollable>
      <StyledView className="flex-1 justify-between gap-12">
        <StyledView className="gap-8">
          <AuthHeader title="Welcome back" subtitle="Log in to continue your prep." />
          <StyledView className="gap-4">
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
              onSubmitEditing={handleLogin}
            />
            <StyledPressable onPress={handleForgotPassword}>
              <StyledText className="text-right text-sm font-semibold text-[#00E676]">Forgot password?</StyledText>
            </StyledPressable>
            {submitError ? (
              <StyledText className="text-sm text-center text-red-500">{submitError}</StyledText>
            ) : null}
          </StyledView>
        </StyledView>

        <StyledView className="gap-6">
          <Button title="Log in" onPress={handleLogin} loading={loading} disabled={!isFormValid || loading} />
          <StyledView className="flex-row justify-center gap-1">
            <StyledText className="text-sm text-gray-500">Need an account?</StyledText>
            <StyledPressable onPress={() => navigation.navigate("Register")}>
              <StyledText className="text-sm font-semibold text-[#00E676]">Sign up</StyledText>
            </StyledPressable>
          </StyledView>
        </StyledView>
      </StyledView>
    </Screen>
  );
}

