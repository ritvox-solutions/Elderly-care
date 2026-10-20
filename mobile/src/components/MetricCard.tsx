import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  statusText?: string;
  statusVariant?: 'ok' | 'warn' | 'bad' | 'neutral';
  status?: string;
  color?: string;
  icon?: any;
  subText?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  statusText,
  statusVariant,
  status,
  color,
  icon: Icon,
  subText,
}) => {
  const effectiveStatusText = statusText || status || '';
  const effectiveVariant =
    statusVariant ||
    (status === 'CRITICAL'
      ? 'bad'
      : status === 'WARNING'
      ? 'warn'
      : 'ok');

  const getBadgeStyle = () => {
    switch (effectiveVariant) {
      case 'warn':
        return {
          bg: theme.warnBg,
          text: theme.warn,
          border: theme.warnBorder,
        };
      case 'bad':
        return {
          bg: theme.badBg,
          text: theme.bad,
          border: theme.badBorder,
        };
      case 'neutral':
        return {
          bg: theme.bg,
          text: theme.text2,
          border: theme.border,
        };
      case 'ok':
      default:
        return {
          bg: theme.okBg,
          text: theme.ok,
          border: theme.okBorder,
        };
    }
  };

  const badgeStyle = getBadgeStyle();

  return (
    <View style={styles.card}>
      {/* Top Label & Icon */}
      <View style={styles.header}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {Icon && (
          <View style={styles.iconBox}>
            <Icon size={14} color={color || theme.text2} />
          </View>
        )}
      </View>

      {/* Big Value + Unit */}
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {/* Bottom Status Pill / Subtext */}
      <View style={styles.footer}>
        {effectiveStatusText ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: badgeStyle.bg,
                borderColor: badgeStyle.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
              {effectiveStatusText}
            </Text>
          </View>
        ) : null}

        {subText ? <Text style={styles.subText}>{subText}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: theme.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
  },
  unit: {
    color: theme.text3,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subText: {
    fontSize: 10,
    color: theme.text3,
  },
});
