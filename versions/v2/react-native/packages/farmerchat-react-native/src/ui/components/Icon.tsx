/**
 * FcIcon — tintable icon rendered from the rasterized app vector drawables.
 */
import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';
import { Icons, type IconName } from '../assets';

export function FcIcon(props: {
  name: IconName;
  size?: number;
  tint?: string;
  style?: StyleProp<ImageStyle>;
}): React.ReactElement {
  const size = props.size ?? 24;
  return (
    <Image
      source={Icons[props.name]}
      resizeMode="contain"
      style={[
        { width: size, height: size },
        props.tint ? { tintColor: props.tint } : null,
        props.style,
      ]}
    />
  );
}
