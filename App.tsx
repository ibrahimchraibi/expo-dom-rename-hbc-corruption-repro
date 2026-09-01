import { Text, View } from 'react-native'
import DomPart from './DomPart'
import { VICTIMS } from './victims'

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Text>{JSON.stringify(VICTIMS)}</Text>
      <DomPart />
    </View>
  )
}
