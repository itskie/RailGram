import React, { useEffect, useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';

interface Props {
  uri: string;
}

export default function AutoImage({ uri }: Props) {
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      const ratio = h / w;
      const clamped = Math.min(Math.max(ratio, 0.5625), 1.25);
      setHeight(width * clamped);
    }, () => {});
  }, [uri, width]);

  if (!height) return null;

  return (
    <Image
      source={{ uri }}
      style={{ width, height, backgroundColor: '#111' }}
      resizeMode="cover"
    />
  );
}
