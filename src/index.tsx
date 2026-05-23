import { render } from "ink";
import App from "./ui/app.js";
import { createEventBus } from "./event-bus/index.js";

const eventBus = createEventBus();

render(<App eventBus={eventBus} />);
