import { Box, Text } from "ink";
import type { FC } from "react";
import { EventBusProvider } from "../event-bus/index.js";
import type { EventBus } from "../event-bus/index.js";
import { MessageList } from "./message-list.js";

interface AppProps {
  eventBus: EventBus;
}

const App: FC<AppProps> = ({ eventBus }) => {
  return (
    <EventBusProvider bus={eventBus}>
      <Box flexDirection="column" height="100%">
        <MessageList />
      </Box>
    </EventBusProvider>
  );
};

export default App;
