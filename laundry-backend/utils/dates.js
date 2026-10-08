// Date-only strings ("2026-10-08") arrive from the date pickers. A "from" date means
// the start of that day, and a "to" date must include the WHOLE day — otherwise
// "to = today" would cut off at midnight and miss everything submitted today.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

exports.parseFrom = (value) => new Date(value);

exports.parseTo = (value) =>
  DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);