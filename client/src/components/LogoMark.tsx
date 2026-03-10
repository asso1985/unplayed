interface Props {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 76, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
    >
      <rect width="512" height="512" fill="#0a0a0f" />
      <text
        x="256" y="222"
        fontFamily="'Syne', sans-serif"
        fontSize="158"
        fontWeight="900"
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        textLength="380"
        lengthAdjust="spacingAndGlyphs"
      >UN</text>
      <text
        x="256" y="332"
        fontFamily="'Syne', sans-serif"
        fontSize="52"
        fontWeight="900"
        fill="var(--accent)"
        textAnchor="middle"
        dominantBaseline="central"
        textLength="380"
        lengthAdjust="spacingAndGlyphs"
      >played</text>
    </svg>
  );
}
