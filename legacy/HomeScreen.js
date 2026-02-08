// screens/HomeScreen.js
import { View, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontSize: 28, marginBottom: 20 }}>Handicap-Caddy MVP</Text>

      <Button
        title="Start Round"
        onPress={() => navigation.navigate('CourseSelect')}
      />

      <View style={{ height: 20 }} />

      <Button
        title="Set My Club Distances"
        onPress={() => navigation.navigate('ClubSetup')}
      />
    </View>
  );
}
