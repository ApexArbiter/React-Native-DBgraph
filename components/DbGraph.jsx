import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AudioRecord from 'react-native-audio-record';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

const VoiceDBGraph = forwardRef(
  (
    {
      duration = 50,
      height = 200,
      onSpeechTimeUpdate,
      onAverageUpdate,
      compact = false,
      initialDarkTheme = true,
      showHorizontalMeter = true,
    },
    ref
  ) => {
    const [waveformData, setWaveformData] = useState([]);
    const [running, setRunning] = useState(false);
    const [time, setTime] = useState(0);
    const [averageDB, setAverageDB] = useState(0);
    const [currentDB, setCurrentDB] = useState(0);
    const [darkTheme, setDarkTheme] = useState(initialDarkTheme);
    const [recordingDuration, setRecordingDuration] = useState(0);
    
    const intervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const lastCurrentUpdateRef = useRef(0);
    const timeoutRef = useRef(null);
    const activeSpeechTimeRef = useRef(0);
    const audioDataRef = useRef([]);

    // Fixed DB offset of 50
    const dbOffset = 50;

    // Initialize audio recording
    useEffect(() => {
      console.log("Hello World")
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: 'temp_audio.wav'
      };
      
      AudioRecord.init(options);
      
      return () => {
        AudioRecord.stop();
      };
    }, []);

    // Request microphone permission
    const requestMicrophonePermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'This app needs access to your microphone to record audio levels.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
          console.warn(err);
          return false;
        }
      }
      return true; // iOS permissions handled in Info.plist
    };

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      startRecording: () => startAudio(),
      stopRecording: () => {
        const avgDB = stopAudio();
        return avgDB;
      },
      clearData: () => clearData(),
      getAverageDB: () => averageDB,
      isRecording: () => running,
      getSpeechTime: () => activeSpeechTimeRef.current,
    }));

    const startAudio = async () => {
      try {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          Alert.alert('Permission Required', 'Microphone permission is required to record audio.');
          return false;
        }

        setTime(0);
        setRecordingDuration(0);
        activeSpeechTimeRef.current = 0;
        audioDataRef.current = [];
        
        startTimeRef.current = Date.now();
        setRunning(true);

        // Start audio recording
        AudioRecord.start();

        // Set exact timeout for 5-second duration
        if (duration === 5) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            stopAudio();
          }, 5000);
        }

        return true;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        Alert.alert('Error', 'Unable to access microphone. Please check permissions.');
        return false;
      }
    };

    const stopAudio = () => {
      setRunning(false);
      clearInterval(intervalRef.current);

      // Clear the timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Stop audio recording
      AudioRecord.stop();

      // Calculate the final recording duration
      const finalRecordingDuration = (Date.now() - startTimeRef.current) / 1000;
      setRecordingDuration(finalRecordingDuration);

      if (onSpeechTimeUpdate) {
        onSpeechTimeUpdate(activeSpeechTimeRef.current);
      }

      // Calculate the final average dB value
      let finalAverageDB = averageDB;

      // If active speech time is less than 1 second, set average DB to 0
      if (activeSpeechTimeRef.current < 1) {
        console.log(
          'Active speech time less than 1 second:',
          activeSpeechTimeRef.current.toFixed(2),
          's - Setting average DB to 0'
        );
        finalAverageDB = 0;
        setAverageDB(0);
      }

      // Log the results
      console.log(
        'Total recording duration:',
        finalRecordingDuration.toFixed(2),
        'seconds'
      );
      console.log(
        'Active speech time:',
        activeSpeechTimeRef.current.toFixed(2),
        'seconds'
      );
      console.log('Average DB:', finalAverageDB.toFixed(1));

      // Call the callback if provided
      if (onAverageUpdate) {
        onAverageUpdate(finalAverageDB);
      }

      return finalAverageDB;
    };

    const clearData = () => {
      setWaveformData([]);
      setTime(0);
      setRecordingDuration(0);
      activeSpeechTimeRef.current = 0;
      startTimeRef.current = 0;
      setAverageDB(0);
      setCurrentDB(0);
      audioDataRef.current = [];

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const toggleTheme = () => {
      setDarkTheme((prev) => !prev);
    };

    // Simulate audio level processing (in real implementation, you'd process actual audio data)
    const processAudioData = () => {
      // Simulate getting audio amplitude data
      // In a real implementation, you would process the actual audio buffer
      const simulatedAmplitude = Math.random() * 0.5 + (Math.random() > 0.7 ? 0.3 : 0.1);
      const rms = simulatedAmplitude;
      const dB = 20 * Math.log10(rms || 0.0001);
      
      console.log('DB Value:', dB);
      
      const normalizedDB = Math.max(0, dB + 100 - dbOffset);
      return normalizedDB;
    };

    useEffect(() => {
      if (!running) return;

      intervalRef.current = setInterval(() => {
        if (!running) return;

        // Calculate current elapsed time
        const currentElapsedTime = (Date.now() - startTimeRef.current) / 1000;

        // If we've reached the duration, stop recording
        if (duration && currentElapsedTime >= duration) {
          stopAudio();
          return;
        }

        const normalizedDB = processAudioData();

        const now = Date.now();
        if (
          !lastCurrentUpdateRef.current ||
          now - lastCurrentUpdateRef.current > 200
        ) {
          setCurrentDB(normalizedDB);
          lastCurrentUpdateRef.current = now;
        }

        setTime(currentElapsedTime);

        const newPoint = { x: currentElapsedTime, y: normalizedDB };

        setWaveformData((prev) => {
          const updated = [...prev, newPoint].filter(
            (p) => p.x >= currentElapsedTime - duration
          );

          // Calculate average dB, excluding 1-10 dB range
          const validPoints = updated.filter(
            (point) => point.y < 1 || point.y > 10
          );
          const sum = validPoints.reduce((acc, point) => acc + point.y, 0);
          const avg = validPoints.length > 0 ? sum / validPoints.length : 0;
          setAverageDB(avg);

          // Update active speech time if we detect meaningful audio
          if (normalizedDB > 10) {
            activeSpeechTimeRef.current += 0.05;

            if (onSpeechTimeUpdate) {
              onSpeechTimeUpdate(activeSpeechTimeRef.current);
            }
          }

          return updated;
        });
      }, 50);

      return () => clearInterval(intervalRef.current);
    }, [running, duration, onAverageUpdate, onSpeechTimeUpdate]);

    // Cleanup on component unmount
    useEffect(() => {
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        AudioRecord.stop();
      };
    }, []);

    const themeColors = darkTheme
      ? {
          bg: '#1f2937',
          cardBg: '#374151',
          text: '#ffffff',
          textSecondary: '#9ca3af',
          button: '#4b5563',
          buttonText: '#ffffff',
          chartColor: 'rgba(255, 255, 255, 0.1)',
          lineColor: 'rgb(255, 0, 0)',
      }
      : {
          bg: '#f7f9fc',
          cardBg: '#ffffff',
          text: '#111827',
          textSecondary: '#6b7280',
          button: '#e5e7eb',
          buttonText: '#374151',
          chartColor: 'rgba(0, 0, 0, 0.1)',
          lineColor: 'rgb(255, 0, 0)',
      };

    // Prepare chart data - ensure we always have at least 2 points for the chart
    const chartLabels = [];
    const chartDataPoints = [];
    
    if (waveformData.length === 0) {
      // Show empty chart with minimal data
      chartLabels.push('0', Math.round(duration).toString());
      chartDataPoints.push(0, 0);
    } else {
      // Create labels at regular intervals
      const maxTime = Math.max(duration, time);
      const labelInterval = Math.max(1, Math.floor(maxTime / 10));
      
      for (let i = 0; i <= maxTime; i += labelInterval) {
        chartLabels.push(i.toString());
      }
      
      // Fill data points to match labels
      chartDataPoints.length = chartLabels.length;
      chartDataPoints.fill(0);
      
      // Map actual data points to the chart
      waveformData.forEach(point => {
        const labelIndex = Math.round(point.x / labelInterval);
        if (labelIndex < chartDataPoints.length) {
          chartDataPoints[labelIndex] = point.y;
        }
      });
    }

    const chartData = {
      labels: chartLabels,
      datasets: [
        {
          data: chartDataPoints,
          color: () => themeColors.lineColor,
          strokeWidth: 1.5,
        },
      ],
    };

    const chartConfig = {
      backgroundColor: 'transparent',
      backgroundGradientFrom: 'transparent',
      backgroundGradientTo: 'transparent',
      decimalPlaces: 0,
      color: (opacity = 1) => themeColors.chartColor,
      labelColor: (opacity = 1) => `rgba(${darkTheme ? '255, 255, 255' : '17, 24, 39'}, ${opacity * 0.6})`,
      style: {
        borderRadius: 0,
      },
      propsForDots: {
        r: '0', // Hide dots
      },
      propsForBackgroundLines: {
        strokeWidth: 0.3,
        stroke: themeColors.chartColor,
        strokeOpacity: 0.3,
      },
      withHorizontalLines: true,
      withVerticalLines: false,
      withInnerLines: false,
      withOuterLines: false,
      yAxisInterval: 12, // Show y-axis labels every 12 units
      formatYLabel: (value) => {
        // Convert to fake display values like the web version
        const numValue = parseFloat(value);
        if (numValue === 0) return '0';
        if (numValue <= 12) return '30';
        if (numValue <= 24) return '60';
        if (numValue <= 36) return '90';
        return '120';
      },
    };

    // Function to determine the color based on dB range
    const getColorForRange = (rangeIndex) => {
      switch (rangeIndex) {
        case 0:
          return averageDB >= 0 && averageDB <= 16 ? '#eab308' : themeColors.cardBg;
        case 1:
          return averageDB >= 17 && averageDB <= 33 ? '#22c55e' : themeColors.cardBg;
        case 2:
          return averageDB >= 34 && averageDB <= 50 ? '#dc2626' : themeColors.cardBg;
        default:
          return themeColors.cardBg;
      }
    };

    // Function to get text color for average DB display
    const getAverageDbColor = () => {
      if (averageDB >= 0 && averageDB <= 15.6) return '#eab308';
      if (averageDB >= 16 && averageDB <= 31.6) return '#22c55e';
      if (averageDB >= 32) return '#dc2626';
      return '#3b82f6';
    };

    // Function to convert real dB to fake display value
    const getFakeDbValue = (realDb) => {
      return (realDb * 2.5).toFixed(1);
    };

    const styles = StyleSheet.create({
      container: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: themeColors.bg,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      },
      title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColors.text,
      },
      themeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: themeColors.button,
      },
      statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
      },
      statCard: {
        backgroundColor: themeColors.cardBg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      },
      statText: {
        fontSize: 12,
        color: themeColors.text,
        fontFamily: 'monospace',
      },
      buttonContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
      },
      button: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
      },
      buttonText: {
        fontSize: 14,
        fontWeight: '600',
      },
      startButton: {
        backgroundColor: running ? '#4b5563' : '#16a34a',
      },
      stopButton: {
        backgroundColor: !running ? '#4b5563' : '#dc2626',
      },
      clearButton: {
        backgroundColor: themeColors.button,
      },
      chartContainer: {
        height,
        marginBottom: 12,
        backgroundColor: themeColors.cardBg,
        borderRadius: 8,
        overflow: 'hidden',
      },
      rangeContainer: {
        flexDirection: 'row',
        gap: 4,
      },
      rangeIndicator: {
        flex: 1,
        padding: 8,
        borderRadius: 4,
        alignItems: 'center',
      },
      rangeText: {
        fontSize: 12,
        fontWeight: '600',
      },
    });

    return (
      <View style={styles.container}>
        {!compact && (
          <View style={styles.header}>
            <Text style={styles.title}>Audio dB Monitor</Text>
            <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
              <Icon
                name={darkTheme ? 'wb-sunny' : 'brightness-2'}
                size={20}
                color={darkTheme ? '#fbbf24' : '#1e40af'}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Current:{' '}
              <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>
                {getFakeDbValue(currentDB)}
              </Text>{' '}
              dB
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Average:{' '}
              <Text style={{ color: getAverageDbColor(), fontWeight: 'bold' }}>
                {getFakeDbValue(averageDB)}
              </Text>{' '}
              dB
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Speech:{' '}
              <Text style={{ fontWeight: 'bold' }}>
                {activeSpeechTimeRef.current.toFixed(1)}
              </Text>{' '}
              s
            </Text>
          </View>
        </View>

        {!compact && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={startAudio}
              disabled={running}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: running ? '#9ca3af' : '#ffffff' },
                ]}
              >
                Start
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopAudio}
              disabled={!running}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: !running ? '#9ca3af' : '#ffffff' },
                ]}
              >
                Stop
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={clearData}
            >
              <Text style={[styles.buttonText, { color: themeColors.buttonText }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={screenWidth - 64}
            height={height}
            chartConfig={chartConfig}
            style={{
              borderRadius: 8,
            }}
            withDots={false}
            withShadow={false}
            bezier={true}
          />
        </View>

        <View style={styles.rangeContainer}>
          <View
            style={[
              styles.rangeIndicator,
              {
                backgroundColor: getColorForRange(0),
              },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color:
                    averageDB >= 0 && averageDB <= 15.6
                      ? '#ffffff'
                      : themeColors.text,
                },
              ]}
            >
              0-39 dB
            </Text>
          </View>
          <View
            style={[
              styles.rangeIndicator,
              {
                backgroundColor: getColorForRange(1),
              },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color:
                    averageDB >= 16 && averageDB <= 31.6
                      ? '#ffffff'
                      : themeColors.text,
                },
              ]}
            >
              40-79 dB
            </Text>
          </View>
          <View
            style={[
              styles.rangeIndicator,
              {
                backgroundColor: getColorForRange(2),
              },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color:
                    averageDB >= 32 && averageDB <= 48
                      ? '#ffffff'
                      : themeColors.text,
                },
              ]}
            >
              80-120 dB
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

export default VoiceDBGraph;