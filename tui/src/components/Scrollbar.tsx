import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../hooks/ThemeContext.js";

interface ScrollbarProps {
  scrollOffset: number;
  visibleHeight: number;
  totalItems: number;
}

export const Scrollbar: React.FC<ScrollbarProps> = ({
  scrollOffset,
  visibleHeight,
  totalItems,
}) => {
  const { theme } = useTheme();
  if (totalItems <= visibleHeight || totalItems === 0) {
    return null;
  }

  // Calculate handle size (at least 1 block)
  const handleHeight = Math.max(
    1,
    Math.floor((visibleHeight / totalItems) * visibleHeight)
  );

  // Calculate handle position
  const maxScroll = totalItems - visibleHeight;
  const maxPos = visibleHeight - handleHeight;
  const handlePos = Math.floor((scrollOffset / maxScroll) * maxPos);

  const lines = [];
  for (let i = 0; i < visibleHeight; i++) {
    const isHandle = i >= handlePos && i < handlePos + handleHeight;
    lines.push(
      <Text
        key={i}
        color={isHandle ? theme.colors.scrollbarFg : theme.colors.scrollbarBg}
        dimColor={!isHandle}
      >
        {isHandle ? "█" : "│"}
      </Text>
    );
  }

  return (
    <Box flexDirection="column" width={1} marginLeft={1}>
      {lines}
    </Box>
  );
};
