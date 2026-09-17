# Precognition endpoints and field-specific checks

The validation endpoint previously could not be reused by useForm.submit without
repeating the method and URL. The Precognition submission wrapper now uses core's
argument parser, so submit()/submit(options) reuse the configured endpoint while
explicit destinations still override it. This also works for useHttp.

useForm now uses core's constructor argument parser: method/URL/data and URL-method
pairs enable Precognition, while keyed forms keep the explicit chaining style.
The Students fixture submits through its configured endpoint and uses explicit
`only` lists on blur so checking name does not revalidate email's displayed state.

Rails still calls model.valid? and filters returned errors; this is not a promise
that only one model validator executes. Existing errors on other fields are kept.

Regression coverage checks bound submission, options and overrides, changing the
endpoint, constructor overloads, useHttp, and name-only validation after email was
touched. Rails coverage asserts the name-only response excludes invalid email
and creates no record. No routes or model validation rules changed.
