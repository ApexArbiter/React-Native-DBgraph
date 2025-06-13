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
  Circle,
} from 'react-native-svg';
// Using react-native-audio-recorder-player for better stability
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const {width: screenWidth} = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();

const SimpleDBGraph = forwardRef(
  ({duration = 30, height = 200, maxDB = 100, sensitivity = 1.0}, ref) => {
    const [waveformData, setWaveformData] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [currentDB, setCurrentDB] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [hasPermissions, setHasPermissions] = useState(Platform.OS === 'ios'); // iOS doesn't need runtime permissions
    const [isComponentMounted, setIsComponentMounted] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState('checking');

    const intervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const animatedValue = useRef(new Animated.Value(0)).current;
    const recordingPathRef = useRef('');

    // Component mount effect
    useEffect(() => {
      setIsComponentMounted(true);
      
      // Check permissions after component mounts
      const checkPermissions = async () => {
        try {
          if (Platform.OS === 'android') {
            // Check current permission status first
            const recordPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            
            console.log('Current record permission status:', recordPermission);
            
            if (recordPermission) {
              setHasPermissions(true);
              setPermissionStatus('granted');
            } else {
              setHasPermissions(false);
              setPermissionStatus('denied');
            }
          } else {
            // iOS - assume permissions are available
            setHasPermissions(true);
            setPermissionStatus('granted');
          }
        } catch (error) {
          console.error('Permission check error:', error);
          setHasPermissions(false);
          setPermissionStatus('error');
        }
      };

      // Check permissions immediately
      checkPermissions();
      
      return () => {
        setIsComponentMounted(false);
      };
    }, []);

    // Generate smooth random DB values for demonstration
    // Replace this with actual audio processing
    const generateDBValue = () => {
      // Simulate more realistic audio patterns
      const baseNoise = Math.random() * 15; // 0-15 dB background noise
      const speechBurst = Math.random() > 0.7 ? Math.random() * 40 : 0; // Occasional speech
      const totalDB = Math.min(maxDB, baseNoise + speechBurst);
      return totalDB;
    };

    // Request microphone permission
    const requestPermission = async () => {
      if (!isComponentMounted) {
        console.log('Component not mounted, skipping permission request');
        return false;
      }

      if (Platform.OS === 'android') {
        try {
          // First check if we already have the permission
          const currentStatus = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          
          if (currentStatus) {
            console.log('Permission already granted');
            setHasPermissions(true);
            setPermissionStatus('granted');
            return true;
          }

          // Request the permission
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'This app needs access to your microphone to record audio.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          console.log('Permission request result:', granted);

          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Microphone permission granted');
            setHasPermissions(true);
            setPermissionStatus('granted');
            return true;
          } else {
            console.log('Microphone permission denied');
            setHasPermissions(false);
            setPermissionStatus('denied');
            return false;
          }
        } catch (err) {
          console.warn('Permission request error:', err);
          setHasPermissions(false);
          setPermissionStatus('error');
          return false;
        }
      }
      
      // iOS doesn't need runtime permissions for basic recording
      setHasPermissions(true);
      setPermissionStatus('granted');
      return true;
    };

    // Manual permission request function
    const requestPermissionManually = async () => {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required', 
          'Microphone permission is required to record audio. Please enable it in your device settings.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      }
    };

    // Start recording and monitoring
    const startRecording = async () => {
      if (!isComponentMounted) {
        console.log('Component not mounted, cannot start recording');
        return;
      }

      try {
        // Check permissions first
        if (!hasPermissions) {
          const granted = await requestPermission();
          if (!granted) {
            Alert.alert(
              'Permission Required', 
              'Microphone permission is required to record audio.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Request Permission', onPress: requestPermissionManually }
              ]
            );
            return;
          }
        }

        // Clear previous data
        setWaveformData([]);
        setCurrentDB(0);
        setElapsedTime(0);
        startTimeRef.current = Date.now();

        // Start recording with simplified audio settings
        const path = Platform.OS === 'android' ? 'temp_audio.mp4' : 'temp_audio.m4a';
        recordingPathRef.current = path;

        // Simplified audio configuration to avoid enum issues
        const audioSet = Platform.OS === 'android' ? {
          AudioEncoderAndroid: 'aac',
          AudioSourceAndroid: 'mic',
          OutputFormatAndroid: 'mpeg_4',
        } : {
          AVEncoderAudioQualityKeyIOS: 'high',
          AVNumberOfChannelsKeyIOS: 1,
          AVFormatIDKeyIOS: 'mp4',
        };

        console.log('Starting recorder with path:', path);
        console.log('Audio settings:', audioSet);

        try {
          await audioRecorderPlayer.startRecorder(path, audioSet);
        } catch (recordError) {
          console.error('Recorder start error:', recordError);
          // Try with minimal settings if the above fails
          console.log('Trying with minimal settings...');
          await audioRecorderPlayer.startRecorder(path);
        }
        setIsRecording(true);

        // Start pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 800,
              useNativeDriver: false,
            }),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 800,
              useNativeDriver: false,
            }),
          ]),
        ).start();

        // Start monitoring with smooth intervals
        intervalRef.current = setInterval(() => {
          const currentTime = (Date.now() - startTimeRef.current) / 1000;
          setElapsedTime(currentTime);

          // Generate DB value (replace with actual audio analysis)
          const dbValue = generateDBValue();
          setCurrentDB(dbValue);

          // Add point to waveform with smooth interpolation
          setWaveformData(prev => {
            const newPoint = {
              x: currentTime,
              y: dbValue,
              timestamp: Date.now(),
            };

            const updated = [...prev, newPoint];

            // Keep only points within time window
            const timeWindow = duration;
            const filtered = updated.filter(
              point => point.x >= Math.max(0, currentTime - timeWindow),
            );

            return filtered;
          });

          // Auto-stop after duration
          if (currentTime >= duration) {
            stopRecording();
          }
        }, 50); // Smooth 20fps updates
      } catch (error) {
        console.error('Start recording error:', error);
        if (isComponentMounted) {
          Alert.alert('Error', 'Failed to start recording: ' + error.message);
        }
        setIsRecording(false);
      }
    };

    // Stop recording
    const stopRecording = async () => {
      try {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        if (isRecording) {
          await audioRecorderPlayer.stopRecorder();
          audioRecorderPlayer.removeRecordBackListener();
        }

        setIsRecording(false);
        animatedValue.stopAnimation();

        console.log('Recording stopped');
      } catch (error) {
        console.error('Stop recording error:', error);
      }
    };

    // Clear all data
    const clearData = () => {
      setWaveformData([]);
      setCurrentDB(0);
      setElapsedTime(0);
      startTimeRef.current = 0;
      animatedValue.setValue(0);
    };

    // Expose methods
    useImperativeHandle(ref, () => ({
      startRecording,
      stopRecording,
      clearData,
      isRecording,
      getCurrentDB: () => currentDB,
      requestPermission: requestPermissionManually,
    }));

    // Cleanup
    useEffect(() => {
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (isRecording) {
          audioRecorderPlayer.stopRecorder().catch(console.error);
        }
      };
    }, [isRecording]);

    // Chart component
    const DBChart = () => {
      const chartWidth = screenWidth - 40;
      const chartHeight = height - 60;
      const padding = {top: 20, right: 30, bottom: 30, left: 50};
      const graphWidth = chartWidth - padding.left - padding.right;
      const graphHeight = chartHeight - padding.top - padding.bottom;

      // Create smooth path
      const createSmoothPath = () => {
        if (waveformData.length < 2) {
          return `M 0 ${graphHeight} L ${graphWidth} ${graphHeight}`;
        }

        const currentTime = elapsedTime;
        const startTime = Math.max(0, currentTime - duration);

        // Get points in time window
        const points = waveformData
          .filter(p => p.x >= startTime)
          .map(point => ({
            x: ((point.x - startTime) / duration) * graphWidth,
            y: graphHeight - (point.y / maxDB) * graphHeight,
          }));

        if (points.length === 0) {
          return `M 0 ${graphHeight} L ${graphWidth} ${graphHeight}`;
        }

        // Create smooth curve using quadratic bezier
        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
          const prevPoint = points[i - 1];
          const currentPoint = points[i];

          // Simple smooth line - you can implement bezier curves for even smoother lines
          path += ` L ${currentPoint.x} ${currentPoint.y}`;
        }

        return path;
      };

      // Grid lines
      const gridLines = [];

      // Horizontal grid (DB levels)
      const dbSteps = [0, 20, 40, 60, 80, 100];
      dbSteps.forEach((db, i) => {
        const y = graphHeight - (db / maxDB) * graphHeight;
        gridLines.push(
          <Line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={graphWidth}
            y2={y}
            stroke="#e0e0e0"
            strokeWidth={db === 0 ? 1 : 0.5}
            opacity={0.6}
          />,
        );
        gridLines.push(
          <SvgText
            key={`h-label-${i}`}
            x={-8}
            y={y + 4}
            fontSize="12"
            fill="#666"
            textAnchor="end">
            {db}
          </SvgText>,
        );
      });

      // Vertical grid (time)
      const timeSteps = 5;
      for (let i = 0; i <= timeSteps; i++) {
        const x = (i / timeSteps) * graphWidth;
        const timeValue = Math.max(
          0,
          elapsedTime - duration + (i / timeSteps) * duration,
        );

        gridLines.push(
          <Line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={graphHeight}
            stroke="#e0e0e0"
            strokeWidth={0.5}
            opacity={0.4}
          />,
        );
        gridLines.push(
          <SvgText
            key={`v-label-${i}`}
            x={x}
            y={graphHeight + 18}
            fontSize="11"
            fill="#666"
            textAnchor="middle">
            {timeValue.toFixed(0)}s
          </SvgText>,
        );
      }

      return (
        <Svg width={chartWidth} height={chartHeight}>
          <G x={padding.left} y={padding.top}>
            {/* Background */}
            <Rect
              width={graphWidth}
              height={graphHeight}
              fill="white"
              stroke="#ddd"
              strokeWidth={1}
            />

            {/* Grid */}
            {gridLines}

            {/* Waveform */}
            <Path
              d={createSmoothPath()}
              stroke="#ff4444"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Current position indicator */}
            {isRecording && (
              <>
                <Circle
                  cx={graphWidth - 5}
                  cy={graphHeight - (currentDB / maxDB) * graphHeight}
                  r={4}
                  fill="#ff4444"
                />
                <Circle
                  cx={graphWidth - 20}
                  cy={10}
                  r={5}
                  fill="#ff0000"
                  opacity={animatedValue}
                />
              </>
            )}
          </G>

          {/* Labels */}
          <SvgText x={15} y={15} fontSize="14" fill="#333" fontWeight="bold">
            dB
          </SvgText>
          <SvgText
            x={chartWidth - 40}
            y={chartHeight - 5}
            fontSize="14"
            fill="#333"
            fontWeight="bold">
            Time (s)
          </SvgText>
        </Svg>
      );
    };

    // Don't render until component is mounted
    if (!isComponentMounted) {
      return (
        <View style={styles.container}>
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DB Monitor</Text>
          <View style={styles.currentDB}>
            <Text style={styles.dbValue}>{currentDB.toFixed(1)}</Text>
            <Text style={styles.dbLabel}>dB</Text>
          </View>
        </View>

        {/* Permissions warning */}
        {!hasPermissions && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              Microphone permission required for recording
            </Text>
            <TouchableOpacity 
              style={styles.permissionButton} 
              onPress={requestPermissionManually}
            >
              <Text style={styles.permissionButtonText}>Request Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.button,
              isRecording ? styles.stopButton : styles.startButton,
              !hasPermissions && !isRecording && styles.disabledButton,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={!hasPermissions && !isRecording}>
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearData}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>

          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>{elapsedTime.toFixed(1)}s</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <DBChart />
        </View>

        {/* Status */}
        <View style={styles.status}>
          <Text style={styles.statusText}>
            Status: {isRecording ? 'Recording' : 'Stopped'} | Points:{' '}
            {waveformData.length} | Permissions: {hasPermissions ? '✓' : '✗'} ({permissionStatus})
          </Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  currentDB: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  dbValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4444',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dbLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  warningText: {
    color: '#856404',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  startButton: {
    backgroundColor: '#28a745',
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6c757d',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timeDisplay: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 'auto',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  status: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default SimpleDBGraph;