import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import SoundLevel from 'react-native-sound-level';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentDecibels, setCurrentDecibels] = useState(0);
  const [averageDecibels, setAverageDecibels] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [decibelHistory, setDecibelHistory] = useState([]);
  const [rawSoundLevel, setRawSoundLevel] = useState(0);

  const soundLevelListener = useRef(null);

  useEffect(() => {
    checkMicrophonePermission();

    return () => {
      stopRecording();
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      let permission;
      if (Platform.OS === 'android') {
        permission = PERMISSIONS.ANDROID.RECORD_AUDIO;
      } else {
        permission = PERMISSIONS.IOS.MICROPHONE;
      }

      const result = await check(permission);

      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else if (result === RESULTS.DENIED) {
        requestMicrophonePermission();
      } else {
        setHasPermission(false);
        Alert.alert(
          'Permission Required',
          'Microphone access is required to measure audio levels.',
        );
      }
    } catch (error) {
      console.error('Permission check error:', error);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      let permission;
      if (Platform.OS === 'android') {
        permission = PERMISSIONS.ANDROID.RECORD_AUDIO;
      } else {
        permission = PERMISSIONS.IOS.MICROPHONE;
      }

      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        setHasPermission(false);
        Alert.alert(
          'Permission Denied',
          'Microphone access is required to measure audio levels.',
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  // Convert sound level to a 0-100 scale for display
  const soundLevelToPercentage = (soundLevel) => {
    if (soundLevel <= 0) return 0;

    // react-native-sound-level returns values typically between 0-120+ dB
    // We'll normalize this to a 0-100 scale for better user experience
    // Typical ranges: 0-30 dB (quiet), 30-60 dB (moderate), 60+ dB (loud)
    const normalizedValue = Math.min(100, Math.max(0, (soundLevel / 80) * 100));
    return Math.round(normalizedValue);
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission first.',
      );
      return;
    }

    try {
      // Start monitoring sound level
      SoundLevel.start();
      setIsRecording(true);
      setDecibelHistory([]);

      // Set up sound level listener
      soundLevelListener.current = SoundLevel.onNewFrame((data) => {
        const soundLevel = data.value || 0;
        const rawDb = data.rawValue || 0;
        
        setRawSoundLevel(rawDb);
        
        const percentage = soundLevelToPercentage(soundLevel);
        setCurrentDecibels(percentage);

        // Update history for average calculation
        setDecibelHistory(prev => {
          const newHistory = [...prev, percentage];
          if (newHistory.length > 50) {
            newHistory.shift(); // Keep only last 50 readings
          }

          // Calculate average
          const average =
            newHistory.reduce((sum, val) => sum + val, 0) / newHistory.length;
          setAverageDecibels(Math.round(average));

          return newHistory;
        });
      });
    } catch (error) {
      console.error('Recording start error:', error);
      Alert.alert('Error', 'Failed to start sound level monitoring: ' + error.message);
    }
  };

  const stopRecording = async () => {
    try {
      // Stop monitoring sound level
      SoundLevel.stop();
      
      // Remove listener
      if (soundLevelListener.current) {
        soundLevelListener.current.remove();
        soundLevelListener.current = null;
      }

      setIsRecording(false);
      setCurrentDecibels(0);
      setRawSoundLevel(0);
    } catch (error) {
      console.error('Recording stop error:', error);
    }
  };

  const handleStartStop = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getDecibelColor = decibels => {
    if (decibels < 20) return '#4CAF50'; // Green - Very quiet
    if (decibels < 40) return '#8BC34A'; // Light green - Quiet
    if (decibels < 60) return '#FF9800'; // Orange - Moderate
    if (decibels < 80) return '#FF5722'; // Red-orange - Loud
    return '#F44336'; // Red - Very loud
  };

  const getDecibelLevel = decibels => {
    if (decibels < 10) return 'Silent';
    if (decibels < 25) return 'Very Quiet';
    if (decibels < 45) return 'Quiet';
    if (decibels < 65) return 'Moderate';
    if (decibels < 85) return 'Loud';
    return 'Very Loud';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Audio Decibel Meter</Text>

        {!hasPermission && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Microphone permission is required
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestMicrophonePermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasPermission && (
          <>
            <View style={styles.metersContainer}>
              <View
                style={[
                  styles.meterCard,
                  {borderColor: getDecibelColor(currentDecibels)},
                ]}>
                <Text style={styles.meterLabel}>Current Level</Text>
                <Text
                  style={[
                    styles.meterValue,
                    {color: getDecibelColor(currentDecibels)},
                  ]}>
                  {currentDecibels}%
                </Text>
                <Text style={styles.meterSubtext}>
                  {getDecibelLevel(currentDecibels)}
                </Text>
              </View>

              <View style={styles.meterCard}>
                <Text style={styles.meterLabel}>Average Level</Text>
                <Text
                  style={[
                    styles.meterValue,
                    {color: getDecibelColor(averageDecibels)},
                  ]}>
                  {averageDecibels}%
                </Text>
                <Text style={styles.meterSubtext}>
                  {decibelHistory.length} samples
                </Text>
              </View>
            </View>

            {/* Debug info - remove in production */}
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>
                Raw Sound Level: {rawSoundLevel.toFixed(1)} dB
              </Text>
              <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
            </View>

            <View style={styles.visualIndicator}>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.max(2, currentDecibels)}%`,
                      backgroundColor: getDecibelColor(currentDecibels),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Audio Level: {currentDecibels}%
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {backgroundColor: isRecording ? '#F44336' : '#4CAF50'},
              ]}
              onPress={handleStartStop}>
              <Text style={styles.controlButtonText}>
                {isRecording ? 'Stop Monitoring' : 'Start Monitoring'}
              </Text>
            </TouchableOpacity>

            {isRecording && (
              <View style={styles.statusContainer}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.statusText}>Monitoring Audio...</Text>
              </View>
            )}

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructionsText}>
                • Tap "Start Monitoring" to begin audio level detection{'\n'}•
                Speak normally or make sounds to see the levels change{'\n'}•
                The meter shows relative audio intensity (0-100%){'\n'}• Colors
                indicate different sound levels{'\n'}• Raw dB values are shown for reference
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  permissionContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  meterCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  meterLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  meterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  meterSubtext: {
    fontSize: 12,
    color: '#999',
  },
  debugContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  visualIndicator: {
    marginBottom: 20,
  },
  progressContainer: {
    height: 25,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 12,
    minWidth: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  controlButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default App;