import React, { useMemo } from 'react';
import { View } from 'react-native';
import { qrMatrix } from '@/lib/qr';

/** QR code drawn with plain Views (each dark module is a square). */
export const QRCode: React.FC<{ value: string; size: number; color?: string; background?: string }> = ({ value, size, color = '#111827', background = '#FFFFFF' }) => {
  const matrix = useMemo(() => {
    try {
      return qrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);
  if (!matrix) return null;
  const n = matrix.length;
  const cell = size / n;
  return (
    <View style={{ width: size, height: size, backgroundColor: background }} accessibilityLabel="Certificate verification QR code" accessible>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
};
