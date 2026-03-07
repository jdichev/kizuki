import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { MODE_ITEMS } from "../constants/config.js";

interface StartViewProps {
  activeIndex: number;
  terminalWidth: number;
}

export const StartView: React.FC<StartViewProps> = ({
  activeIndex,
  terminalWidth,
}) => (
  <Box flexDirection="column">
    <SectionHeader title="Choose Browsing Mode" terminalWidth={terminalWidth} />
    {MODE_ITEMS.map((m, i) => (
      <Text
        key={m.value}
        backgroundColor={i === activeIndex ? "yellowBright" : undefined}
        color={i === activeIndex ? "black" : undefined}
      >
        {`  ${m.title}`.padEnd(terminalWidth - 4)}
      </Text>
    ))}
  </Box>
);
