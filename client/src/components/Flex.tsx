import React from 'react';

interface FlexProps extends React.HTMLAttributes<HTMLElement> {
  /** Rendered element — defaults to `div` */
  as?: React.ElementType;
  /** flex-direction */
  direction?: React.CSSProperties['flexDirection'];
  /** align-items */
  align?: React.CSSProperties['alignItems'];
  /** justify-content */
  justify?: React.CSSProperties['justifyContent'];
  /** flex-wrap */
  wrap?: React.CSSProperties['flexWrap'];
  /** gap — numbers are treated as px */
  gap?: React.CSSProperties['gap'] | number;
  /** flex shorthand (e.g. 1, "1 1 auto") */
  flex?: React.CSSProperties['flex'];
  /** flex-grow */
  grow?: React.CSSProperties['flexGrow'];
  /** flex-shrink */
  shrink?: React.CSSProperties['flexShrink'];
  /** flex-basis */
  basis?: React.CSSProperties['flexBasis'];
  /** display: inline-flex instead of flex */
  inline?: boolean;
}

export default function Flex({
  as: Tag = 'div',
  direction,
  align,
  justify,
  wrap,
  gap,
  flex,
  grow,
  shrink,
  basis,
  inline,
  style,
  ...rest
}: FlexProps) {
  const flexStyle: React.CSSProperties = {
    display: inline ? 'inline-flex' : 'flex',
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap,
    gap: typeof gap === 'number' ? `${gap}px` : gap,
    flex,
    flexGrow: grow,
    flexShrink: shrink,
    flexBasis: basis,
    ...style,
  };

  return <Tag style={flexStyle} {...rest} />;
}
