// screens/CourseSelectScreen.js
import { View, Text, Button } from 'react-native';
import burns from '../data/burns.json';

export default function CourseSelectScreen({ navigation }) {
  const handleSelect = () => {
    navigation.navigate('GoalSelect', { course: burns });
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontSize: 22, marginBottom: 20 }}>Select Course</Text>

      <Button title={burns.courseName} onPress={handleSelect} />
    </View>
  );
}
