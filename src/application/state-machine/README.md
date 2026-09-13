# State-machine boundary

`transitions.ts` defines the allowed lifecycle edges. `RehearsalSession` invokes these guards for observation, comparison, activation, planning, review, execution, failure and cancellation. Invalid edges throw rather than silently advancing the UI. The ordered executor publishes action-level progress independently of React.
