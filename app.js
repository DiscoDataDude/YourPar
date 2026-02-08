// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import CourseSelectScreen from './screens/CourseSelectScreen';
import GoalSelectScreen from './screens/GoalSelectScreen';
import MyParCardScreen from './screens/MyParCardScreen';
import HoleStrategyScreen from './screens/HoleStrategyScreen';
import ClubSetupScreen from './screens/ClubSetupScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CourseSelect" component={CourseSelectScreen} />
        <Stack.Screen name="GoalSelect" component={GoalSelectScreen} />
        <Stack.Screen name="MyParCard" component={MyParCardScreen} />
        <Stack.Screen name="HoleStrategy" component={HoleStrategyScreen} />
        <Stack.Screen name="ClubSetup" component={ClubSetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
