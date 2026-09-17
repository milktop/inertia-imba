# Bindable button processing and validation events

LinkButton's processing getter was incompatible with Imba named bindings, which
replace the bound property with a proxy to parent state. Processing is now a
published prop, updated on lifecycle changes and cleared on removal. The internal
request state remains authoritative for disabled, data-loading and duplicate
protection, regardless of parent writes to the bound value.

Added a bubbling error CustomEvent using Imba emit with detail { errors }, matching
Inertia onError validation semantics. Removed/stale requests cannot emit errors.
The event does not add stored form-error state or replace core network/HTTP error
handling. Parent components decide how to display messages; useForm remains the
full form abstraction.

The fixture demonstrates bind:processing labels and @error handlers. Browser
coverage checks loading text, binding reset on completion/cancellation/removal,
external writes not unlocking requests, and real Rails validation messages.
Unit coverage checks error payload forwarding and stale/removal guards.
