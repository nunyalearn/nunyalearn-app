import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import GradeScreen from "../screens/GradeScreen";
import SubjectScreen from "../screens/SubjectScreen";
import TopicScreen from "../screens/TopicScreen";
import QuizListScreen from "../screens/QuizListScreen";
import QuizPlayerScreen from "../screens/QuizPlayerScreen";
import QuizResultScreen from "../screens/QuizResultScreen";
import PracticeTestListScreen from "../screens/PracticeTestListScreen";
import TestPlayerScreen from "../screens/TestPlayerScreen";
import TestResultScreen from "../screens/TestResultScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { AuthContextProvider } from "../context/AuthContext";
import { EngagementContextProvider } from "../context/EngagementContext";
import { useAuth } from "../hooks/useAuth";
import {
  AuthStackParamList,
  LearnStackParamList,
  ProfileStackParamList,
  RootStackParamList,
} from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const LearnStack = createNativeStackNavigator<LearnStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator();

const AuthStackNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const LearnStackNavigator = () => (
  <LearnStack.Navigator screenOptions={{ headerShown: false }}>
    <LearnStack.Screen name="Grades" component={GradeScreen} />
    <LearnStack.Screen name="Subjects" component={SubjectScreen} />
    <LearnStack.Screen name="Topics" component={TopicScreen} />
    <LearnStack.Screen name="QuizList" component={QuizListScreen} />
    <LearnStack.Screen name="PracticeTestList" component={PracticeTestListScreen} />
    <LearnStack.Screen name="QuizPlayer" component={QuizPlayerScreen} />
    <LearnStack.Screen name="QuizResult" component={QuizResultScreen} />
    <LearnStack.Screen name="TestPlayer" component={TestPlayerScreen} />
    <LearnStack.Screen name="TestResult" component={TestResultScreen} />
  </LearnStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
  </ProfileStack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Learn" component={LearnStackNavigator} />
    <Tab.Screen name="Profile" component={ProfileStackNavigator} />
  </Tab.Navigator>
);

const NavigatorContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const isAuthenticated = Boolean(user);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </RootStack.Navigator>
  );
};

export default function AppNavigator() {
  return (
    <AuthContextProvider>
      <EngagementContextProvider>
        <NavigatorContent />
      </EngagementContextProvider>
    </AuthContextProvider>
  );
}
