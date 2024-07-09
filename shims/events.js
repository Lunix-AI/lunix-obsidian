// import * as events from "node_modules/events/";
const events = require("node_modules/events");
window.events = events;

console.log({ events });

// module.exports = {
// 	events,
// 	...events,
// 	default: events,
// 	EventEmitter: events.EventEmitter,
// };

// export default events;

const { EventEmitter } = events;

export { events, EventEmitter, events as default };
