import { describe, expect, it } from "vitest";
import { tokenize } from "../lexer/index.js";
import { parse } from "./parser.js";

const LOGIN_SRC = `
page "/login" {
    title "Welcome Back"
    state email = ""
    state password = ""
    state loading = false

    async action login() {
        loading = true
        let user = await auth.login(email, password)
        router.push("/dashboard")
        loading = false
    }

    center {
        card {
            width 420
            spacing 24
            heading {
                text "Welcome Back"
            }
            input {
                label "Email"
                bind email
            }
            button {
                fullWidth
                click login
                "Sign In"
            }
        }
    }
}
`;

describe("parser", () => {
  it("parses the login page into a single PageDecl", () => {
    const program = parse(tokenize(LOGIN_SRC));
    expect(program.body).toHaveLength(1);
    expect(program.body[0]?.type).toBe("PageDecl");
  });

  it("captures the page route", () => {
    const program = parse(tokenize(LOGIN_SRC));
    const page = program.body[0] as import("../ast/nodes.js").PageDecl;
    expect(page.route).toBe("/login");
  });

  it("parses all three state declarations", () => {
    const program = parse(tokenize(LOGIN_SRC));
    const page = program.body[0] as import("../ast/nodes.js").PageDecl;
    const stateNames = page.body.filter((s) => s.type === "StateDecl").map((s: any) => s.name);
    expect(stateNames).toEqual(["email", "password", "loading"]);
  });

  it("parses the async login action with its statements", () => {
    const program = parse(tokenize(LOGIN_SRC));
    const page = program.body[0] as import("../ast/nodes.js").PageDecl;
    const action = page.body.find((s) => s.type === "ActionDecl") as any;
    expect(action.isAsync).toBe(true);
    expect(action.name).toBe("login");
    // loading = true; let user = ...; router.push(...); loading = false
    expect(action.body).toHaveLength(4);
    expect(action.body[1].type).toBe("LetDecl");
  });

  it("parses nested UI nodes down to the button's click prop", () => {
    const program = parse(tokenize(LOGIN_SRC));
    const page = program.body[0] as import("../ast/nodes.js").PageDecl;
    const center = page.ui.find((n) => n.name === "center")!;
    const card = center.children.find((c: any) => c.name === "card") as any;
    const button = card.children.find((c: any) => c.name === "button");
    const clickProp = button.props.find((p: any) => p.name === "click");
    expect(clickProp.values[0]).toMatchObject({ type: "Identifier", name: "login" });
  });
});
