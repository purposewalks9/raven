# Nova Syntax Guide (Draft v0.1)

Nova source reads like a declarative tree of blocks. A `page` is the
top-level routed unit; inside it, `state` declares compiler-managed
reactive variables, `action`/`server action` declare behavior, and
everything else is a UI node tree.

## Annotated example

```nova
page "/login" {
    title "Welcome Back"

    // Compiler-managed state: the compiler tracks every write to `email`,
    // `password`, `loading` and regenerates only the DOM that depends on them.
    state email = ""
    state password = ""
    state loading = false

    // `action` runs on the client. `server action` (not used here) runs on
    // the server and is called over an auto-generated RPC.
    async action login() {
        loading = true
        let user = await auth.login(email, password)
        router.push("/dashboard")
        loading = false
    }

    // UI nodes: `identifier { ... }`. Props are `name value` pairs
    // (`width 420`), children can be nested nodes, string literals, or
    // `bind X` to two-way-bind a `state` variable to a control.
    center {
        card {
            width 420
            spacing 24

            heading { text "Welcome Back" }
            text { color gray; "Sign in to continue" }

            input { label "Email"; type email; bind email; placeholder "purpose@example.com" }
            input { label "Password"; type password; bind password; placeholder "••••••••" }

            checkbox { bind remember; "Remember me" }

            button { fullWidth; loading loading; click login; "Sign In" }

            divider "OR"
            socialButton { provider google }
            socialButton { provider github }

            link { to "/forgot-password"; "Forgot Password?" }

            footer {
                "Don't have an account?"
                link "/register" { "Create Account" }
            }
        }
    }
}
```

## Things worth calling out for the parser/typechecker

- `bind X` requires `X` to be a `state` declared in an enclosing scope —
  this is a typecheck-time error, not a runtime one, if `X` doesn't exist
  or its type doesn't match the control (e.g. `bind email` on a `checkbox`
  should be a type error since `email` is a `string`, not a `bool`).
- `click login` requires `login` to resolve to an in-scope `action`/`server action`
  with a compatible signature (no required args, or all-defaulted).
- `remember` in the example above is used via `bind remember` but never
  declared with `state remember = false` — that's a real bug an example
  should not ship with; the typechecker should flag "undeclared state
  reference" here. Good first test case for `typechecker/`.
