const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", day: "2-digit", year: "numeric" });
export const timeLabel = (time) => clock.format(time);
export const dateLabel = (time) => day.format(time);
export const num = (value) => value.toLocaleString("en-US");
export const outcomeNames = { success: "Success", failure: "Failure", other: "Other" };
export { default as sampleUrl } from "../data/sample-logins.csv?url&no-inline";
