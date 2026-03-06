import React from "react";
import { Box, Text } from "ink";

interface HelpDialogProps {
  width: number;
  height: number;
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ width, height, onClose }) => {
  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        padding={1}
        width={width}
        minHeight={height}
      >
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          <Text color="yellow">   ✧</Text>
          <Text color="yellow"> ✧ ✦ ✧</Text>
          <Text color="yellow">   ✧</Text>
          <Box marginTop={1}>
            <Text bold color="cyan">
              WELCOME TO KIZUKI
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1} alignItems="center">
          <Text>Kizuki is a minimalist feed reader designed for focus.</Text>
          <Box marginTop={1}>
            <Text>Navigation is based on arrows or WASD keys:</Text>
          </Box>
          <Text color="gray">  ↑/W or ↓/S - Move selection</Text>
          <Text color="gray">  →/D or Enter - Go deeper / Open</Text>
          <Text color="gray">  ←/A - Go back</Text>
          <Text color="gray">  E - Toggle unread-only</Text>
          <Text color="gray">  Q - Mark all as read</Text>
          <Text color="gray">  R - Reload / Refresh</Text>
          <Text color="gray">  ? - Show this help</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1} alignItems="center">
          <Text>The application structure is a tree:</Text>
          <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1} marginTop={1}>
            <Text color="green">
              [ Mode ]
            </Text>
            <Text color="green">
              {" "} └─ [ Category ]
            </Text>
            <Text color="green">
              {"     "} └─ [ Item ]
            </Text>
          </Box>
        </Box>

        <Box alignItems="center" justifyContent="center" marginTop={1}>
          <Text dimColor>Press </Text>
          <Text bold color="white">[Any Key]</Text>
          <Text dimColor> to start</Text>
        </Box>
      </Box>
    </Box>
  );
};
