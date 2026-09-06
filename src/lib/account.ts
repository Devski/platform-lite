// What a freshly registered account looks like, in ONE place (#40).
//
// Better Auth requires a `name` on sign-up. The product does not: the display
// identity is asked for in onboarding and stored on the profile, and taking
// this from the e-mail address published the account's own address on a public
// page and in every shared link (#36).
//
// The value lives here rather than in the register form because it is a
// contract, and a contract copied into fixtures goes stale silently. Every
// fixture builds its accounts through the same constant, and one test pins
// the result against a real sign-up.

export const REGISTRATION_NAME = "";
