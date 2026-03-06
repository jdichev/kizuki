import React from "react";
import { Box, Text } from "ink";

interface HelpDialogProps {
  width: number;
  height: number;
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  width,
  height,
  onClose,
}) => {
  const TREE_BRANCH_LABEL = "└─ ";
  const MODE_SELECTION_LABEL = "[ Mode ]";
  const CATEGORY_LABEL = "[ Category ]";
  const ITEM_LABEL = "[ Item ]";

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
          <Text color="magenta" bold>
            {`██   ██ ██████ ███████ ██    ██ ██   ██ ██████ 
██  ██    ██      ███  ██    ██ ██  ██    ██   
█████     ██     ███   ██    ██ █████     ██   
██  ██    ██    ███    ██    ██ ██  ██    ██   
██   ██ ██████ ███████  ██████  ██   ██ ██████`}
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={1} alignItems="center">
          <Text>A minimalist feed reader designed for focus.</Text>
          <Box marginTop={1}>
            <Text>Navigation is based on arrows or WASD keys:</Text>
          </Box>
          <Text color="gray"> ↑/W or ↓/S - Move selection</Text>
          <Text color="gray"> →/D or Enter - Go deeper / Open</Text>
          <Text color="gray"> ←/A - Go back</Text>
          <Text color="gray"> E - Toggle unread-only</Text>
          <Text color="gray"> Q - Mark all as read</Text>
          <Text color="gray"> R - Reload / Refresh</Text>
          <Text color="gray"> ? - Show this help</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1} alignItems="center">
          <Text>The application structure is a tree:</Text>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="green"
            paddingX={2}
            paddingY={1}
            marginTop={1}
          >
            <Text color="green">{MODE_SELECTION_LABEL}</Text>
            <Text color="green"> </Text>
            <Text color="green">
              {" ".repeat(MODE_SELECTION_LABEL.length / 2)}
              {TREE_BRANCH_LABEL}
              {CATEGORY_LABEL}
            </Text>
            <Text color="green"> </Text>
            <Text color="green">
              {" ".repeat(MODE_SELECTION_LABEL.length / 2)}
              {" ".repeat(CATEGORY_LABEL.length / 2 + TREE_BRANCH_LABEL.length)}
              {TREE_BRANCH_LABEL}
              {ITEM_LABEL}
            </Text>
          </Box>
        </Box>

        <Box alignItems="center" justifyContent="center" marginTop={1}>
          <Text dimColor>Press </Text>
          <Text bold color="white">
            [Any Key]
          </Text>
          <Text dimColor> to start</Text>
        </Box>
      </Box>
    </Box>
  );
};
