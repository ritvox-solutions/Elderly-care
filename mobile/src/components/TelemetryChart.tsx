import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { TelemetryPoint } from '../types';

interface TelemetryChartProps {
  data: TelemetryPoint[];
  width?: number;
  height?: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  height = 160,
}) => {
  // Chart dimensions
  const svgWidth = 320;
  const svgHeight = height;
  const padLeft = 32;
  const padRight = 32;
  const padTop = 15;
  const padBottom = 25;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  // HR scale: 40 to 130
  // SpO2 scale: 75 to 100
  const hrToY = (hr: number) => {
    const clamped = Math.max(40, Math.min(130, hr));
    const pct = (clamped - 40) / (130 - 40);
    return padTop + chartH * (1 - pct);
  };

  const spo2ToY = (spo2: number) => {
    const clamped = Math.max(75, Math.min(100, spo2));
    const pct = (clamped - 75) / (100 - 75);
    return padTop + chartH * (1 - pct);
  };

  const points = data.slice(-12);
  const n = points.length;

  let hrPath = '';
  let spo2Path = '';

  points.forEach((p, i) => {
    const x = padLeft + (i / Math.max(1, n - 1)) * chartW;
    const yHr = hrToY(p.heartRate || 57);
    const ySpo2 = spo2ToY(p.spo2 || 97);

    if (i === 0) {
      hrPath = `M${x.toFixed(1)},${yHr.toFixed(1)}`;
      spo2Path = `M${x.toFixed(1)},${ySpo2.toFixed(1)}`;
    } else {
      hrPath += ` L${x.toFixed(1)},${yHr.toFixed(1)}`;
      spo2Path += ` L${x.toFixed(1)},${ySpo2.toFixed(1)}`;
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Background gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padTop + chartH * pct;
            return (
              <Line
                key={idx}
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="#e2e8e6"
                strokeWidth="1"
                strokeDasharray={idx === 1 ? '4,4' : undefined}
              />
            );
          })}

          {/* SpO2 Dashed Teal Line */}
          <Path
            d={spo2Path}
            fill="none"
            stroke="#16794a"
            strokeWidth="2.5"
            strokeDasharray="4,4"
          />

          {/* Heart Rate Solid Red Line */}
          <Path
            d={hrPath}
            fill="none"
            stroke="#b4232a"
            strokeWidth="2.5"
          />
        </Svg>

        {/* Left Y-axis labels (HR) */}
        <View style={styles.leftAxis}>
          <Text style={styles.axisLabel}>130</Text>
          <Text style={styles.axisLabel}>100</Text>
          <Text style={styles.axisLabel}>80</Text>
          <Text style={styles.axisLabel}>60</Text>
          <Text style={styles.axisLabel}>40</Text>
        </View>

        {/* Right Y-axis labels (SpO2) */}
        <View style={styles.rightAxis}>
          <Text style={styles.axisLabel}>100</Text>
          <Text style={styles.axisLabel}>90</Text>
          <Text style={styles.axisLabel}>85</Text>
          <Text style={styles.axisLabel}>80</Text>
          <Text style={styles.axisLabel}>75</Text>
        </View>
      </View>

      {/* X-axis time points */}
      <View style={styles.timeAxis}>
        {points.filter((_, idx) => idx % 3 === 0).map((p, idx) => (
          <Text key={idx} style={styles.timeLabel}>
            {p.timeStr}
          </Text>
        ))}
      </View>

      {/* Legend matching screenshot */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.hrLegendLine} />
          <Text style={styles.legendText}>Heart rate (bpm)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.spo2LegendLine} />
          <Text style={styles.legendText}>SpO2 (%)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
  },
  chartWrapper: {
    position: 'relative',
    height: 160,
  },
  leftAxis: {
    position: 'absolute',
    left: 4,
    top: 8,
    bottom: 24,
    justifyContent: 'space-between',
  },
  rightAxis: {
    position: 'absolute',
    right: 4,
    top: 8,
    bottom: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  axisLabel: {
    fontSize: 9,
    color: '#7a8f8a',
    fontFamily: 'monospace',
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 9,
    color: '#7a8f8a',
    fontFamily: 'monospace',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8e6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hrLegendLine: {
    width: 16,
    height: 3,
    backgroundColor: '#b4232a',
    borderRadius: 2,
  },
  spo2LegendLine: {
    width: 16,
    height: 3,
    backgroundColor: '#16794a',
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: '#4b5f5a',
    fontWeight: '500',
  },
});
