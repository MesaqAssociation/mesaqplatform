import React from 'react'
import Svg, { Rect, Line, G } from 'react-native-svg'

interface IconProps {
  size?: number
  color?: string
}

export const DashboardIcon: React.FC<IconProps> = ({ size = 24, color = '#030819' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <Rect
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
      />
      <Line
        x1="4"
        y1="9"
        x2="20"
        y2="9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Line
        x1="9"
        y1="10"
        x2="9"
        y2="20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </G>
  </Svg>
)

export default DashboardIcon






