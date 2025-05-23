import {View, Text, StyleSheet, SafeAreaView} from 'react-native';
import React, {useRef} from 'react';
import VoiceDBGraph from './components/DbGraph';

const App = () => {
  const voiceGraphRef = useRef(null);

  // Handler for speech time updates
  const handleSpeechTimeUpdate = (speechTime) => {
    console.log('Speech time updated:', speechTime);
  };

  // Handler for average dB updates
  const handleAverageUpdate = (averageDB) => {
    console.log('Average DB updated:', averageDB);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.highlight}>Audio DB Monitor Test App</Text>
        <VoiceDBGraph
          ref={voiceGraphRef}
          duration={5}
          height={200}
          onSpeechTimeUpdate={handleSpeechTimeUpdate}
          onAverageUpdate={handleAverageUpdate}
          compact={false}
          initialDarkTheme={true}
          showHorizontalMeter={true}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
});

export default App;