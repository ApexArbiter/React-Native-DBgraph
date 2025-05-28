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
  Animated,
} from 'react-native';
import Svg, { 
  Path, 
  G, 
  Line, 
  Text as SvgText, 
  Rect,
  Circle 
} from 'react-native-svg';
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
    const [isPaused, setIsPaused] = useState(false);
    
    const intervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const timeoutRef = useRef(null);
    const activeSpeechTimeRef = useRef(0);
    const audioDataRef = useRef([]);
    const animatedValue = useRef(new Animated.Value(0)).current;

    // Initialize audio recorder
    useEffect(() => {
      const options = {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6, // MIC
        wavFile: 'temp_recording.wav'
      };

      AudioRecord.init(options);

      // Setup real-time monitoring
      AudioRecord.on('data', data => {
        // Convert audio buffer to decibel level
        const buffer = new Int16Array(data);
        const rms = calculateRMS(buffer);
        const db = 20 * Math.log10(rms / 32767) + 90; // Convert to dB scale
        const normalizedDB = Math.max(0, Math.min(100, db));
        
        setCurrentDB(normalizedDB);
        
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        const newPoint = { 
          x: currentTime, 
          y: normalizedDB,
          timestamp: Date.now()
        };

        setWaveformData(prev => {
          const updated = [...prev, newPoint];
          
          // Keep sliding window
          const windowStart = Math.max(0, currentTime - (duration || 30));
          const filteredForDisplay = updated.filter(p => p.x >= windowStart);

          // Calculate average excluding very low values
          const activePoints = filteredForDisplay.filter(point => point.y >= 8);
          
          if (activePoints.length > 0) {
            const sum = activePoints.reduce((acc, point) => acc + point.y, 0);
            const avg = sum / activePoints.length;
            setAverageDB(avg);
          }

          // Update speech time for meaningful audio
          if (normalizedDB > 12) {
            activeSpeechTimeRef.current += 0.1;
            
            if (onSpeechTimeUpdate) {
              onSpeechTimeUpdate(activeSpeechTimeRef.current);
            }
          }

          return filteredForDisplay;
        });

        setTime(currentTime);
      });

      return () => {
        AudioRecord.stop();
      };
    }, []);

    // Calculate RMS (Root Mean Square) for volume level
    const calculateRMS = (buffer) => {
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      return Math.sqrt(sum / buffer.length);
    };

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
      return true;
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
        setWaveformData([]);
        
        startTimeRef.current = Date.now();
        setRunning(true);
        setIsPaused(false);

        // Start recording
        AudioRecord.start();
        console.log('Recording started');

        // Start pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: false,
            }),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: false,
            }),
          ])
        ).start();

        // Set timeout for duration limit
        if (duration && duration > 0) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            stopAudio();
          }, duration * 1000);
        }

        return true;
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Error', 'Unable to start recording. Please check permissions.');
        setRunning(false);
        return false;
      }
    };

    const stopAudio = async () => {
      try {
        setRunning(false);
        animatedValue.stopAnimation();

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Stop recording
        const audioFile = await AudioRecord.stop();
        console.log('Recording stopped:', audioFile);

        const finalRecordingDuration = (Date.now() - startTimeRef.current) / 1000;
        setRecordingDuration(finalRecordingDuration);

        if (onSpeechTimeUpdate) {
          onSpeechTimeUpdate(activeSpeechTimeRef.current);
        }

        let finalAverageDB = averageDB;

        if (activeSpeechTimeRef.current < 1) {
          console.log('Active speech time less than 1 second - Setting average DB to 0');
          finalAverageDB = 0;
          setAverageDB(0);
        }

        console.log('Total recording duration:', finalRecordingDuration.toFixed(2), 'seconds');
        console.log('Active speech time:', activeSpeechTimeRef.current.toFixed(2), 'seconds');
        console.log('Average DB:', finalAverageDB.toFixed(1));

        if (onAverageUpdate) {
          onAverageUpdate(finalAverageDB);
        }

        return finalAverageDB;
      } catch (error) {
        console.error('Error stopping recording:', error);
        setRunning(false);
        return averageDB;
      }
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
      animatedValue.setValue(0);
      setIsPaused(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const toggleTheme = () => {
      setDarkTheme((prev) => !prev);
    };

    // Cleanup
    useEffect(() => {
      return () => {
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
          accent: '#3b82f6',
          lineColor: '#ef4444',
          gridColor: '#4b5563',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      : {
          bg: '#f7f9fc',
          cardBg: '#ffffff',
          text: '#111827',
          textSecondary: '#6b7280',
          button: '#e5e7eb',
          buttonText: '#374151',
          accent: '#3b82f6',
          lineColor: '#ef4444',
          gridColor: '#e5e7eb',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        };

    // Custom SVG Chart Component
    const CustomChart = () => {
      const chartWidth = screenWidth - 64;
      const chartHeight = height - 40;
      const padding = { top: 20, right: 20, bottom: 30, left: 40 };
      const graphWidth = chartWidth - padding.left - padding.right;
      const graphHeight = chartHeight - padding.top - padding.bottom;

      const maxDB = 80;
      const timeWindow = duration || 30;

      // Create smooth path from waveform data
      const createPath = () => {
        if (waveformData.length < 2) {
          const y = graphHeight;
          return `M 0 ${y} L ${graphWidth} ${y}`;
        }

        const currentTime = time;
        const startTime = Math.max(0, currentTime - timeWindow);

        let pathData = '';
        let hasStarted = false;
        
        waveformData.forEach((point, index) => {
          const x = ((point.x - startTime) / timeWindow) * graphWidth;
          const y = graphHeight - (point.y / maxDB) * graphHeight;
          
          if (x >= 0 && x <= graphWidth) {
            if (!hasStarted) {
              pathData += `M ${Math.max(0, x)} ${y}`;
              hasStarted = true;
            } else {
              pathData += ` L ${x} ${y}`;
            }
          }
        });

        if (!hasStarted) {
          const y = graphHeight;
          pathData = `M 0 ${y} L ${graphWidth} ${y}`;
        }

        return pathData;
      };

      // Grid lines and labels
      const gridElements = [];
      
      // Horizontal grid lines (dB levels)
      const dbLevels = [0, 20, 40, 60, 80];
      dbLevels.forEach((dbValue, i) => {
        const y = graphHeight - (dbValue / maxDB) * graphHeight;
        
        gridElements.push(
          <Line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={graphWidth}
            y2={y}
            stroke={themeColors.gridColor}
            strokeWidth={dbValue === 0 ? 1 : 0.5}
            opacity={dbValue === 0 ? 0.6 : 0.3}
          />
        );
        
        gridElements.push(
          <SvgText
            key={`h-label-${i}`}
            x={-5}
            y={y + 4}
            fontSize="10"
            fill={themeColors.textSecondary}
            textAnchor="end"
          >
            {dbValue}
          </SvgText>
        );
      });

      // Vertical grid lines (time)
      const timePoints = 6;
      for (let i = 0; i <= timePoints; i++) {
        const x = (i / timePoints) * graphWidth;
        const timeValue = Math.max(0, time - timeWindow + (i / timePoints) * timeWindow);
        
        gridElements.push(
          <Line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={graphHeight}
            stroke={themeColors.gridColor}
            strokeWidth={0.5}
            opacity={0.3}
          />
        );
        
        gridElements.push(
          <SvgText
            key={`v-label-${i}`}
            x={x}
            y={graphHeight + 15}
            fontSize="10"
            fill={themeColors.textSecondary}
            textAnchor="middle"
          >
            {timeValue.toFixed(0)}s
          </SvgText>
        );
      }

      return (
        <Svg width={chartWidth} height={chartHeight}>
          <G x={padding.left} y={padding.top}>
            <Rect
              width={graphWidth}
              height={graphHeight}
              fill={themeColors.cardBg}
              stroke={themeColors.gridColor}
              strokeWidth={1}
              opacity={0.3}
            />
            
            {gridElements}
            
            <Path
              d={createPath()}
              stroke={themeColors.lineColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
            
            {running && (
              <>
                <Circle
                  cx={graphWidth - 10}
                  cy={graphHeight - (currentDB / maxDB) * graphHeight}
                  r={4}
                  fill={themeColors.accent}
                  opacity={0.8}
                />
                <Line
                  x1={graphWidth - 5}
                  y1={graphHeight - (currentDB / maxDB) * graphHeight}
                  x2={graphWidth + 15}
                  y2={graphHeight - (currentDB / maxDB) * graphHeight}
                  stroke={themeColors.accent}
                  strokeWidth={2}
                />
              </>
            )}

            {running && (
              <Circle
                cx={graphWidth - 30}
                cy={15}
                r={6}
                fill={themeColors.danger}
                opacity={animatedValue}
              />
            )}
          </G>
          
          <SvgText
            x={20}
            y={15}
            fontSize="12"
            fill={themeColors.textSecondary}
            fontWeight="bold"
          >
            dB
          </SvgText>
          
          <SvgText
            x={chartWidth - 60}
            y={chartHeight - 5}
            fontSize="12"
            fill={themeColors.textSecondary}
            fontWeight="bold"
          >
            Time (s)
          </SvgText>
        </Svg>
      );
    };

    // Color functions
    const getColorForRange = (rangeIndex) => {
      switch (rangeIndex) {
        case 0:
          return averageDB >= 0 && averageDB <= 25 ? themeColors.warning : themeColors.cardBg;
        case 1:
          return averageDB >= 26 && averageDB <= 50 ? themeColors.success : themeColors.cardBg;
        case 2:
          return averageDB >= 51 ? themeColors.danger : themeColors.cardBg;
        default:
          return themeColors.cardBg;
      }
    };

    const getAverageDbColor = () => {
      if (averageDB >= 0 && averageDB <= 25) return themeColors.warning;
      if (averageDB >= 26 && averageDB <= 50) return themeColors.success;
      if (averageDB >= 51) return themeColors.danger;
      return themeColors.accent;
    };

    const styles = StyleSheet.create({
      container: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: themeColors.bg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
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
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: themeColors.gridColor,
        minWidth: 70,
      },
      statText: {
        fontSize: 12,
        color: themeColors.text,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        textAlign: 'center',
      },
      buttonContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
      },
      button: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: 44,
      },
      buttonText: {
        fontSize: 14,
        fontWeight: '600',
      },
      startButton: {
        backgroundColor: running ? '#6b7280' : themeColors.success,
      },
      stopButton: {
        backgroundColor: !running ? '#6b7280' : themeColors.danger,
      },
      clearButton: {
        backgroundColor: themeColors.button,
        borderWidth: 1,
        borderColor: themeColors.gridColor,
      },
      chartContainer: {
        backgroundColor: themeColors.cardBg,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.gridColor,
        overflow: 'hidden',
      },
      rangeContainer: {
        flexDirection: 'row',
        gap: 4,
      },
      rangeIndicator: {
        flex: 1,
        padding: 10,
        borderRadius: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: themeColors.gridColor,
        minHeight: 40,
        justifyContent: 'center',
      },
      rangeText: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
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
              Current{'\n'}
              <Text style={{ color: themeColors.lineColor, fontWeight: 'bold' }}>
                {currentDB.toFixed(1)}
              </Text>{' dB'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Average{'\n'}
              <Text style={{ color: getAverageDbColor(), fontWeight: 'bold' }}>
                {averageDB.toFixed(1)}
              </Text>{' dB'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Speech{'\n'}
              <Text style={{ color: themeColors.accent, fontWeight: 'bold' }}>
                {activeSpeechTimeRef.current.toFixed(1)}
              </Text>{' s'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statText}>
              Time{'\n'}
              <Text style={{ color: themeColors.text, fontWeight: 'bold' }}>
                {time.toFixed(1)}
              </Text>{' s'}
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
                {running ? 'Recording...' : 'Start'}
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
          <CustomChart />
        </View>

        <View style={styles.rangeContainer}>
          <View
            style={[
              styles.rangeIndicator,
              { backgroundColor: getColorForRange(0) },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color: averageDB >= 0 && averageDB <= 25 ? '#ffffff' : themeColors.text,
                },
              ]}
            >
              Quiet{'\n'}0-25 dB
            </Text>
          </View>
          <View
            style={[
              styles.rangeIndicator,
              { backgroundColor: getColorForRange(1) },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color: averageDB >= 26 && averageDB <= 50 ? '#ffffff' : themeColors.text,
                },
              ]}
            >
              Normal{'\n'}26-50 dB
            </Text>
          </View>
          <View
            style={[
              styles.rangeIndicator,
              { backgroundColor: getColorForRange(2) },
            ]}
          >
            <Text
              style={[
                styles.rangeText,
                {
                  color: averageDB >= 51 ? '#ffffff' : themeColors.text,
                },
              ]}
            >
              Loud{'\n'}51+ dB
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

export default VoiceDBGraph;